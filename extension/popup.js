// TTS Chrome Extension Popup Controller
console.log('popup.js loaded - NEW FILE');

class TTSController {
  constructor() {
    console.log('TTSController constructor called');
    this.elements = this.initializeElements();
    console.log('Elements initialized:', this.elements);
    this.bindEvents();
    console.log('Events bound');
    
    console.log('Calling loadSavedData...');
    this.loadSavedData().then(() => {
      console.log('Calling populateVoices...');
      this.populateVoices();
      console.log('Loading highlighting settings...');
      this.loadHighlightingSettings();
    });
    console.log('Constructor completed');
  }

  // Initialize DOM elements
  initializeElements() {
    console.log('initializeElements called');
    const elements = {
      voiceSelect: document.getElementById('voiceSelect'),
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
      wordCompatibility: document.getElementById('wordCompatibility'),
      // Global elements
      autoScrollToggle: document.getElementById('autoScrollToggle'),
      animationToggle: document.getElementById('animationToggle')
    };
    
    console.log('Elements found:', {
      voiceSelect: !!elements.voiceSelect,
      rateRange: !!elements.rateRange,
      rateValue: !!elements.rateValue,
      textArea: !!elements.textArea,
      speakBtn: !!elements.speakBtn,
      stopBtn: !!elements.stopBtn,
      settingsBtn: !!elements.settingsBtn,
      settingsPanel: !!elements.settingsPanel,
      closeSettingsBtn: !!elements.closeSettingsBtn
    });
    
    return elements;
  }

  // Bind event listeners
  bindEvents() {
    this.elements.textArea.addEventListener('input', () => this.saveText());
    this.elements.voiceSelect.addEventListener('change', () => this.saveVoice());
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
  }

  // Load saved data from storage, but prefer selected text from the active tab if available
  loadSavedData() {
    return new Promise((resolve) => {
      console.log('Loading saved data...');
      // Try to get selected text from the background script
      chrome.runtime.sendMessage({ type: 'getSelectedText' }, (response) => {
        console.log('getSelectedText response:', response);
        if (response && response.status === 'success' && response.selectedText) {
          console.log('Found selected text:', response.selectedText);
          this._pendingSpeakText = response.selectedText;
          // Don't set textarea or speak yet; wait for voices and selected voice
          this._loadTextFromStorage(resolve);
          return;
        }
        console.log('No selected text found, using saved/default text');
        // Fallback to saved/default text
        this._loadTextFromStorage(resolve);
      });
    });
  }

