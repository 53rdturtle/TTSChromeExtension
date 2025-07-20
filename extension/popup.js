// TTS Chrome Extension Popup Controller

class TTSController {
  constructor() {
    this.elements = this.initializeElements();
    this.bindEvents();
    
    this.loadSavedData().then(() => {
      this.populateVoices();
      this.loadHighlightingSettings();
      this.loadGoogleTTSSettings();
    });
  }

  // Initialize DOM elements
  initializeElements() {
    const elements = {
      voiceSelect: document.getElementById('voiceSelect'),
      previewVoiceBtn: document.getElementById('previewVoiceBtn'),
      rateRange: document.getElementById('rateRange'),
      rateValue: document.getElementById('rateValue'),
      textArea: document.getElementById('text'),
      speakBtn: document.getElementById('speakBtn'),
      stopBtn: document.getElementById('stopBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      // Full Selection elements
      fullSelectionToggle: document.getElementById('fullSelectionToggle'),
      fullSelectionColor: document.getElementById('fullSelectionColor'),
      fullSelectionOpacity: document.getElementById('fullSelectionOpacity'),
      fullSelectionOpacityValue: document.getElementById('fullSelectionOpacityValue'),
      // Sentence elements
      sentenceToggle: document.getElementById('sentenceToggle'),
      sentenceColor: document.getElementById('sentenceColor'),
      sentenceOpacity: document.getElementById('sentenceOpacity'),
      sentenceOpacityValue: document.getElementById('sentenceOpacityValue'),
      sentenceCompatibility: document.getElementById('sentenceCompatibility'),
      // Word elements
      wordToggle: document.getElementById('wordToggle'),
      wordColor: document.getElementById('wordColor'),
      wordOpacity: document.getElementById('wordOpacity'),
      wordOpacityValue: document.getElementById('wordOpacityValue'),
      // Google TTS elements
      googleTTSToggle: document.getElementById('googleTTSToggle'),
      googleAPIKey: document.getElementById('googleAPIKey'),
      wordCompatibility: document.getElementById('wordCompatibility'),
      // Global elements
      autoScrollToggle: document.getElementById('autoScrollToggle'),
      animationToggle: document.getElementById('animationToggle')
    };
    
    
    return elements;
  }

  // Bind event listeners
  bindEvents() {
    this.elements.textArea.addEventListener('input', () => this.saveText());
    this.elements.voiceSelect.addEventListener('change', () => this.onVoiceChange());
    this.elements.previewVoiceBtn.addEventListener('click', () => this.previewVoice());
    this.elements.rateRange.addEventListener('input', () => this.updateRate());
    this.elements.speakBtn.addEventListener('click', () => this.speak());
    this.elements.stopBtn.addEventListener('click', () => this.stop());
    
    // Settings events
    this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
    this.elements.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
    
    // Full Selection events
    this.elements.fullSelectionToggle.addEventListener('change', () => this.saveSettings());
    this.elements.fullSelectionColor.addEventListener('change', () => this.saveSettings());
    this.elements.fullSelectionOpacity.addEventListener('input', () => this.updateOpacityValue('fullSelection'));
    this.elements.fullSelectionOpacity.addEventListener('change', () => this.saveSettings());
    
    // Sentence events
    this.elements.sentenceToggle.addEventListener('change', () => this.saveSettings());
    this.elements.sentenceColor.addEventListener('change', () => this.saveSettings());
    this.elements.sentenceOpacity.addEventListener('input', () => this.updateOpacityValue('sentence'));
    this.elements.sentenceOpacity.addEventListener('change', () => this.saveSettings());
    
    // Word events
    this.elements.wordToggle.addEventListener('change', () => this.saveSettings());
    this.elements.wordColor.addEventListener('change', () => this.saveSettings());
    this.elements.wordOpacity.addEventListener('input', () => this.updateOpacityValue('word'));
    this.elements.wordOpacity.addEventListener('change', () => this.saveSettings());
    
    // Global events
    this.elements.autoScrollToggle.addEventListener('change', () => this.saveSettings());
    this.elements.animationToggle.addEventListener('change', () => this.saveSettings());
    
    // Google TTS events
    this.elements.googleTTSToggle.addEventListener('change', () => this.saveGoogleTTSSettings());
    this.elements.googleAPIKey.addEventListener('input', () => this.saveGoogleTTSSettings());
  }

  // Load saved data from storage, but prefer selected text from the active tab if available
  loadSavedData() {
    return new Promise((resolve) => {
      // Try to get selected text from the background script
      chrome.runtime.sendMessage({ type: 'getSelectedText' }, (response) => {
        if (response && response.status === 'success' && response.selectedText) {
          this._pendingSpeakText = response.selectedText;
          // Don't set textarea or speak yet; wait for voices and selected voice
          this._loadTextFromStorage(resolve);
          return;
        }
        // Fallback to saved/default text
        this._loadTextFromStorage(resolve);
      });
    });
  }

  // Helper to load text from storage
  _loadTextFromStorage(callback) {
    chrome.storage.sync.get(['ttsText', 'selectedVoice', 'speechRate'], (result) => {
      
      // Show loading status in the rate value display
      this.elements.rateValue.textContent = 'Loading...';
      
      // Always load speech rate first
      if (result.speechRate !== undefined) {
        this.elements.rateRange.value = result.speechRate;
        this.elements.rateValue.textContent = result.speechRate;
      } else {
        this.elements.rateRange.value = 1.0;
        this.elements.rateValue.textContent = '1.0 (default)';
      }
      
      if (this._pendingSpeakText) {
        // Set the textarea with selected text
        this.elements.textArea.value = this._pendingSpeakText;
        // We'll speak after voices are loaded and selected voice is restored
        this._pendingVoiceToRestore = result.selectedVoice;
        
        // Add a verification check after a short delay
        setTimeout(() => {
        }, 100);
      } else {
        if (result.ttsText !== undefined && result.ttsText !== '') {
          this.elements.textArea.value = result.ttsText;
        } else {
          this.elements.textArea.value = 'Hello, this is a test of the TTS extension.';
        }
      }
      if (callback) callback();
    });
  }

  // Save text to storage
  saveText() {
    chrome.storage.sync.set({ ttsText: this.elements.textArea.value });
  }

  // Save selected voice to storage and update compatibility indicators
  // Handle voice selection change
  onVoiceChange() {
    this.saveVoice();
    this.updatePreviewButton();
  }

  saveVoice() {
    chrome.storage.sync.set({ selectedVoice: this.elements.voiceSelect.value });
    this.updateCompatibilityIndicators();
  }

  // Update preview button state
  updatePreviewButton() {
    const hasSelectedVoice = this.elements.voiceSelect.value !== '';
    this.elements.previewVoiceBtn.disabled = !hasSelectedVoice;
  }

  // Preview the selected voice
  async previewVoice() {
    const selectedVoice = this.elements.voiceSelect.value;
    if (!selectedVoice) return;

    // Find the voice object to determine if it's Google or Chrome TTS
    const voice = this.availableVoices?.find(v => v.name === selectedVoice);
    if (!voice) return;

    // Sample text for preview
    const previewTexts = [
      "Hello! This is how I sound.",
      "Welcome to text-to-speech preview.",
      "This is a sample of my voice quality.",
      "How do you like the sound of this voice?"
    ];
    const previewText = previewTexts[Math.floor(Math.random() * previewTexts.length)];

    try {
      // Update button state
      this.elements.previewVoiceBtn.classList.add('playing');
      this.elements.previewVoiceBtn.textContent = '⏹️';

      // Send preview message
      const message = {
        type: 'speak',
        text: previewText,
        voiceName: selectedVoice,
        rate: parseFloat(this.elements.rateRange.value)
      };

      chrome.runtime.sendMessage(message, (response) => {
        // Reset button after preview (with delay to account for TTS duration)
        setTimeout(() => {
          this.elements.previewVoiceBtn.classList.remove('playing');
          this.elements.previewVoiceBtn.textContent = '🔊';
        }, Math.max(2000, previewText.length * 100)); // Estimate duration
      });

    } catch (error) {
      console.error('Error previewing voice:', error);
      this.elements.previewVoiceBtn.classList.remove('playing');
      this.elements.previewVoiceBtn.textContent = '🔊';
    }
  }

  // Update rate display and save to storage
  updateRate() {
    const rate = this.elements.rateRange.value;
    this.elements.rateValue.textContent = rate;
    chrome.storage.sync.set({ speechRate: rate }, () => {
    });
  }

  // Populate voice dropdown
  populateVoices() {
    
    // Set a timeout to ensure we don't wait forever for voices
    const voiceTimeout = setTimeout(() => {
      if (this._pendingSpeakText && !this._autoSpeakTriggered) {
        this._autoSpeakTriggered = true;
        this.speak();
        this._pendingSpeakText = null;
      }
    }, 3000); // 3 second timeout
    
    chrome.runtime.sendMessage({ type: 'getVoices' }, (response) => {
      
      clearTimeout(voiceTimeout); // Clear timeout if we get a response
      
      if (chrome.runtime.lastError) {
        console.error('Runtime error in getVoices:', chrome.runtime.lastError);
      }
      
      if (response && response.status === 'success') {
        this.populateVoiceOptions(response.voices);
        this.restoreSelectedVoice(() => {
          // Update compatibility indicators after voice is restored
          this.updateCompatibilityIndicators();
          // If we have pending selected text to speak, do it now
          if (this._pendingSpeakText && !this._autoSpeakTriggered) {
            this._autoSpeakTriggered = true;
            this.speak();
            this._pendingSpeakText = null;
          } else {
          }
        });
      } else {
        console.error('Failed to get voices:', response?.error);
        this.showError('Failed to load voices: ' + (response?.error || 'Unknown error'));
        // Fallback: if we have pending text to speak, try to speak anyway
        if (this._pendingSpeakText && !this._autoSpeakTriggered) {
          this._autoSpeakTriggered = true;
          this.speak();
          this._pendingSpeakText = null;
        }
      }
    });
  }

  // Populate voice options in dropdown with compatibility indicators
  populateVoiceOptions(voices) {
    this.elements.voiceSelect.innerHTML = '';
    
    // Store voices for compatibility checking
    this.availableVoices = voices;
    
    // Group voices by language for better organization
    const voicesByLanguage = this.groupVoicesByLanguage(voices);
    
    // Create option groups for each language
    Object.entries(voicesByLanguage).forEach(([language, langVoices]) => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = this.getLanguageDisplayName(language);
      
      langVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        
        // Build display text with quality indicators
        const qualityBadge = this.getQualityBadge(voice.quality, voice.isGoogle);
        const genderIcon = this.getGenderIcon(voice.gender);
        
        option.textContent = `${qualityBadge} ${voice.name} ${genderIcon}`;
        
        // Add data attributes for filtering/sorting
        option.dataset.quality = voice.quality;
        option.dataset.gender = voice.gender;
        option.dataset.isGoogle = voice.isGoogle;
        option.dataset.language = voice.lang;
        
        optGroup.appendChild(option);
      });
      
      this.elements.voiceSelect.appendChild(optGroup);
    });
    
    // Update preview button state after voices are loaded
    this.updatePreviewButton();
  }

  // Group voices by language
  groupVoicesByLanguage(voices) {
    return voices.reduce((acc, voice) => {
      const lang = voice.lang || 'unknown';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(voice);
      return acc;
    }, {});
  }

  // Get quality badge emoji
  getQualityBadge(quality, isGoogle) {
    const badges = {
      'Chirp3': '🎭',     // Premium HD voices
      'Neural2': '🎵',    // High quality neural
      'Studio': '🎬',     // Studio quality
      'WaveNet': '🌊',    // WaveNet technology
      'Standard': '📻'    // Standard voices
    };
    
    const badge = badges[quality] || '📻';
    const serviceIcon = isGoogle ? '🔗' : '🔧'; // Google vs Chrome
    
    return `${badge}${serviceIcon}`;
  }

  // Get gender icon
  getGenderIcon(gender) {
    switch (gender) {
      case 'male': return '♂️';
      case 'female': return '♀️';
      case 'neutral': return '⚪';
      default: return '';
    }
  }

  // Get readable language display name
  getLanguageDisplayName(langCode) {
    const langNames = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)', 
      'en-AU': 'English (AU)',
      'en-CA': 'English (CA)',
      'es-ES': 'Spanish (Spain)',
      'es-US': 'Spanish (US)',
      'fr-FR': 'French (France)',
      'fr-CA': 'French (Canada)',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'pt-BR': 'Portuguese (Brazil)',
      'pt-PT': 'Portuguese (Portugal)',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'zh-CN': 'Chinese (Mandarin)',
      'zh-TW': 'Chinese (Taiwan)',
      'hi-IN': 'Hindi',
      'ar-XA': 'Arabic',
      'ru-RU': 'Russian'
    };
    
    return langNames[langCode] || langCode;
  }

  // Check which highlighting modes this voice supports
  getVoiceCompatibility(voice) {
    const eventTypes = voice.eventTypes || [];
    
    // Google TTS voices have different capabilities
    if (voice.isGoogle) {
      return {
        fullSelection: true, // Always supported 
        sentence: true, // Google TTS supports sentence events via SSML marks
        word: true // Google TTS supports word events via SSML marks
      };
    }
    
    // Chrome TTS voice compatibility based on event types
    return {
      fullSelection: true, // Always supported (just needs start/end events)
      sentence: eventTypes.includes('sentence') || eventTypes.includes('start'), // Sentence boundaries or basic events
      word: eventTypes.includes('word') // Word boundaries required
    };
  }

  // Format compatibility information for display
  formatCompatibilityText(compatibility) {
    const indicators = [];
    
    // Use short indicators to keep dropdown readable
    if (compatibility.fullSelection) indicators.push('F✓');
    if (compatibility.sentence) indicators.push('S✓'); else indicators.push('S✗');
    if (compatibility.word) indicators.push('W✓'); else indicators.push('W✗');
    
    return `[${indicators.join(' ')}]`;
  }

  // Restore previously selected voice, then call callback
  restoreSelectedVoice(callback) {
    chrome.storage.sync.get(['selectedVoice'], (result) => {
      if (result.selectedVoice !== undefined) {
        this.elements.voiceSelect.value = result.selectedVoice;
      } else {
      }
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  // Speak the text
  speak() {
    const text = this.elements.textArea.value.trim();
    
    if (!text) {
      this.showError('Please enter some text to speak');
      return;
    }

    const rate = parseFloat(this.elements.rateRange.value);

    const message = {
      type: 'speak',
      text: text,
      rate: rate,
      voiceName: this.elements.voiceSelect.value
    };


    this.setButtonState(true);
    
    chrome.runtime.sendMessage(message, (response) => {
      if (response && response.status === 'error') {
        console.error('TTS Error:', response.error);
        this.showError('TTS Error: ' + response.error);
        this.setButtonState(false);
      } else {
        // Start polling for speaking status
        this.pollSpeakingStatus();
      }
    });
  }

  // Poll the background script for TTS speaking status
  pollSpeakingStatus() {
    const poll = () => {
      chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
        if (response && response.status === 'success') {
          if (response.isSpeaking) {
            // Still speaking, poll again
            this.setButtonState(true);
            this._pollTimeout = setTimeout(poll, 500);
          } else {
            // Done speaking
            this.setButtonState(false);
          }
        } else {
          // On error, reset button
          this.setButtonState(false);
        }
      });
    };
    poll();
  }

  // Stop TTS playback
  stop() {
    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout);
      this._pollTimeout = null;
    }
    chrome.runtime.sendMessage({ type: 'stop' }, (response) => {
      if (response && response.status === 'error') {
        console.error('Stop Error:', response.error);
        this.showError('Stop Error: ' + response.error);
      }
      this.setButtonState(false);
    });
  }

  // Set button states during TTS operations
  setButtonState(isSpeaking) {
    this.elements.speakBtn.disabled = isSpeaking;
    this.elements.stopBtn.disabled = !isSpeaking;
    
    if (isSpeaking) {
      this.elements.speakBtn.textContent = 'Speaking...';
    } else {
      this.elements.speakBtn.textContent = 'Speak';
    }
  }

  // Show error message
  showError(message) {
    // Create a temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #ff4444;
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 1000;
      font-size: 12px;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }

  // Show settings panel
  showSettings() {
    this.elements.settingsPanel.classList.add('active');
    document.body.classList.add('settings-open');
  }

  // Hide settings panel
  hideSettings() {
    this.elements.settingsPanel.classList.remove('active');
    document.body.classList.remove('settings-open');
  }

  // Update opacity value display
  updateOpacityValue(mode) {
    if (mode === 'fullSelection') {
      const opacity = this.elements.fullSelectionOpacity.value;
      this.elements.fullSelectionOpacityValue.textContent = opacity;
    } else if (mode === 'sentence') {
      const opacity = this.elements.sentenceOpacity.value;
      this.elements.sentenceOpacityValue.textContent = opacity;
    } else if (mode === 'word') {
      const opacity = this.elements.wordOpacity.value;
      this.elements.wordOpacityValue.textContent = opacity;
    }
  }

  // Load highlighting settings from storage
  loadHighlightingSettings() {
    chrome.runtime.sendMessage({ type: 'getHighlightingSettings' }, (response) => {
      if (response && response.status === 'success') {
        this.applySettingsToUI(response.settings);
      } else {
        console.error('Failed to load highlighting settings:', response?.error);
      }
    });
  }

  // Apply settings to UI elements
  applySettingsToUI(settings) {
    
    // Full Selection settings
    if (settings.fullSelection) {
      this.elements.fullSelectionToggle.checked = settings.fullSelection.enabled !== false;
      if (settings.fullSelection.style) {
        this.elements.fullSelectionColor.value = settings.fullSelection.style.backgroundColor || '#ffeb3b';
        this.elements.fullSelectionOpacity.value = settings.fullSelection.style.opacity || 0.8;
        this.elements.fullSelectionOpacityValue.textContent = settings.fullSelection.style.opacity || 0.8;
      }
    }

    // Sentence settings
    if (settings.sentence) {
      this.elements.sentenceToggle.checked = settings.sentence.enabled === true;
      if (settings.sentence.style) {
        this.elements.sentenceColor.value = settings.sentence.style.backgroundColor || '#4caf50';
        this.elements.sentenceOpacity.value = settings.sentence.style.opacity || 0.7;
        this.elements.sentenceOpacityValue.textContent = settings.sentence.style.opacity || 0.7;
      }
    }

    // Word settings
    if (settings.word) {
      this.elements.wordToggle.checked = settings.word.enabled === true;
      if (settings.word.style) {
        this.elements.wordColor.value = settings.word.style.backgroundColor || '#2196f3';
        this.elements.wordOpacity.value = settings.word.style.opacity || 0.9;
        this.elements.wordOpacityValue.textContent = settings.word.style.opacity || 0.9;
      }
    }

    // Global settings
    if (settings.global) {
      this.elements.autoScrollToggle.checked = settings.global.autoScroll !== false;
      this.elements.animationToggle.checked = settings.global.animationEffects !== false;
    }
  }

  // Update compatibility indicators in settings panel
  updateCompatibilityIndicators() {
    // Get the currently selected voice
    const selectedVoiceName = this.elements.voiceSelect.value;
    if (!selectedVoiceName || !this.availableVoices) return;
    
    const selectedVoice = this.availableVoices.find(voice => voice.voiceName === selectedVoiceName);
    if (!selectedVoice) return;
    
    const compatibility = this.getVoiceCompatibility(selectedVoice);
    
    // Update sentence compatibility indicator
    if (this.elements.sentenceCompatibility) {
      this.updateCompatibilityElement(this.elements.sentenceCompatibility, compatibility.sentence, 'Sentence highlighting');
    }
    
    // Update word compatibility indicator
    if (this.elements.wordCompatibility) {
      this.updateCompatibilityElement(this.elements.wordCompatibility, compatibility.word, 'Word-by-word highlighting');
    }
  }

  // Update a single compatibility indicator element
  updateCompatibilityElement(element, isSupported, featureName) {
    const statusElement = element.querySelector('.compatibility-status');
    if (!statusElement) return;
    
    // Clear existing classes
    element.classList.remove('supported', 'unsupported');
    
    if (isSupported) {
      element.classList.add('supported');
      statusElement.textContent = `${featureName} supported ✓`;
    } else {
      element.classList.add('unsupported');
      statusElement.textContent = `${featureName} not supported by this voice`;
    }
  }

  // Save settings to storage
  saveSettings() {
    
    // Get current settings from UI
    const settings = {
      fullSelection: {
        enabled: this.elements.fullSelectionToggle.checked,
        style: {
          backgroundColor: this.elements.fullSelectionColor.value,
          textColor: '#000000',
          opacity: parseFloat(this.elements.fullSelectionOpacity.value),
          borderStyle: 'none'
        }
      },
      sentence: {
        enabled: this.elements.sentenceToggle.checked,
        style: {
          backgroundColor: this.elements.sentenceColor.value,
          textColor: '#ffffff',
          opacity: parseFloat(this.elements.sentenceOpacity.value),
          borderStyle: 'solid'
        }
      },
      word: {
        enabled: this.elements.wordToggle.checked,
        style: {
          backgroundColor: this.elements.wordColor.value,
          textColor: '#ffffff',
          opacity: parseFloat(this.elements.wordOpacity.value),
          borderStyle: 'dashed'
        }
      },
      global: {
        autoScroll: this.elements.autoScrollToggle.checked,
        animationEffects: this.elements.animationToggle.checked
      }
    };


    chrome.runtime.sendMessage({
      type: 'saveHighlightingSettings',
      settings: settings
    }, (response) => {
      if (response && response.status === 'success') {
      } else {
        console.error('Failed to save settings:', response?.error);
        this.showError('Failed to save settings: ' + (response?.error || 'Unknown error'));
      }
    });
  }

  // Load Google TTS settings
  loadGoogleTTSSettings() {
    chrome.storage.sync.get(['googleTTSEnabled', 'googleAPIKey'], (result) => {
      this.elements.googleTTSToggle.checked = result.googleTTSEnabled === true;
      this.elements.googleAPIKey.value = result.googleAPIKey || '';
    });
  }

  // Save Google TTS settings
  saveGoogleTTSSettings() {
    const settings = {
      googleTTSEnabled: this.elements.googleTTSToggle.checked,
      googleAPIKey: this.elements.googleAPIKey.value.trim()
    };
    
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save Google TTS settings:', chrome.runtime.lastError);
      } else {
      }
    });
  }
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    const controller = new TTSController();
    
    // On load, check if TTS is currently speaking
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      if (response && response.status === 'success' && response.isSpeaking) {
        controller.setButtonState(true);
        controller.pollSpeakingStatus();
      }
    });
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
  }
});

// Export class for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSController };
} 