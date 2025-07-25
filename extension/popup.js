// TTS Chrome Extension Popup Controller - Simplified Version

class TTSController {
  constructor() {
    this.elements = this.initializeElements();
    this.bindEvents();
    
    this.loadSavedData().then(() => {
      this.populateVoices();
      this.checkQuotaStatus();
    });
    
    // Listen for storage changes to refresh voice list if favorites change
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.favoriteVoices) {
        this.populateVoices();
      }
    });
  }

  // Initialize DOM elements (simplified)
  initializeElements() {
    return {
      voiceSelect: document.getElementById('voiceSelect'),
      previewVoiceBtn: document.getElementById('previewVoiceBtn'),
      rateRange: document.getElementById('rateRange'),
      rateValue: document.getElementById('rateValue'),
      textArea: document.getElementById('text'),
      speakBtn: document.getElementById('speakBtn'),
      stopBtn: document.getElementById('stopBtn'),
      advancedSettingsBtn: document.getElementById('advancedSettingsBtn'),
      statusIndicator: document.getElementById('statusIndicator')
    };
  }

  // Bind event listeners (simplified)
  bindEvents() {
    this.elements.textArea.addEventListener('input', () => this.saveText());
    this.elements.voiceSelect.addEventListener('change', () => this.onVoiceChange());
    this.elements.previewVoiceBtn.addEventListener('click', () => this.previewVoice());
    this.elements.rateRange.addEventListener('input', () => this.updateRate());
    this.elements.speakBtn.addEventListener('click', () => this.speak());
    this.elements.stopBtn.addEventListener('click', () => this.stop());
    this.elements.advancedSettingsBtn.addEventListener('click', () => this.openAdvancedSettings());
  }

  // Load saved data from storage, but prefer selected text from the active tab if available
  loadSavedData() {
    return new Promise((resolve) => {
      // First try to get selected text from the active tab
      chrome.runtime.sendMessage({ type: 'getSelectedText' }, (response) => {
        console.log('🔍 getSelectedText response:', response);
        if (chrome.runtime.lastError) {
          console.warn('Error getting selected text:', chrome.runtime.lastError);
          // Continue with loading saved text
        } else if (response && response.selectedText && response.selectedText.trim()) {
          console.log('✅ Found selected text:', response.selectedText.substring(0, 50) + '...');
          this.elements.textArea.value = response.selectedText;
          
          // Auto-speak the selected text after a short delay to ensure popup is ready
          setTimeout(() => {
            this.autoSpeak();
          }, 100);
        } else {
          console.log('❌ No selected text found, loading saved text');
          // If no selected text, load saved text
          chrome.storage.sync.get(['savedText'], (result) => {
            if (result.savedText) {
              this.elements.textArea.value = result.savedText;
            }
          });
        }

        // Load other saved data
        chrome.storage.sync.get(['savedVoice', 'savedRate'], (result) => {
          if (result.savedVoice) {
            this.elements.voiceSelect.value = result.savedVoice;
          }
          if (result.savedRate) {
            this.elements.rateRange.value = result.savedRate;
            this.updateRate();
          }
          resolve();
        });
      });
    });
  }

  // Populate voices dropdown with enhanced formatting
  populateVoices() {
    chrome.runtime.sendMessage({ type: 'getVoices' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting voices:', chrome.runtime.lastError);
        return;
      }
      if (response && response.voices) {
        // Check if there are favorite voices - if so, show only favorites
        chrome.storage.sync.get(['favoriteVoices', 'savedVoice'], (settings) => {
          let voicesToShow = response.voices;
          
          if (settings.favoriteVoices && settings.favoriteVoices.length > 0) {
            // Filter to only show favorite voices
            const favoriteVoices = response.voices.filter(voice => 
              settings.favoriteVoices.includes(voice.name)
            );
            
            // If matching favorites exist, use them
            if (favoriteVoices.length > 0) {
              voicesToShow = favoriteVoices;
              
              // Always include the currently selected voice if it exists and isn't already included
              if (settings.savedVoice) {
                const selectedVoice = response.voices.find(voice => voice.name === settings.savedVoice);
                if (selectedVoice && !voicesToShow.find(voice => voice.name === settings.savedVoice)) {
                  voicesToShow.unshift(selectedVoice); // Add to beginning of list
                }
              }
            }
          }
          
          this.populateVoiceOptions(voicesToShow);
          this.elements.previewVoiceBtn.disabled = false;
        });
      }
    });
  }

  populateVoiceOptions(voices) {
    this.elements.voiceSelect.innerHTML = '';
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
        optGroup.appendChild(option);
      });
      
      this.elements.voiceSelect.appendChild(optGroup);
    });
    
    // Restore saved voice selection
    chrome.storage.sync.get(['savedVoice'], (result) => {
      if (result.savedVoice) {
        this.elements.voiceSelect.value = result.savedVoice;
      }
    });
  }

  groupVoicesByLanguage(voices) {
    const grouped = {};
    voices.forEach(voice => {
      const lang = voice.lang || 'unknown';
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push(voice);
    });

    // Sort within each language by quality then name
    Object.keys(grouped).forEach(lang => {
      grouped[lang].sort((a, b) => {
        const qualityOrder = ['Chirp3', 'Neural2', 'Studio', 'WaveNet', 'Standard'];
        const aIndex = qualityOrder.indexOf(a.quality);
        const bIndex = qualityOrder.indexOf(b.quality);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.name.localeCompare(b.name);
      });
    });

    return grouped;
  }

  getLanguageDisplayName(langCode) {
    const languages = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'en-AU': 'English (Australia)',
      'es-ES': 'Spanish (Spain)',
      'es-US': 'Spanish (US)',
      'fr-FR': 'French',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'zh-CN': 'Chinese (Simplified)',
      'pt-BR': 'Portuguese (Brazil)'
    };
    return languages[langCode] || langCode;
  }

  getQualityBadge(quality, isGoogle) {
    if (!isGoogle) return '📻';
    
    const badges = {
      'Chirp3': '🎭',
      'Neural2': '🎵',
      'Studio': '🎬',
      'WaveNet': '🌊',
      'Standard': '📻'
    };
    return badges[quality] || '📻';
  }

  getGenderIcon(gender) {
    const icons = {
      'male': '♂',
      'female': '♀',
      'neutral': '◇'
    };
    return icons[gender] || '';
  }

  // Preview voice functionality
  previewVoice() {
    const selectedVoice = this.elements.voiceSelect.value;
    const rate = parseFloat(this.elements.rateRange.value);
    
    if (!selectedVoice) {
      this.showStatus('Please select a voice first', 'error');
      return;
    }

    const previewText = 'This is a preview of the selected voice.';
    this.elements.previewVoiceBtn.disabled = true;
    this.elements.previewVoiceBtn.textContent = '⏸️';

    chrome.runtime.sendMessage({
      type: 'speak',
      text: previewText,
      voiceName: selectedVoice,
      rate: rate
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error in voice preview:', chrome.runtime.lastError);
      }
      setTimeout(() => {
        this.elements.previewVoiceBtn.disabled = false;
        this.elements.previewVoiceBtn.textContent = '🔊';
      }, 2000);
    });
  }

  // Update rate display
  updateRate() {
    const rate = this.elements.rateRange.value;
    this.elements.rateValue.textContent = `${rate}x`;
    this.saveRate();
  }

  // Voice change handler
  onVoiceChange() {
    this.saveVoice();
  }

  // Auto-speak functionality (triggered when popup opens with selected text)
  autoSpeak() {
    console.log('🚀 Auto-speaking selected text');
    
    // Check if voices are loaded, if not wait a bit
    if (!this.elements.voiceSelect.value) {
      console.log('⏳ Waiting for voices to load...');
      setTimeout(() => this.autoSpeak(), 200);
      return;
    }
    
    this.speak();
  }

  // Speak functionality
  speak() {
    const text = this.elements.textArea.value.trim();
    const voiceName = this.elements.voiceSelect.value;
    const rate = parseFloat(this.elements.rateRange.value);

    console.log('🎤 Speak button clicked:', { text: text.substring(0, 50) + '...', voiceName, rate });

    if (!text) {
      this.showStatus('Please enter some text to speak', 'error');
      return;
    }

    if (!voiceName) {
      this.showStatus('Please select a voice', 'error');
      return;
    }

    this.elements.speakBtn.disabled = true;
    this.elements.stopBtn.disabled = false;
    this.showStatus('Speaking...', 'speaking');

    console.log('📤 Sending speak message to background script');

    chrome.runtime.sendMessage({
      type: 'speak',
      text: text,
      voiceName: voiceName,
      rate: rate
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting speech:', chrome.runtime.lastError);
        this.showStatus('Error: Could not start speech', 'error');
        this.resetButtons();
      } else if (response && response.status === 'speaking') {
        // Speech started successfully
      } else {
        this.showStatus('Error: Could not start speech', 'error');
        this.resetButtons();
      }
    });

    // Listen for speech end
    this.listenForSpeechEnd();
  }

  // Stop functionality
  stop() {
    chrome.runtime.sendMessage({ type: 'stop' }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error stopping speech:', chrome.runtime.lastError);
      }
      this.showStatus('Stopped');
      this.resetButtons();
    });
  }

  // Open advanced settings page
  openAdvancedSettings() {
    chrome.runtime.openOptionsPage();
  }

  // Check Google TTS quota status and show warnings if needed
  async checkQuotaStatus() {
    try {
      // Only check if Google TTS is enabled
      chrome.storage.sync.get(['googleTTSEnabled'], async (settings) => {
        if (!settings.googleTTSEnabled) return;

        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'getQuotaUsage' }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Error checking quota status:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });
        if (response && response.status === 'success' && response.quota) {
          this.showQuotaWarningIfNeeded(response.quota);
        }
      });
    } catch (error) {
      console.error('Error checking quota status:', error);
    }
  }

  showQuotaWarningIfNeeded(quotaData) {
    const statusIndicator = this.elements.statusIndicator;
    
    if (quotaData.percentage >= 95) {
      statusIndicator.textContent = `⚠️ Google TTS quota at ${quotaData.percentage.toFixed(0)}%`;
      statusIndicator.style.color = '#dc3545';
      statusIndicator.style.display = 'block';
    } else if (quotaData.percentage >= 80) {
      statusIndicator.textContent = `⚠️ Google TTS quota at ${quotaData.percentage.toFixed(0)}%`;
      statusIndicator.style.color = '#ffc107';
      statusIndicator.style.display = 'block';
    } else {
      statusIndicator.style.display = 'none';
    }
  }

  // Listen for speech end events
  listenForSpeechEnd() {
    const checkSpeechStatus = () => {
      chrome.runtime.sendMessage({ type: 'getSpeechStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Error checking speech status:', chrome.runtime.lastError);
          this.resetButtons();
          return;
        }
        if (response && response.status === 'ended') {
          this.showStatus('Finished');
          this.resetButtons();
        } else if (response && response.status === 'speaking') {
          setTimeout(checkSpeechStatus, 500);
        } else {
          this.resetButtons();
        }
      });
    };
    
    setTimeout(checkSpeechStatus, 500);
  }

  // Reset button states
  resetButtons() {
    this.elements.speakBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
  }

  // Show status message
  showStatus(message, type = '') {
    this.elements.statusIndicator.textContent = message;
    this.elements.statusIndicator.className = `status-indicator ${type}`;
    
    // Clear status after 3 seconds for non-error messages
    if (type !== 'error' && type !== 'speaking') {
      setTimeout(() => {
        this.elements.statusIndicator.textContent = '';
        this.elements.statusIndicator.className = 'status-indicator';
      }, 3000);
    }
  }

  // Save functions
  saveText() {
    const text = this.elements.textArea.value;
    chrome.storage.sync.set({ savedText: text });
  }

  saveVoice() {
    const voice = this.elements.voiceSelect.value;
    chrome.storage.sync.set({ savedVoice: voice });
  }

  saveRate() {
    const rate = this.elements.rateRange.value;
    chrome.storage.sync.set({ savedRate: rate });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TTSController();
});