  // Helper to load text from storage
  _loadTextFromStorage(callback) {
    chrome.storage.sync.get(['ttsText', 'selectedVoice', 'speechRate'], (result) => {
      console.log('Loading from storage:', result);
      
      // Show loading status in the rate value display
      this.elements.rateValue.textContent = 'Loading...';
      
      // Always load speech rate first
      if (result.speechRate !== undefined) {
        console.log('Setting speech rate to:', result.speechRate);
        this.elements.rateRange.value = result.speechRate;
        this.elements.rateValue.textContent = result.speechRate;
        console.log('Rate range value after setting:', this.elements.rateRange.value);
        console.log('Rate value text after setting:', this.elements.rateValue.textContent);
      } else {
        console.log('No saved speech rate found, using default');
        this.elements.rateRange.value = 1.0;
        this.elements.rateValue.textContent = '1.0 (default)';
      }
      
      if (this._pendingSpeakText) {
        // Set the textarea with selected text
        console.log('Setting textarea with selected text:', this._pendingSpeakText);
        this.elements.textArea.value = this._pendingSpeakText;
        console.log('Textarea value after setting:', this.elements.textArea.value);
        // We'll speak after voices are loaded and selected voice is restored
        this._pendingVoiceToRestore = result.selectedVoice;
        
        // Add a verification check after a short delay
        setTimeout(() => {
          console.log('Verification - textarea value after delay:', this.elements.textArea.value);
          console.log('Verification - pending speak text:', this._pendingSpeakText);
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

  // Save selected voice to storage
  saveVoice() {
    chrome.storage.sync.set({ selectedVoice: this.elements.voiceSelect.value });
  }

  // Update rate display and save to storage
  updateRate() {
    const rate = this.elements.rateRange.value;
    console.log('Updating rate to:', rate);
    this.elements.rateValue.textContent = rate;
    chrome.storage.sync.set({ speechRate: rate }, () => {
      console.log('Rate saved to storage:', rate);
    });
  }

  // Populate voice dropdown
  populateVoices() {
    console.log('populateVoices called');
    
    // Set a timeout to ensure we don't wait forever for voices
    const voiceTimeout = setTimeout(() => {
      console.log('Voice loading timeout reached');
      if (this._pendingSpeakText && !this._autoSpeakTriggered) {
        console.log('Timeout: attempting to speak with default voice');
        this._autoSpeakTriggered = true;
        this.speak();
        this._pendingSpeakText = null;
      }
    }, 3000); // 3 second timeout
    
    console.log('Sending getVoices message to background...');
    chrome.runtime.sendMessage({ type: 'getVoices' }, (response) => {
      console.log('getVoices callback received, response:', response);
      console.log('chrome.runtime.lastError:', chrome.runtime.lastError);
      
      clearTimeout(voiceTimeout); // Clear timeout if we get a response
      
      if (chrome.runtime.lastError) {
        console.error('Runtime error in getVoices:', chrome.runtime.lastError);
      }
      
      console.log('getVoices response:', response);
      if (response && response.status === 'success') {
        console.log('Voices loaded successfully, count:', response.voices.length);
        this.populateVoiceOptions(response.voices);
        this.restoreSelectedVoice(() => {
          console.log('Selected voice restored, checking for pending speak text...');
          // If we have pending selected text to speak, do it now
          if (this._pendingSpeakText && !this._autoSpeakTriggered) {
            console.log('Auto-speaking with rate:', this.elements.rateRange.value);
            this._autoSpeakTriggered = true;
            this.speak();
            this._pendingSpeakText = null;
          } else {
            console.log('No pending speak text found');
          }
        });
      } else {
        console.error('Failed to get voices:', response?.error);
        this.showError('Failed to load voices: ' + (response?.error || 'Unknown error'));
        // Fallback: if we have pending text to speak, try to speak anyway
        if (this._pendingSpeakText && !this._autoSpeakTriggered) {
          console.log('Voices failed to load, but attempting to speak with default voice');
          this._autoSpeakTriggered = true;
          this.speak();
          this._pendingSpeakText = null;
        }
      }
    });
  }

  // Populate voice options in dropdown
  populateVoiceOptions(voices) {
    this.elements.voiceSelect.innerHTML = '';
    
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceName;
      option.textContent = `${voice.voiceName} (${voice.lang})${voice.default ? ' [default]' : ''}`;
      this.elements.voiceSelect.appendChild(option);
    });
  }

  // Restore previously selected voice, then call callback
  restoreSelectedVoice(callback) {
    console.log('restoreSelectedVoice called');
    chrome.storage.sync.get(['selectedVoice'], (result) => {
      console.log('Restoring voice from storage:', result);
      if (result.selectedVoice !== undefined) {
        this.elements.voiceSelect.value = result.selectedVoice;
        console.log('Voice restored to:', result.selectedVoice);
      } else {
        console.log('No saved voice found, using default');
      }
      if (typeof callback === 'function') {
        console.log('Calling restoreSelectedVoice callback');
        callback();
      }
    });
  }

  // Speak the text
  speak() {
    console.log('=== SPEAK METHOD CALLED ===');
    const text = this.elements.textArea.value.trim();
    console.log('Speak called, textarea value:', this.elements.textArea.value);
    console.log('Trimmed text:', text);
    
    if (!text) {
      this.showError('Please enter some text to speak');
      return;
    }

    const rate = parseFloat(this.elements.rateRange.value);
    console.log('Speaking with rate:', rate, 'Rate range value:', this.elements.rateRange.value);

    const message = {
      type: 'speak',
      text: text,
      rate: rate,
      voiceName: this.elements.voiceSelect.value
    };

    console.log('Sending message to background:', message);

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
    console.log('Showing settings panel');
    this.elements.settingsPanel.classList.add('active');
    document.body.classList.add('settings-open');
  }

  // Hide settings panel
  hideSettings() {
    console.log('Hiding settings panel');
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
    console.log('Loading highlighting settings...');
    chrome.runtime.sendMessage({ type: 'getHighlightingSettings' }, (response) => {
      if (response && response.status === 'success') {
        console.log('Loaded highlighting settings:', response.settings);
        this.applySettingsToUI(response.settings);
      } else {
        console.error('Failed to load highlighting settings:', response?.error);
      }
    });
  }

  // Apply settings to UI elements
  applySettingsToUI(settings) {
    console.log('Applying settings to UI:', settings);
    
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

  // Save settings to storage
  saveSettings() {
    console.log('Saving settings...');
    
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

    console.log('Settings to save:', settings);

    chrome.runtime.sendMessage({
      type: 'saveHighlightingSettings',
      settings: settings
    }, (response) => {
      if (response && response.status === 'success') {
        console.log('Settings saved successfully');
      } else {
        console.error('Failed to save settings:', response?.error);
        this.showError('Failed to save settings: ' + (response?.error || 'Unknown error'));
      }
    });
  }
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  try {
    console.log('Creating TTSController...');
    const controller = new TTSController();
    console.log('TTSController created successfully');
    
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