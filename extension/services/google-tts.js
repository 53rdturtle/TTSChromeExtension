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
        const hasKey = result.googleAPIKey && result.googleAPIKey.trim() !== '';
        // console.log('🔍 Google TTS isEnabled check:', { enabled, hasKey });
        resolve(enabled && hasKey);
      });
    });
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

    // Map Chrome voice name to Google voice name with language code
    const googleVoiceConfig = this.mapChromeVoiceToGoogle(options.voiceName);

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

  // Get available voices (placeholder for now)
  async getVoices() {
    // For MVP, return a basic set of voices
    // In the future, this could call the Google TTS voices API
    return [
      { name: 'en-US-Neural2-F', lang: 'en-US', gender: 'female', quality: 'Neural2' },
      { name: 'en-US-Neural2-M', lang: 'en-US', gender: 'male', quality: 'Neural2' },
      { name: 'en-US-WaveNet-F', lang: 'en-US', gender: 'female', quality: 'WaveNet' },
      { name: 'en-US-WaveNet-M', lang: 'en-US', gender: 'male', quality: 'WaveNet' }
    ];
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleTTSService;
}