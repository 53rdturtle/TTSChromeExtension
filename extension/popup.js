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
      stopBtn: document.getElementById('stopBtn')
    };
    
    console.log('Elements found:', {
      voiceSelect: !!elements.voiceSelect,
      rateRange: !!elements.rateRange,
      rateValue: !!elements.rateValue,
      textArea: !!elements.textArea,
      speakBtn: !!elements.speakBtn,
      stopBtn: !!elements.stopBtn
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