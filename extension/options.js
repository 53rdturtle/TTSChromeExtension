/**
 * Options page controller for TTS Extension
 * Manages full-page settings interface with tabbed navigation
 */

class OptionsController {
  constructor() {
    this.currentTab = 'general';
    this.settings = {};
    this.voices = [];
    this.unsavedChanges = false;
    
    this.init();
  }

  async init() {
    this.setupTabNavigation();
    this.setupEventListeners();
    await this.loadSettings();
    await this.loadVoices();
    this.populateForm();
    this.setupFormValidation();
  }

  // Tab Navigation
  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update active tab panel
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-tab`);
    });

    this.currentTab = tabId;

    // Load tab-specific data
    if (tabId === 'google-tts') {
      this.updateQuotaDisplay();
    }
  }

  // Event Listeners
  setupEventListeners() {
    // General tab
    document.getElementById('defaultVoice').addEventListener('change', () => this.markUnsaved());
    document.getElementById('defaultRate').addEventListener('input', this.updateRateDisplay.bind(this));
    document.getElementById('previewDefaultVoice').addEventListener('click', this.previewDefaultVoice.bind(this));

    // Highlighting tab
    document.getElementById('fullSelectionEnabled').addEventListener('change', this.toggleFullSelectionStyles.bind(this));
    document.getElementById('sentenceEnabled').addEventListener('change', this.toggleSentenceStyles.bind(this));
    document.getElementById('previewHighlighting').addEventListener('click', this.previewHighlighting.bind(this));
    
    // Style controls
    ['fullSelection', 'sentence'].forEach(mode => {
      ['Color', 'Opacity', 'Border'].forEach(property => {
        const element = document.getElementById(`${mode}${property}`);
        if (element) {
          element.addEventListener('change', () => {
            this.updateStylePreview(mode);
            this.markUnsaved();
          });
          if (property === 'Opacity') {
            element.addEventListener('input', () => this.updateOpacityDisplay(mode));
          }
        }
      });
    });

    // Google TTS tab
    document.getElementById('googleTTSEnabled').addEventListener('change', this.toggleGoogleTTS.bind(this));
    document.getElementById('googleAPIKey').addEventListener('input', () => this.markUnsaved());
    document.getElementById('testConnection').addEventListener('click', this.testGoogleTTSConnection.bind(this));
    document.getElementById('apiKeyHelp').addEventListener('click', this.showAPIKeyHelp.bind(this));

    // Advanced tab
    document.getElementById('exportSettings').addEventListener('click', this.exportSettings.bind(this));
    document.getElementById('importSettings').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', this.importSettings.bind(this));
    document.getElementById('resetSettings').addEventListener('click', this.resetSettings.bind(this));

    // Footer actions
    document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
    document.getElementById('cancelSettings').addEventListener('click', this.cancelSettings.bind(this));

    // Mark changes as unsaved for all form inputs
    document.querySelectorAll('input, select').forEach(element => {
      element.addEventListener('change', () => this.markUnsaved());
    });

    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.unsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  // Settings Management
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
        'highlightingSettings',
        'defaultVoice',
        'defaultRate',
        'googleTTSEnabled',
        'googleAPIKey',
        'googleVoiceQuality',
        'googleTTSThreshold',
        'announceStatus',
        'highContrast',
        'autoScroll',
        'animationEffects',
        'quotaWarnings',
        'autoFallback',
        'showNotifications',
        'pdfSupport',
        'googleDocsSupport',
        'crossPageNavigation',
        'perSiteSettings',
        'audioCaching',
        'maxCacheSize',
        'debugMode'
      ], (result) => {
        this.settings = {
          highlightingSettings: result.highlightingSettings || {
            fullSelection: {
              enabled: true,
              style: {
                backgroundColor: '#ffeb3b',
                opacity: 0.8,
                borderStyle: 'none'
              }
            },
            sentence: {
              enabled: false,
              style: {
                backgroundColor: '#4caf50',
                opacity: 0.7,
                borderStyle: 'solid'
              }
            },
            global: {
              autoScroll: true,
              animationEffects: true
            }
          },
          defaultVoice: result.defaultVoice || '',
          defaultRate: result.defaultRate || 1.0,
          googleTTSEnabled: result.googleTTSEnabled || false,
          googleAPIKey: result.googleAPIKey || '',
          googleVoiceQuality: result.googleVoiceQuality || 'neural2',
          googleTTSThreshold: result.googleTTSThreshold || 'never',
          announceStatus: result.announceStatus || false,
          highContrast: result.highContrast || false,
          autoScroll: result.autoScroll ?? true,
          animationEffects: result.animationEffects ?? true,
          quotaWarnings: result.quotaWarnings ?? true,
          autoFallback: result.autoFallback ?? true,
          showNotifications: result.showNotifications ?? true,
          pdfSupport: result.pdfSupport || false,
          googleDocsSupport: result.googleDocsSupport || false,
          crossPageNavigation: result.crossPageNavigation || false,
          perSiteSettings: result.perSiteSettings || false,
          audioCaching: result.audioCaching ?? true,
          maxCacheSize: result.maxCacheSize || 25,
          debugMode: result.debugMode || false
        };
        resolve();
      });
    });
  }

  async loadVoices() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'getVoices' }, (response) => {
        if (response && response.voices) {
          this.voices = response.voices;
          this.populateVoiceSelect();
        }
        resolve();
      });
    });
  }

  populateVoiceSelect() {
    const select = document.getElementById('defaultVoice');
    select.innerHTML = '<option value="">Select a voice...</option>';

    // Group voices by language
    const voicesByLanguage = this.groupVoicesByLanguage(this.voices);

    Object.entries(voicesByLanguage).forEach(([language, voices]) => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = this.getLanguageDisplayName(language);

      voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${this.getQualityBadge(voice.quality, voice.isGoogle)} ${voice.name}`;
        optGroup.appendChild(option);
      });

      select.appendChild(optGroup);
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

  populateForm() {
    // General tab
    document.getElementById('defaultVoice').value = this.settings.defaultVoice;
    document.getElementById('defaultRate').value = this.settings.defaultRate;
    document.getElementById('announceStatus').checked = this.settings.announceStatus;
    document.getElementById('highContrast').checked = this.settings.highContrast;

    // Highlighting tab
    const highlighting = this.settings.highlightingSettings;
    
    document.getElementById('fullSelectionEnabled').checked = highlighting.fullSelection.enabled;
    document.getElementById('fullSelectionColor').value = highlighting.fullSelection.style.backgroundColor;
    document.getElementById('fullSelectionOpacity').value = highlighting.fullSelection.style.opacity;
    document.getElementById('fullSelectionBorder').value = highlighting.fullSelection.style.borderStyle;

    document.getElementById('sentenceEnabled').checked = highlighting.sentence.enabled;
    document.getElementById('sentenceColor').value = highlighting.sentence.style.backgroundColor;
    document.getElementById('sentenceOpacity').value = highlighting.sentence.style.opacity;
    document.getElementById('sentenceBorder').value = highlighting.sentence.style.borderStyle;

    document.getElementById('autoScroll').checked = highlighting.global.autoScroll;
    document.getElementById('animationEffects').checked = highlighting.global.animationEffects;

    // Google TTS tab
    document.getElementById('googleTTSEnabled').checked = this.settings.googleTTSEnabled;
    document.getElementById('googleAPIKey').value = this.settings.googleAPIKey;
    document.getElementById('googleVoiceQuality').value = this.settings.googleVoiceQuality;
    document.getElementById('googleTTSThreshold').value = this.settings.googleTTSThreshold;
    document.getElementById('quotaWarnings').checked = this.settings.quotaWarnings;
    document.getElementById('autoFallback').checked = this.settings.autoFallback;
    document.getElementById('showNotifications').checked = this.settings.showNotifications;

    // Advanced tab
    document.getElementById('pdfSupport').checked = this.settings.pdfSupport;
    document.getElementById('googleDocsSupport').checked = this.settings.googleDocsSupport;
    document.getElementById('crossPageNavigation').checked = this.settings.crossPageNavigation;
    document.getElementById('perSiteSettings').checked = this.settings.perSiteSettings;
    document.getElementById('audioCaching').checked = this.settings.audioCaching;
    document.getElementById('maxCacheSize').value = this.settings.maxCacheSize;
    document.getElementById('debugMode').checked = this.settings.debugMode;

    // Update displays
    this.updateRateDisplay();
    this.updateOpacityDisplay('fullSelection');
    this.updateOpacityDisplay('sentence');
    this.toggleFullSelectionStyles();
    this.toggleSentenceStyles();
    this.toggleGoogleTTS();
  }

  // UI Updates
  updateRateDisplay() {
    const rate = document.getElementById('defaultRate').value;
    document.getElementById('defaultRateValue').textContent = `${rate}x`;
  }

  updateOpacityDisplay(mode) {
    const opacity = document.getElementById(`${mode}Opacity`).value;
    document.getElementById(`${mode}OpacityValue`).textContent = `${Math.round(opacity * 100)}%`;
  }

  toggleFullSelectionStyles() {
    const enabled = document.getElementById('fullSelectionEnabled').checked;
    const styles = document.getElementById('fullSelectionStyles');
    styles.style.display = enabled ? 'block' : 'none';
  }

  toggleSentenceStyles() {
    const enabled = document.getElementById('sentenceEnabled').checked;
    const styles = document.getElementById('sentenceStyles');
    styles.style.display = enabled ? 'block' : 'none';
  }

  toggleGoogleTTS() {
    const enabled = document.getElementById('googleTTSEnabled').checked;
    const sections = document.querySelectorAll('#google-tts-tab .setting-section:not(:first-child)');
    sections.forEach(section => {
      section.style.opacity = enabled ? '1' : '0.5';
      section.style.pointerEvents = enabled ? 'auto' : 'none';
    });
  }

  // Google TTS Functions
  async updateQuotaDisplay() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getQuotaUsage' });
      if (response && response.usage !== undefined) {
        const percentage = Math.round((response.usage / 1000000) * 100);
        document.getElementById('quotaText').textContent = 
          `Usage: ${response.usage.toLocaleString()} / 1,000,000 characters (${percentage}%)`;
        document.getElementById('quotaProgress').style.width = `${percentage}%`;
        
        // Update quota bar color based on usage
        const quotaBar = document.getElementById('quotaProgress');
        if (percentage >= 95) {
          quotaBar.style.backgroundColor = '#f44336';
        } else if (percentage >= 80) {
          quotaBar.style.backgroundColor = '#ff9800';
        } else {
          quotaBar.style.backgroundColor = '#4caf50';
        }
      }
    } catch (error) {
      console.error('Failed to load quota:', error);
      document.getElementById('quotaText').textContent = 'Usage: Unable to load';
    }
  }

  async testGoogleTTSConnection() {
    const button = document.getElementById('testConnection');
    const apiKey = document.getElementById('googleAPIKey').value;
    
    if (!apiKey.trim()) {
      this.showNotification('Please enter an API key first', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Testing...';

    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'testGoogleTTS', 
        apiKey: apiKey 
      });
      
      if (response && response.success) {
        this.showNotification('Connection successful!', 'success');
      } else {
        this.showNotification(response.error || 'Connection failed', 'error');
      }
    } catch (error) {
      this.showNotification('Connection test failed', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Test Connection';
    }
  }

  showAPIKeyHelp() {
    const helpContent = `
      <h3>How to get a Google Cloud API key:</h3>
      <ol>
        <li>Visit <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></li>
        <li>Create a new project or select an existing one</li>
        <li>Enable the Text-to-Speech API</li>
        <li>Go to APIs & Services → Credentials</li>
        <li>Click "Create Credentials" → "API Key"</li>
        <li>Copy the generated API key</li>
      </ol>
      <p><strong>Free Tier:</strong> 1 million characters per month</p>
    `;
    this.showModal('Google Cloud API Key Help', helpContent);
  }

  // Preview Functions
  async previewDefaultVoice() {
    const voiceName = document.getElementById('defaultVoice').value;
    const rate = document.getElementById('defaultRate').value;
    
    if (!voiceName) {
      this.showNotification('Please select a voice first', 'warning');
      return;
    }

    const text = 'This is a preview of the selected voice at the chosen speech rate.';
    
    try {
      await chrome.runtime.sendMessage({
        type: 'previewVoice',
        text: text,
        voiceName: voiceName,
        rate: parseFloat(rate)
      });
    } catch (error) {
      this.showNotification('Voice preview failed', 'error');
    }
  }

  previewHighlighting() {
    const previewText = document.getElementById('previewText');
    
    // Apply current full selection styling
    if (document.getElementById('fullSelectionEnabled').checked) {
      const color = document.getElementById('fullSelectionColor').value;
      const opacity = document.getElementById('fullSelectionOpacity').value;
      previewText.style.backgroundColor = this.hexToRgba(color, opacity);
    } else {
      previewText.style.backgroundColor = '';
    }

    // Flash effect to show highlighting
    previewText.classList.add('preview-flash');
    setTimeout(() => {
      previewText.classList.remove('preview-flash');
    }, 1000);
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Settings Actions
  async saveSettings() {
    const formData = this.collectFormData();
    
    try {
      await chrome.storage.sync.set(formData);
      this.settings = { ...this.settings, ...formData };
      this.unsavedChanges = false;
      this.showNotification('Settings saved successfully!', 'success');
      
      // Update save button
      const saveButton = document.getElementById('saveSettings');
      saveButton.textContent = 'Saved!';
      setTimeout(() => {
        saveButton.textContent = 'Save Settings';
      }, 2000);
      
    } catch (error) {
      this.showNotification('Failed to save settings', 'error');
    }
  }

  collectFormData() {
    return {
      highlightingSettings: {
        fullSelection: {
          enabled: document.getElementById('fullSelectionEnabled').checked,
          style: {
            backgroundColor: document.getElementById('fullSelectionColor').value,
            opacity: parseFloat(document.getElementById('fullSelectionOpacity').value),
            borderStyle: document.getElementById('fullSelectionBorder').value
          }
        },
        sentence: {
          enabled: document.getElementById('sentenceEnabled').checked,
          style: {
            backgroundColor: document.getElementById('sentenceColor').value,
            opacity: parseFloat(document.getElementById('sentenceOpacity').value),
            borderStyle: document.getElementById('sentenceBorder').value
          }
        },
        global: {
          autoScroll: document.getElementById('autoScroll').checked,
          animationEffects: document.getElementById('animationEffects').checked
        }
      },
      defaultVoice: document.getElementById('defaultVoice').value,
      defaultRate: parseFloat(document.getElementById('defaultRate').value),
      googleTTSEnabled: document.getElementById('googleTTSEnabled').checked,
      googleAPIKey: document.getElementById('googleAPIKey').value,
      googleVoiceQuality: document.getElementById('googleVoiceQuality').value,
      googleTTSThreshold: document.getElementById('googleTTSThreshold').value,
      announceStatus: document.getElementById('announceStatus').checked,
      highContrast: document.getElementById('highContrast').checked,
      quotaWarnings: document.getElementById('quotaWarnings').checked,
      autoFallback: document.getElementById('autoFallback').checked,
      showNotifications: document.getElementById('showNotifications').checked,
      pdfSupport: document.getElementById('pdfSupport').checked,
      googleDocsSupport: document.getElementById('googleDocsSupport').checked,
      crossPageNavigation: document.getElementById('crossPageNavigation').checked,
      perSiteSettings: document.getElementById('perSiteSettings').checked,
      audioCaching: document.getElementById('audioCaching').checked,
      maxCacheSize: parseInt(document.getElementById('maxCacheSize').value),
      debugMode: document.getElementById('debugMode').checked
    };
  }

  cancelSettings() {
    if (this.unsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    window.close();
  }

  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.sync.clear();
      await this.loadSettings();
      this.populateForm();
      this.unsavedChanges = false;
      this.showNotification('Settings reset to defaults', 'success');
    } catch (error) {
      this.showNotification('Failed to reset settings', 'error');
    }
  }

  // Import/Export
  exportSettings() {
    const data = JSON.stringify(this.settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts-extension-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showNotification('Settings exported successfully', 'success');
  }

  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      
      // Validate the imported settings structure
      if (!this.validateSettingsStructure(importedSettings)) {
        this.showNotification('Invalid settings file format', 'error');
        return;
      }

      if (confirm('This will overwrite your current settings. Continue?')) {
        await chrome.storage.sync.set(importedSettings);
        await this.loadSettings();
        this.populateForm();
        this.unsavedChanges = false;
        this.showNotification('Settings imported successfully', 'success');
      }
    } catch (error) {
      this.showNotification('Failed to import settings file', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  validateSettingsStructure(settings) {
    // Basic validation to ensure the imported data has expected structure
    return settings && 
           typeof settings === 'object' &&
           settings.highlightingSettings &&
           typeof settings.highlightingSettings === 'object';
  }

  // Utility Functions
  markUnsaved() {
    this.unsavedChanges = true;
    const saveButton = document.getElementById('saveSettings');
    if (!saveButton.classList.contains('unsaved')) {
      saveButton.classList.add('unsaved');
      saveButton.textContent = 'Save Settings*';
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  showModal(title, content) {
    // Simple modal implementation
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal events
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  setupFormValidation() {
    // Add real-time validation for API key format
    const apiKeyInput = document.getElementById('googleAPIKey');
    apiKeyInput.addEventListener('input', () => {
      const value = apiKeyInput.value.trim();
      const isValid = !value || /^[A-Za-z0-9_-]+$/.test(value);
      apiKeyInput.classList.toggle('invalid', !isValid);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});