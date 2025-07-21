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
    await this.loadQuotaUsage();
    
    // Update quota every 30 seconds
    setInterval(() => {
      this.loadQuotaUsage();
    }, 30000);
  }

  // Tab Navigation
  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Find the actual button element (in case user clicked on icon or label)
        const buttonElement = e.target.closest('.tab-btn');
        const tabId = buttonElement ? buttonElement.dataset.tab : e.target.dataset.tab;
        if (tabId) {
          this.switchTab(tabId);
        }
      });
    });
  }

  switchTab(tabId) {
    console.log('Switching to tab:', tabId); // Debug log
    
    if (!tabId) {
      console.error('No tabId provided to switchTab');
      return;
    }
    
    // Update active tab button
    let foundActiveButton = false;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      if (isActive) foundActiveButton = true;
    });
    
    if (!foundActiveButton) {
      console.warn(`No button found for tab: ${tabId}`);
    }

    // Update active tab panel
    let foundActivePanel = false;
    document.querySelectorAll('.tab-panel').forEach(panel => {
      const isActive = panel.id === `${tabId}-tab`;
      panel.classList.toggle('active', isActive);
      if (isActive) {
        foundActivePanel = true;
        console.log(`Activated panel: ${panel.id}`); // Debug log
      }
    });
    
    if (!foundActivePanel) {
      console.error(`No panel found for tab: ${tabId}-tab`);
      // Fallback: show the first panel if none matched
      const firstPanel = document.querySelector('.tab-panel');
      if (firstPanel) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        firstPanel.classList.add('active');
        console.log('Fallback: showing first panel');
      }
    }

    this.currentTab = tabId;

    // Load tab-specific data
    if (tabId === 'google-tts') {
      this.updateQuotaDisplay();
    } else if (tabId === 'voices') {
      this.loadVoiceBrowser();
    }
  }

  // Event Listeners
  setupEventListeners() {
    // General tab (moved to voices tab)
    // Voice selection tab
    document.getElementById('defaultVoice').addEventListener('change', () => this.markUnsaved());
    document.getElementById('defaultRate').addEventListener('input', this.updateRateDisplay.bind(this));
    document.getElementById('previewDefaultVoice').addEventListener('click', this.previewDefaultVoice.bind(this));
    
    // Voice browser filters
    document.getElementById('voiceLanguageFilter').addEventListener('change', this.filterVoices.bind(this));
    document.getElementById('voiceQualityFilter').addEventListener('change', this.filterVoices.bind(this));
    document.getElementById('voiceGenderFilter').addEventListener('change', this.filterVoices.bind(this));
    document.getElementById('voiceServiceFilter').addEventListener('change', this.filterVoices.bind(this));
    document.getElementById('refreshVoices').addEventListener('click', this.refreshVoices.bind(this));
    
    // Voice testing section removed
    
    // Voice preferences (favorites are automatic)
    document.getElementById('autoSelectBestVoice').addEventListener('change', () => this.markUnsaved());
    document.getElementById('showVoiceCompatibility').addEventListener('change', this.toggleCompatibilityDisplay.bind(this));
    document.getElementById('rememberVoicePerLanguage').addEventListener('change', () => this.markUnsaved());
    
    // Favorites management section removed
    document.getElementById('voiceFavoriteFilter').addEventListener('change', this.filterVoices.bind(this));

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
    document.getElementById('applyBackfill').addEventListener('click', this.applyQuotaBackfill.bind(this));

    // Advanced tab
    document.getElementById('exportSettings').addEventListener('click', this.exportSettings.bind(this));
    document.getElementById('importSettings').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', this.importSettings.bind(this));
    document.getElementById('resetSettings').addEventListener('click', this.resetSettings.bind(this));

    // Auto-save functionality - no manual save buttons needed

    // Mark changes as unsaved for all form inputs
    document.querySelectorAll('input, select').forEach(element => {
      element.addEventListener('change', () => this.markUnsaved());
    });

    // Auto-save handles all changes - no need for beforeunload warning
  }

  // Settings Management
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
        'highlightingSettings',
        'defaultVoice',
        'savedVoice', // Popup saves voice as 'savedVoice'
        'defaultRate',
        'favoriteVoices', // New: favorite voices list
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
        console.log('Raw storage result:', result); // Debug logging
        
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
          defaultVoice: result.savedVoice || result.defaultVoice || '',
          defaultRate: result.defaultRate || 1.0,
          favoriteVoices: result.favoriteVoices || [],
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
        if (chrome.runtime.lastError) {
          console.error('Error getting voices in options:', chrome.runtime.lastError);
          resolve();
          return;
        }
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

    // Restore the previously selected voice after populating the dropdown
    console.log('Available voices in dropdown:', Array.from(select.options).map(opt => opt.value));
    console.log('Attempting to restore voice:', this.settings.defaultVoice);
    
    if (this.settings.defaultVoice) {
      select.value = this.settings.defaultVoice;
      console.log('Voice dropdown value after setting:', select.value);
      console.log('Successfully restored voice selection:', this.settings.defaultVoice);
    } else {
      console.log('No default voice setting found, available settings:', this.settings);
    }
    
    // Mark voices as loaded
    this.voicesLoaded = true;
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
    // General tab (defaultVoice is now set in populateVoiceSelect after voices load)
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

    // Voice preferences (favorites are managed automatically)
    
    // Favorites management section removed

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
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getQuotaUsage' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting quota usage:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
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

  // Settings are auto-saved via markUnsaved() -> autoSave() method

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
      savedVoice: document.getElementById('defaultVoice').value, // Save to both keys for compatibility
      defaultRate: parseFloat(document.getElementById('defaultRate').value),
      favoriteVoices: this.settings.favoriteVoices, // Favorites are managed separately
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

  // No longer needed - auto-save handles all changes

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
    // Auto-save instead of marking unsaved
    this.autoSave();
  }

  async autoSave() {
    // Debounce auto-save to avoid too many rapid saves
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(async () => {
      try {
        const formData = this.collectFormData();
        await chrome.storage.sync.set(formData);
        this.settings = { ...this.settings, ...formData };
        this.unsavedChanges = false;
        
        // Show subtle auto-save indicator
        this.showAutoSaveIndicator();
        
      } catch (error) {
        console.error('Auto-save failed:', error);
        this.showNotification('Failed to auto-save settings', 'error');
      }
    }, 500); // 500ms debounce
  }

  showAutoSaveIndicator() {
    // Create or update auto-save indicator
    let indicator = document.getElementById('autoSaveIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'autoSaveIndicator';
      indicator.className = 'auto-save-indicator';
      indicator.innerHTML = '✓ Auto-saved';
      document.querySelector('.options-header').appendChild(indicator);
    }
    
    // Show the indicator
    indicator.style.opacity = '1';
    indicator.style.transform = 'translateY(0)';
    
    // Hide it after 2 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-10px)';
    }, 2000);
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

  // Voice Selection Tab Methods
  async loadVoiceBrowser() {
    if (!this.voicesLoaded) {
      await this.loadVoices();
    }
    this.populateVoiceFilters();
    this.renderVoiceList();
  }

  populateVoiceFilters() {
    const languages = new Set();
    const qualities = new Set();
    const genders = new Set();
    const services = new Set();

    this.voices.forEach(voice => {
      languages.add(voice.lang);
      qualities.add(voice.quality);
      genders.add(voice.gender);
      services.add(voice.isGoogle ? 'google' : 'chrome');
    });

    // Populate language filter
    const langFilter = document.getElementById('voiceLanguageFilter');
    langFilter.innerHTML = '<option value="">All Languages</option>';
    Array.from(languages).sort().forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = this.getLanguageDisplayName(lang);
      langFilter.appendChild(option);
    });

    // Populate gender filter (if not already done)
    const genderFilter = document.getElementById('voiceGenderFilter');
    genderFilter.innerHTML = '<option value="">All Genders</option>';
    Array.from(genders).forEach(gender => {
      if (gender && gender !== 'unknown') {
        const option = document.createElement('option');
        option.value = gender;
        option.textContent = gender === 'male' ? '♂ Male' : 
                            gender === 'female' ? '♀ Female' : '◇ Neutral';
        genderFilter.appendChild(option);
      }
    });
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

  filterVoices() {
    const langFilter = document.getElementById('voiceLanguageFilter').value;
    const qualityFilter = document.getElementById('voiceQualityFilter').value;
    const genderFilter = document.getElementById('voiceGenderFilter').value;
    const serviceFilter = document.getElementById('voiceServiceFilter').value;
    const favoriteFilter = document.getElementById('voiceFavoriteFilter').value;

    this.filteredVoices = this.voices.filter(voice => {
      if (langFilter && voice.lang !== langFilter) return false;
      if (qualityFilter && voice.quality !== qualityFilter) return false;
      if (genderFilter && voice.gender !== genderFilter) return false;
      if (serviceFilter) {
        const isGoogle = voice.isGoogle ? 'google' : 'chrome';
        if (isGoogle !== serviceFilter) return false;
      }
      if (favoriteFilter === 'favorites') {
        if (!this.settings.favoriteVoices.includes(voice.name)) return false;
      } else if (favoriteFilter === 'non-favorites') {
        if (this.settings.favoriteVoices.includes(voice.name)) return false;
      }
      return true;
    });

    this.renderVoiceList();
  }

  renderVoiceList() {
    const voiceList = document.getElementById('voiceList');
    const voiceCount = document.getElementById('voiceCount');
    const voices = this.filteredVoices || this.voices;

    voiceCount.textContent = `${voices.length} voices found`;

    if (voices.length === 0) {
      voiceList.innerHTML = '<div class="loading-voices">No voices match the current filters</div>';
      return;
    }

    voiceList.innerHTML = '';
    voices.forEach((voice, index) => {
      const voiceItem = this.createVoiceItem(voice, index);
      voiceList.appendChild(voiceItem);
    });
  }

  createVoiceItem(voice, index) {
    const item = document.createElement('div');
    item.className = 'voice-item';
    item.dataset.voiceIndex = index;

    const qualityBadge = this.getQualityBadge(voice.quality, voice.isGoogle);
    const genderIcon = this.getGenderIcon(voice.gender);
    const isFavorite = this.settings.favoriteVoices.includes(voice.name);

    item.innerHTML = `
      <div class="voice-info">
        <div class="voice-name">${voice.name}</div>
        <div class="voice-details">
          <span>${qualityBadge} ${voice.quality}</span>
          <span>${genderIcon} ${voice.gender || 'Unknown'}</span>
          <span>${voice.lang}</span>
          <span>${voice.isGoogle ? '🚀 Google' : '🌐 Chrome'}</span>
        </div>
      </div>
      <div class="voice-actions">
        <button class="voice-favorite-btn ${isFavorite ? 'favorited' : ''}" data-voice-index="${index}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
          ${isFavorite ? '⭐' : '☆'}
        </button>
        <button class="voice-preview-btn" data-voice-index="${index}">🔊 Preview</button>
      </div>
    `;

    // Add click handlers
    item.addEventListener('click', () => this.selectVoice(index));
    item.querySelector('.voice-favorite-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleVoiceFavorite(voice.name);
    });
    item.querySelector('.voice-preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.previewVoice(voice);
    });

    return item;
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

  selectVoice(index) {
    // Clear previous selection
    document.querySelectorAll('.voice-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Select new voice
    const voiceItem = document.querySelector(`[data-voice-index="${index}"]`);
    if (voiceItem) {
      voiceItem.classList.add('selected');
      this.selectedVoiceIndex = index;
    }
  }

  async previewVoice(voice) {
    const testText = document.getElementById('testText').value || 
                    'This is a preview of the selected voice.';
    const rate = parseFloat(document.getElementById('testRate').value) || 1.0;

    try {
      await chrome.runtime.sendMessage({
        type: 'speak',
        text: testText,
        voiceName: voice.name,
        rate: rate
      });
    } catch (error) {
      console.error('Error previewing voice:', error);
      this.showNotification('Error previewing voice', 'error');
    }
  }

  async refreshVoices() {
    const refreshBtn = document.getElementById('refreshVoices');
    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 Refreshing...';

    try {
      this.voicesLoaded = false;
      await this.loadVoices();
      this.populateVoiceFilters();
      this.renderVoiceList();
      this.showNotification('Voices refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing voices:', error);
      this.showNotification('Error refreshing voices', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Refresh';
    }
  }

  // Voice testing methods removed




  toggleCompatibilityDisplay() {
    const showCompatibility = document.getElementById('showVoiceCompatibility').checked;
    // This would toggle the display of compatibility indicators in the voice list
    // For now, just trigger a re-render
    this.renderVoiceList();
    this.markUnsaved();
  }

  // Favorites Management Methods
  async toggleVoiceFavorite(voiceName) {
    if (!voiceName) return;

    const favorites = [...this.settings.favoriteVoices];
    const index = favorites.indexOf(voiceName);

    if (index > -1) {
      // Remove from favorites
      favorites.splice(index, 1);
    } else {
      // Add to favorites
      favorites.push(voiceName);
    }

    // Update settings
    this.settings.favoriteVoices = favorites;
    
    // Save to storage immediately
    await chrome.storage.sync.set({ favoriteVoices: favorites });

    // Update UI
    this.renderVoiceList(); // Re-render to update favorite buttons
    this.markUnsaved();

    const action = index > -1 ? 'removed from' : 'added to';
    this.showNotification(`Voice ${action} favorites`, 'success');
  }

  async clearAllFavorites() {
    if (!confirm('Are you sure you want to clear all favorite voices?')) {
      return;
    }

    this.settings.favoriteVoices = [];
    await chrome.storage.sync.set({ favoriteVoices: [] });

    this.renderVoiceList();
    this.markUnsaved();
    this.showNotification('All favorites cleared', 'success');
  }

  async addDefaultFavorites() {
    // Add recommended high-quality voices as favorites
    const recommendedVoices = [
      'en-US-Neural2-F', 'en-US-Neural2-D', 'en-US-Neural2-A', // Google Neural2 English
      'en-GB-Neural2-A', 'en-GB-Neural2-B', // Google Neural2 British
      'Microsoft Zira Desktop - English (United States)', // Chrome US
      'Microsoft David Desktop - English (United States)', // Chrome US
      'Google UK English Female', 'Google UK English Male', // Chrome UK
      'Google US English', 'Google français' // Chrome multilingual
    ];

    const existingVoiceNames = this.voices.map(v => v.name);
    const availableRecommended = recommendedVoices.filter(name => 
      existingVoiceNames.includes(name) && 
      !this.settings.favoriteVoices.includes(name)
    );

    if (availableRecommended.length === 0) {
      this.showNotification('No additional recommended voices to add', 'info');
      return;
    }

    // Add to existing favorites
    this.settings.favoriteVoices = [...this.settings.favoriteVoices, ...availableRecommended];
    await chrome.storage.sync.set({ favoriteVoices: this.settings.favoriteVoices });

    this.renderVoiceList();
    this.markUnsaved();
    this.showNotification(`Added ${availableRecommended.length} recommended voices to favorites`, 'success');
  }




  // Favorites count method removed

  // Quota Management
  async loadQuotaUsage() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getQuotaUsage' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error loading quota usage:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
      if (response && response.status === 'success' && response.quota) {
        this.updateQuotaDisplay(response.quota);
      }
    } catch (error) {
      console.error('Error loading quota usage:', error);
    }
  }

  updateQuotaDisplay(quotaData) {
    // Update quota text
    const quotaText = document.getElementById('quotaText');
    if (quotaText) {
      const used = this.formatNumber(quotaData.used);
      const limit = this.formatNumber(quotaData.limit);
      quotaText.textContent = `Usage: ${used} / ${limit} characters this month (${quotaData.percentage.toFixed(1)}%)`;
    }

    // Update quota progress bar
    const quotaProgress = document.getElementById('quotaProgress');
    if (quotaProgress) {
      quotaProgress.style.width = `${Math.min(quotaData.percentage, 100)}%`;
      
      // Change color based on usage level
      if (quotaData.percentage >= 95) {
        quotaProgress.style.background = '#dc3545'; // Red for critical
      } else if (quotaData.percentage >= 80) {
        quotaProgress.style.background = '#ffc107'; // Yellow for warning
      } else {
        quotaProgress.style.background = '#28a745'; // Green for normal
      }
    }

    // Show warning messages
    if (quotaData.warning) {
      this.showQuotaWarning(quotaData);
    }
  }

  showQuotaWarning(quotaData) {
    if (quotaData.warning === 'critical') {
      this.showNotification(
        `⚠️ Google TTS quota at ${quotaData.percentage.toFixed(1)}%! Consider upgrading your plan.`,
        'warning'
      );
    } else if (quotaData.warning === 'high') {
      this.showNotification(
        `⚠️ Google TTS quota at ${quotaData.percentage.toFixed(1)}%. Monitor usage carefully.`,
        'warning'
      );
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  async applyQuotaBackfill() {
    const backfillInput = document.getElementById('backfillUsage');
    const usage = parseInt(backfillInput.value);
    
    if (!usage || usage < 0 || usage > 1000000) {
      this.showNotification('Please enter a valid usage amount (0-1,000,000)', 'error');
      return;
    }

    if (!confirm(`Add ${usage.toLocaleString()} characters to this month's quota usage?`)) {
      return;
    }

    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Get current usage data
      chrome.storage.local.get(['googleTTSUsage'], (result) => {
        const usageData = result.googleTTSUsage || {};
        const currentUsage = usageData[currentMonth] || 0;
        
        // Add backfilled amount
        usageData[currentMonth] = currentUsage + usage;
        
        chrome.storage.local.set({ googleTTSUsage: usageData }, () => {
          this.showNotification(`Added ${usage.toLocaleString()} characters to quota usage`, 'success');
          backfillInput.value = '';
          
          // Refresh quota display
          setTimeout(() => {
            this.loadQuotaUsage();
          }, 500);
        });
      });
    } catch (error) {
      this.showNotification('Error applying backfill', 'error');
      console.error('Backfill error:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});