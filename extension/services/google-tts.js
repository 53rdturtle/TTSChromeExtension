// Google Cloud Text-to-Speech Service

class GoogleTTSService {
  constructor() {
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    this.apiKey = null;
  }

  // Set API key
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  // Get API key from storage
  async getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['googleAPIKey'], (result) => {
        this.apiKey = result.googleAPIKey || null;
        resolve(this.apiKey);
      });
    });
  }

  // Check if Google TTS is enabled and has valid API key
  async isEnabled() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['googleTTSEnabled', 'googleAPIKey'], (result) => {
        const enabled = result.googleTTSEnabled === true;
        const hasKey = !!(result.googleAPIKey && result.googleAPIKey.trim() !== '');
        // console.log('🔍 Google TTS isEnabled check:', { enabled, hasKey });
        resolve(enabled && hasKey);
      });
    });
  }

  // Get voice configuration for Google TTS - handles both Chrome voice names and Google voice names
  getVoiceConfig(voiceName) {
    // Check if this is already a Google TTS voice name (contains dashes and region codes)
    if (this.isGoogleVoiceName(voiceName)) {
      return {
        voice: voiceName,
        lang: this.extractLanguageFromGoogleVoice(voiceName)
      };
    }
    
    // Otherwise, map Chrome voice name to Google voice
    return this.mapChromeVoiceToGoogle(voiceName);
  }

  // Check if voice name is a Google TTS voice (e.g., "en-US-Neural2-F")
  isGoogleVoiceName(voiceName) {
    // Google voice names follow pattern: language-region-type-variant
    return /^[a-z]{2}-[A-Z]{2}-/.test(voiceName);
  }

  // Extract language code from Google voice name
  extractLanguageFromGoogleVoice(voiceName) {
    const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
    return match ? match[1] : 'en-US';
  }

  // Map Chrome TTS voice names to Google TTS voice names with language codes
  mapChromeVoiceToGoogle(chromeVoiceName) {
    const voiceMap = {
      'Google US English': { voice: 'en-US-Neural2-F', lang: 'en-US' },
      'Google UK English Female': { voice: 'en-GB-Neural2-A', lang: 'en-GB' },
      'Google UK English Male': { voice: 'en-GB-Neural2-B', lang: 'en-GB' },
      'Microsoft David - English (United States)': { voice: 'en-US-Neural2-D', lang: 'en-US' },
      'Microsoft Zira - English (United States)': { voice: 'en-US-Neural2-F', lang: 'en-US' },
      'Alex': { voice: 'en-US-Neural2-D', lang: 'en-US' },
      'Samantha': { voice: 'en-US-Neural2-F', lang: 'en-US' }
    };
    
    return voiceMap[chromeVoiceName] || { voice: 'en-US-Neural2-F', lang: 'en-US' }; // Default to Neural2 female
  }

  // Synthesize text using Google TTS API
  async synthesize(text, options = {}) {
    // Get API key
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Google TTS API key not configured');
    }

    // Get voice configuration - either map Chrome voice or use Google voice directly
    const googleVoiceConfig = this.getVoiceConfig(options.voiceName);

    // Prepare request payload
    const request = {
      input: { text: text },
      voice: { 
        languageCode: googleVoiceConfig.lang, 
        name: googleVoiceConfig.voice
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        speakingRate: options.rate || 1.0,
        pitch: options.pitch || 0.0,
        volumeGainDb: options.volumeGainDb || 0.0
      }
    };

    try {
      // Make API call
      const response = await fetch(`${this.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google TTS API error:', response.status, errorText);
        throw new Error(`Google TTS API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.audioContent) {
        throw new Error('No audio content received from Google TTS');
      }

      return {
        audioContent: data.audioContent, // Base64 encoded MP3
        audioConfig: data.audioConfig
      };

    } catch (error) {
      console.error('Google TTS synthesis error:', error);
      throw error;
    }
  }

  // Ensure offscreen document exists
  async ensureOffscreenDocument() {
    try {
      // Check if offscreen document exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen.html')]
      });
      
      if (existingContexts.length === 0) {
        // Create offscreen document if it doesn't exist
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play Google TTS audio in service worker context'
        });
        console.log('📄 Recreated offscreen document');
        
        // Small delay to ensure offscreen document is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Failed to ensure offscreen document:', error);
      throw new Error('Could not create offscreen document for audio playback');
    }
  }

  // Play audio using offscreen document
  async playAudio(audioContent) {
    // Ensure offscreen document exists before sending message
    await this.ensureOffscreenDocument();
    
    return new Promise((resolve, reject) => {
      // Send message to offscreen document to play audio
      chrome.runtime.sendMessage({
        type: 'playGoogleTTS',
        audioData: audioContent
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to offscreen:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.status === 'error') {
          console.error('Offscreen audio error:', response.error);
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Stop audio playback
  async stopAudio() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'stopGoogleTTS'
      }, (response) => {
        resolve(response);
      });
    });
  }

  // Full speak method that synthesizes and plays
  async speak(text, options = {}) {
    try {
      // Synthesize speech
      const result = await this.synthesize(text, options);
      
      // Play audio
      await this.playAudio(result.audioContent);
      
      return { status: 'speaking', service: 'google' };
      
    } catch (error) {
      console.error('GoogleTTS speak error:', error);
      throw error;
    }
  }

  // Get available voices from Google TTS API
  async getVoices(languageCode = null) {
    // Get API key
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      // Return empty array if no API key - fallback to Chrome voices
      return [];
    }

    try {
      // Build API URL
      let url = `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`;
      if (languageCode) {
        url += `&languageCode=${languageCode}`;
      }

      // Make API call
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Google TTS voices API error:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      
      // Transform API response to our format
      return (data.voices || []).map(voice => ({
        name: voice.name,
        lang: voice.languageCodes?.[0] || 'unknown',
        languages: voice.languageCodes || [],
        gender: this.mapGender(voice.ssmlGender),
        quality: this.getVoiceQuality(voice.name),
        sampleRate: voice.naturalSampleRateHertz,
        isGoogle: true
      }));

    } catch (error) {
      console.error('Error fetching Google TTS voices:', error);
      return [];
    }
  }

  // Helper method to map Google TTS gender to our format
  mapGender(ssmlGender) {
    switch (ssmlGender) {
      case 'MALE': return 'male';
      case 'FEMALE': return 'female';
      case 'NEUTRAL': return 'neutral';
      default: return 'unknown';
    }
  }

  // Helper method to determine voice quality from voice name
  getVoiceQuality(voiceName) {
    if (voiceName.includes('Chirp')) return 'Chirp3';
    if (voiceName.includes('Neural2')) return 'Neural2';
    if (voiceName.includes('WaveNet')) return 'WaveNet';
    if (voiceName.includes('Studio')) return 'Studio';
    return 'Standard';
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleTTSService;
}