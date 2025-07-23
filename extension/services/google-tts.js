// Google Cloud Text-to-Speech Service

class GoogleTTSService {
  constructor() {
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    this.betaEndpoint = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';
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
      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${this.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

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
      if (error.name === 'AbortError') {
        console.error('Google TTS synthesis request timed out after 30 seconds');
        throw new Error('Google TTS synthesis timed out. Please try again.');
      } else {
        console.error('Google TTS synthesis error:', error);
        throw error;
      }
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
    // Stop any existing audio first to prevent conflicts
    try {
      await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'stopGoogleTTS' }, () => {
          // Small delay to let audio system settle
          setTimeout(resolve, 50);
        });
      });
    } catch (error) {
      // Ignore stop errors, but still wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
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

  // Track usage for quota management
  async trackUsage(characterCount) {
    return new Promise((resolve) => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      chrome.storage.local.get(['googleTTSUsage'], (result) => {
        let usage = result.googleTTSUsage || {};
        
        // Handle corrupted data
        if (typeof usage !== 'object' || Array.isArray(usage)) {
          usage = {};
        }
        
        // Initialize current month if it doesn't exist
        if (!usage[currentMonth]) {
          usage[currentMonth] = 0;
        }
        
        // Add character count to current month
        usage[currentMonth] += characterCount;
        
        // Clean up old months (keep only last 3 months)
        const months = Object.keys(usage);
        if (months.length > 3) {
          months.sort();
          const toDelete = months.slice(0, months.length - 3);
          toDelete.forEach(month => delete usage[month]);
        }
        
        chrome.storage.local.set({ googleTTSUsage: usage }, () => {
          resolve(usage[currentMonth]);
        });
      });
    });
  }

  // Get current month's usage
  async getCurrentUsage() {
    return new Promise((resolve) => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      chrome.storage.local.get(['googleTTSUsage'], (result) => {
        let usage = result.googleTTSUsage || {};
        
        // Handle corrupted data
        if (typeof usage !== 'object' || Array.isArray(usage)) {
          usage = {};
        }
        
        resolve({
          used: usage[currentMonth] || 0,
          month: currentMonth,
          limit: 1000000 // 1M characters per month free tier
        });
      });
    });
  }

  // Check if we're approaching quota limits
  async checkQuotaStatus() {
    const usage = await this.getCurrentUsage();
    const percentage = (usage.used / usage.limit) * 100;
    
    return {
      ...usage,
      percentage,
      warning: percentage >= 80 ? (percentage >= 95 ? 'critical' : 'high') : null
    };
  }

  // Speak with SSML highlighting support
  async speakWithHighlighting(text, options = {}, paragraphBoundaries = []) {
    try {
      // SSML builder should be pre-loaded in background.js
      if (typeof SSMLBuilder === 'undefined') {
        throw new Error('SSML Builder not available - ensure it is imported in background.js');
      }
      
      // Check quota before synthesis
      const quotaStatus = await this.checkQuotaStatus();
      if (quotaStatus.percentage >= 100) {
        throw new Error('Google TTS monthly quota exceeded. Please try again next month or upgrade your plan.');
      }
      
      // Send quota warnings
      if (quotaStatus.warning) {
        chrome.runtime.sendMessage({ 
          type: 'quotaWarning', 
          quotaData: quotaStatus 
        }, () => {});
      }
      
      // Check if sentence highlighting is enabled and voice supports it
      const highlightingSettings = await this.getHighlightingSettings();
      const sentenceHighlightingEnabled = highlightingSettings?.sentence?.enabled || false;
      const voiceSupportsMarks = this.supportsSSMLMarks(options.voiceName);
      const useSentenceHighlighting = sentenceHighlightingEnabled && voiceSupportsMarks;
      
      let ssmlResult;
      let result;
      
      if (useSentenceHighlighting) {
        // Create sentence-level SSML with marks and paragraph boundaries
        ssmlResult = await SSMLBuilder.createSentenceSSML(text, options.lang || 'en', paragraphBoundaries);
        
        // Store sentence data for highlighting
        this.currentText = text;
        this.currentSentenceData = ssmlResult;
        
        // Use SSML synthesis for sentence highlighting
        result = await this.synthesizeSSML(ssmlResult.ssml, options);
        
      } else if (sentenceHighlightingEnabled && !voiceSupportsMarks) {
        // Create basic SSML for full selection highlighting (Studio voices)
        ssmlResult = SSMLBuilder.createBasicSSML(text);
        
        // Store for event handling (no sentence data for Studio voices)
        this.currentText = text;
        this.currentSentenceData = null;
        
        // Use regular synthesis for Studio voices
        result = await this.synthesize(text, options);
        
      } else {
        // Create basic SSML for full selection highlighting
        ssmlResult = SSMLBuilder.createBasicSSML(text);
        
        // Store for event handling
        this.currentText = text;
        this.currentSentenceData = null;
        
        // Use regular synthesis 
        result = await this.synthesize(text, options);
      }
      
      // Track usage
      await this.trackUsage(text.length);
      
      // Play audio with highlighting and timing events
      await this.playAudioWithMarkEvents(result.audioContent, ssmlResult.marks, ssmlResult, result.timepoints);
      
      // Determine the actual mode used
      let mode;
      if (useSentenceHighlighting) {
        mode = 'sentence_ssml';
      } else if (sentenceHighlightingEnabled && !voiceSupportsMarks) {
        mode = 'studio_voice_fallback';
      } else {
        mode = 'basic_ssml';
      }
      
      return { 
        status: 'speaking', 
        service: 'google', 
        mode: mode,
        sentences: ssmlResult.totalSentences || 0,
        voiceType: voiceSupportsMarks ? 'compatible' : 'studio'
      };
      
    } catch (error) {
      console.error('GoogleTTS speak with highlighting error:', error);
      throw error;
    }
  }

  // Full speak method that synthesizes and plays (legacy - without highlighting)
  async speak(text, options = {}) {
    try {
      // Check quota before synthesis
      const quotaStatus = await this.checkQuotaStatus();
      if (quotaStatus.percentage >= 100) {
        throw new Error('Google TTS monthly quota exceeded. Please try again next month or upgrade your plan.');
      }
      
      // Send quota warnings if needed
      if (quotaStatus.warning) {
        chrome.runtime.sendMessage({ 
          type: 'quotaWarning', 
          quotaData: quotaStatus 
        }, () => {});
      }
      
      // Synthesize speech
      const result = await this.synthesize(text, options);
      
      // Track usage after successful synthesis
      await this.trackUsage(text.length);
      
      // Play audio
      await this.playAudio(result.audioContent);
      
      return { status: 'speaking', service: 'google' };
      
    } catch (error) {
      console.error('GoogleTTS speak error:', error);
      throw error;
    }
  }

  // Check if a voice supports SSML marks (for sentence highlighting)
  supportsSSMLMarks(voiceName) {
    if (!voiceName) return false;
    
    // Studio voices don't support <mark> tags
    if (voiceName.includes('Studio')) {
      return false;
    }
    
    // Standard, Neural2, and WaveNet voices support <mark> tags
    if (voiceName.includes('Standard') || 
        voiceName.includes('Neural2') || 
        voiceName.includes('WaveNet')) {
      return true;
    }
    
    // Default to true for other Google voices (they likely support marks)
    return true;
  }

  // Get highlighting settings from storage
  async getHighlightingSettings() {
    try {
      const data = await chrome.storage.sync.get({ 
        highlightingSettings: {
          fullSelection: { enabled: true },
          sentence: { enabled: true },
          word: { enabled: false }
        }
      });
      return data.highlightingSettings;
    } catch (error) {
      console.warn('Could not load highlighting settings:', error);
      return {
        fullSelection: { enabled: true },
        sentence: { enabled: true },
        word: { enabled: false }
      };
    }
  }

  // Load SSML builder utility (now pre-loaded in background.js)
  async loadSSMLBuilder() {
    // SSML Builder is now pre-loaded in background.js via importScripts
    return Promise.resolve();
  }

  // Synthesize speech using SSML with timing support
  async synthesizeSSML(ssml, options = {}) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Google TTS API key not configured');
    }

    // Get voice configuration
    const googleVoiceConfig = this.getVoiceConfig(options.voiceName);

    // Prepare request payload for SSML with timing support
    const request = {
      input: { ssml: ssml },  // Use SSML instead of text
      voice: { 
        languageCode: googleVoiceConfig.lang, 
        name: googleVoiceConfig.voice
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        speakingRate: options.rate || 1.0,
        pitch: options.pitch || 0.0,
        volumeGainDb: options.volumeGainDb || 0.0
      },
      // Enable SSML mark timing events using v1beta1 API
      enableTimePointing: ['SSML_MARK']
    };

    try {
      // Make API call with timeout - Use v1beta1 API for timing support
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${this.betaEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Google TTS API error: ${response.status} - ${errorData.error?.message || errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        audioContent: data.audioContent,
        timepoints: data.timepoints || []
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Google TTS synthesis request timed out after 30 seconds');
        throw new Error('Google TTS synthesis timed out. Please try again.');
      } else {
        console.error('Google TTS SSML synthesis error:', error);
        throw error;
      }
    }
  }

  // Play audio with mark event handling and timing events
  async playAudioWithMarkEvents(audioContent, marks, sentenceData = null, timepoints = []) {
    try {
      // Ensure offscreen document exists
      await this.ensureOffscreenDocument();
      
      // Store data for highlighting coordination
      if (typeof setGoogleTTSCurrentText === 'function') {
        setGoogleTTSCurrentText(this.currentText);
      } else if (typeof googleTTSCurrentText !== 'undefined') {
        googleTTSCurrentText = this.currentText;
      }
      
      if (typeof setGoogleTTSSentenceData === 'function') {
        setGoogleTTSSentenceData(sentenceData);
      } else if (typeof googleTTSSentenceData !== 'undefined') {
        googleTTSSentenceData = sentenceData;
      }
      
      if (typeof setGoogleTTSTimepoints === 'function') {
        setGoogleTTSTimepoints(timepoints);
      } else if (typeof googleTTSTimepoints !== 'undefined') {
        googleTTSTimepoints = timepoints;
      }
      
      // Send audio to offscreen document - it will trigger googleTTSStarted which will use the stored text
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'playGoogleTTS',
          audioData: audioContent
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ status: 'error', error: chrome.runtime.lastError.message });
          } else if (response && response.status === 'playing') {
            resolve({ status: 'success', message: 'Audio playback started' });
          } else {
            resolve({ status: 'error', error: 'Failed to play audio' });
          }
        });
      });
      
    } catch (error) {
      console.error('Error in playAudioWithMarkEvents setup:', error);
      return { status: 'error', error: error.message };
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

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      if (error.name === 'AbortError') {
        console.error('Google TTS voices API request timed out after 10 seconds');
      } else {
        console.error('Error fetching Google TTS voices:', error);
      }
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