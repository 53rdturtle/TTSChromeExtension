// Background service worker for TTS Chrome Extension

// Import Google TTS service
importScripts('services/google-tts.js');

// Default highlighting settings - Enhanced per-mode configuration
const DEFAULT_HIGHLIGHTING_SETTINGS = {
  fullSelection: {
    enabled: true,
    style: {
      backgroundColor: '#ffeb3b',
      textColor: '#000000',
      opacity: 0.8,
      borderStyle: 'none'
    }
  },
  sentence: {
    enabled: false,
    style: {
      backgroundColor: '#4caf50',
      textColor: '#ffffff',
      opacity: 0.7,
      borderStyle: 'solid'
    }
  },
  word: {
    enabled: false,
    style: {
      backgroundColor: '#2196f3',
      textColor: '#ffffff',
      opacity: 0.9,
      borderStyle: 'dashed'
    }
  },
  global: {
    autoScroll: true,
    animationEffects: true
  }
};

// Global TTS state for cross-tab persistence
let globalTTSState = {
  isSpeaking: false,
  isPaused: false,
  showControlBar: false,
  controlBarPosition: { x: 20, y: null, bottom: 20 }, // Default position
  controlBarSize: { width: 200, height: 'auto' },
  originatingTabId: null // Track which tab started the TTS
};

// Function to broadcast control bar state to all tabs
async function broadcastControlBarState() {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          // Inject content script if not already injected
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['controlbar.js']
          });
          
          // Small delay to ensure content script is loaded
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Send message to show/hide control bar
          const message = {
            type: globalTTSState.showControlBar ? 'showControlBar' : 'hideControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          };
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Ignore tabs that don't support content scripts (silently)
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting control bar state:', error);
  }
}

// Shared utility to get selected text from active tab
async function getSelectedTextFromActiveTab() {
  return new Promise((resolve) => {
    // Query for tabs in the current window, excluding popup windows
    chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      windowType: 'normal' // Only normal windows, not popups
    }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.getSelection().toString()
        }, (results) => {
          const selectedText = results && results[0] && results[0].result;
          resolve(selectedText && selectedText.trim() !== "" ? selectedText : null);
        });
      } else {
        // Alternative: get the last active tab
        chrome.tabs.query({ 
          active: true, 
          windowType: 'normal'
        }, (allTabs) => {
          if (allTabs && allTabs.length > 0) {
            const tab = allTabs[0];
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => window.getSelection().toString()
            }, (results) => {
              const selectedText = results && results[0] && results[0].result;
              resolve(selectedText && selectedText.trim() !== "" ? selectedText : null);
            });
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

// TTS Service class to handle all text-to-speech operations
class TTSService {
  constructor() {
    this.isSpeaking = false;
    this.isPaused = false;
  }

  // Speak the given text with specified options
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      // Stop any existing TTS before starting new speech
      chrome.tts.stop();
      
      // Reset TTS service state
      this.isSpeaking = false;
      this.isPaused = false;
      
      const ttsOptions = {
        rate: options.rate || 1.0,
        pitch: options.pitch || 1.0,
        volume: options.volume || 1.0,
        onEvent: (event) => {
            if (event.type === "start") {
            this.isSpeaking = true;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = true;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = true;
            
            // Send message to content script to highlight text
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                // Store the originating tab ID
                globalTTSState.originatingTabId = tabs[0].id;
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: 'highlightText',
                  text: text,
                  action: 'start'
                });
              }
            });
            // Broadcast control bar to all tabs
            broadcastControlBarState();
          } else if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
            this.isSpeaking = false;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = false;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = false;
            globalTTSState.originatingTabId = null;
            
            // Send message to ALL tabs to remove highlights
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:'))) {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'highlightText',
                    action: 'end'
                  }).catch(() => {
                    // Ignore errors for tabs without content scripts
                  });
                }
              });
            });
            // Broadcast control bar hide to all tabs
            broadcastControlBarState();
          } else if (event.type === "pause") {
            this.isSpeaking = false;
            this.isPaused = true;
            // Update global state
            globalTTSState.isSpeaking = false;
            globalTTSState.isPaused = true;
            
            // Broadcast updated state to all tabs
            broadcastControlBarState();
          } else if (event.type === "resume") {
            this.isSpeaking = true;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = true;
            globalTTSState.isPaused = false;
            
            // Broadcast updated state to all tabs
            broadcastControlBarState();
          }
        }
      };

      if (options.voiceName) {
        ttsOptions.voiceName = options.voiceName;
      }

      chrome.tts.speak(text, ttsOptions, () => {
        if (chrome.runtime.lastError) {
          console.error('TTS Speak Error:', chrome.runtime.lastError);
          this.isSpeaking = false;
          this.isPaused = false;
          reject(chrome.runtime.lastError.message);
        } else {
          this.isSpeaking = true;
          this.isPaused = false;
          // Show control bar now that TTS is actually speaking
          showFloatingControlBar();
          resolve({ status: 'speaking' });
        }
      });
    });
  }

  // Stop current TTS playback
  stop() {
    return new Promise((resolve) => {
      chrome.tts.stop();
      this.isSpeaking = false;
      this.isPaused = false;
      resolve({ status: 'stopped' });
    });
  }

  // Pause current TTS playback
  pause() {
    return new Promise((resolve) => {
      chrome.tts.pause();
      this.isSpeaking = false;
      this.isPaused = true;
      resolve({ status: 'paused' });
    });
  }

  // Resume paused TTS playback
  resume() {
    return new Promise((resolve) => {
      chrome.tts.resume();
      this.isSpeaking = true;
      this.isPaused = false;
      resolve({ status: 'resumed' });
    });
  }

  // Get available voices
  getVoices() {
    return new Promise((resolve, reject) => {
      chrome.tts.getVoices((voices) => {
        if (chrome.runtime.lastError) {
          console.error('TTS Get Voices Error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(voices);
        }
      });
    });
  }

  // Check if currently speaking
  getSpeakingStatus() {
    return this.isSpeaking;
  }

  // Get current TTS state
  getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused
    };
  }
}

// Message handler class to manage communication
class MessageHandler {
  constructor(ttsService) {
    this.ttsService = ttsService;
  }

  // Handle incoming messages
  async handleMessage(message, sender, sendResponse) {
    try {
      if (message.type === 'speak') {
        await this.handleSpeak(message, sendResponse);
      } else if (message.type === 'stop') {
        await this.handleStop(sendResponse);
      } else if (message.type === 'pause') {
        await this.handlePause(sendResponse);
      } else if (message.type === 'resume') {
        await this.handleResume(sendResponse);
      } else if (message.type === 'getVoices') {
        await this.handleGetVoices(sendResponse);
      } else if (message.type === 'getStatus') {
        await this.handleGetStatus(sendResponse);
      } else if (message.type === 'getSelectedText') {
        await this.handleGetSelectedText(sendResponse);
      } else if (message.type === 'updateSpeed') {
        await this.handleUpdateSpeed(message, sendResponse);
      } else if (message.type === 'getHighlightingSettings') {
        await this.handleGetHighlightingSettings(sendResponse);
      } else if (message.type === 'saveHighlightingSettings') {
        await this.handleSaveHighlightingSettings(message, sendResponse);
      } else if (message.type === 'getSpeechStatus') {
        await this.handleGetSpeechStatus(sendResponse);
      } else if (message.type === 'testGoogleTTS') {
        await this.handleTestGoogleTTS(message, sendResponse);
      } else if (message.type === 'getQuotaUsage') {
        await this.handleGetQuotaUsage(sendResponse);
      } else if (message.type === 'previewVoice') {
        await this.handlePreviewVoice(message, sendResponse);
      } else {
        console.log('Unknown message type:', message.type);
        sendResponse({ status: 'error', error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle speak message
  async handleSpeak(message, sendResponse) {
    if (!message.text || message.text.trim() === '') {
      sendResponse({ status: 'error', error: 'No text provided' });
      return;
    }

    const options = {
      rate: message.rate,
      voiceName: message.voiceName
    };

    try {
      // Check if Google TTS is enabled
      const useGoogleTTS = await googleTTSService.isEnabled();
      
      if (useGoogleTTS) {
        const result = await googleTTSService.speak(message.text, options);
        sendResponse(result);
        
      } else {
        const result = await this.ttsService.speak(message.text, options);
        sendResponse(result);
      }
      
    } catch (error) {
      console.error('TTS service speak error:', error);
      
      // If Google TTS fails, try fallback to Chrome TTS
      if (await googleTTSService.isEnabled()) {
        console.log('⚠️ Google TTS failed, falling back to Chrome TTS');
        try {
          const result = await this.ttsService.speak(message.text, options);
          sendResponse(result);
        } catch (fallbackError) {
          console.error('Chrome TTS fallback also failed:', fallbackError);
          sendResponse({ status: 'error', error: fallbackError.message || fallbackError });
        }
      } else {
        sendResponse({ status: 'error', error: error.message || error });
      }
    }
  }

  // Handle stop message
  async handleStop(sendResponse) {
    try {
      // Stop both Chrome TTS and Google TTS
      const chromeResult = await this.ttsService.stop();
      await googleTTSService.stopAudio();
      
      // Update global state
      globalTTSState.isSpeaking = false;
      globalTTSState.isPaused = false;
      globalTTSState.showControlBar = false;
      broadcastControlBarState();
      
      sendResponse(chromeResult);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle pause message
  async handlePause(sendResponse) {
    try {
      const result = await this.ttsService.pause();
      // Control bar will be updated by TTS event listener
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle resume message
  async handleResume(sendResponse) {
    try {
      const result = await this.ttsService.resume();
      // Control bar will be updated by TTS event listener
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle get voices message
  async handleGetVoices(sendResponse) {
    try {
      // Get Chrome TTS voices
      const chromeVoices = await this.ttsService.getVoices();
      
      // Transform Chrome voices to our unified format
      const formattedChromeVoices = chromeVoices.map(voice => ({
        name: voice.voiceName || voice.name,
        lang: voice.lang,
        gender: this.extractGender(voice.voiceName || voice.name),
        quality: 'Standard',
        isGoogle: false,
        eventTypes: voice.eventTypes || []
      }));

      // Get Google TTS voices if enabled
      let googleVoices = [];
      const googleEnabled = await googleTTSService.isEnabled();
      if (googleEnabled) {
        try {
          googleVoices = await googleTTSService.getVoices();
        } catch (googleError) {
          console.warn('Failed to get Google TTS voices:', googleError);
          // Continue with Chrome voices only
        }
      }

      // Combine all voices
      const allVoices = [...formattedChromeVoices, ...googleVoices];
      
      // Sort voices by language, then quality, then name
      allVoices.sort((a, b) => {
        if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
        if (a.quality !== b.quality) {
          const qualityOrder = ['Chirp3', 'Neural2', 'Studio', 'WaveNet', 'Standard'];
          return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        }
        return a.name.localeCompare(b.name);
      });

      sendResponse({ status: 'success', voices: allVoices });
    } catch (error) {
      console.error('Error getting voices:', error);
      sendResponse({ status: 'error', error: error });
    }
  }

  // Helper method to extract gender from Chrome voice name
  extractGender(voiceName) {
    const name = voiceName.toLowerCase();
    if (name.includes('female') || name.includes('woman')) return 'female';
    if (name.includes('male') || name.includes('man')) return 'male';
    // Common male names
    if (name.includes('david') || name.includes('mark') || name.includes('alex')) return 'male';
    // Common female names  
    if (name.includes('zira') || name.includes('hazel') || name.includes('samantha')) return 'female';
    return 'unknown';
  }

  // Handle get status message
  async handleGetStatus(sendResponse) {
    chrome.tts.isSpeaking((speaking) => {
      sendResponse({ status: 'success', isSpeaking: speaking });
    });
  }

  // Handle get selected text message
  async handleGetSelectedText(sendResponse) {
    try {
      const selectedText = await getSelectedTextFromActiveTab();
      sendResponse({ status: 'success', selectedText: selectedText });
    } catch (error) {
      console.error('Error getting selected text:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle update speed message
  async handleUpdateSpeed(message, sendResponse) {
    try {
      if (!message.rate || isNaN(message.rate)) {
        sendResponse({ status: 'error', error: 'Invalid rate provided' });
        return;
      }

      const rate = parseFloat(message.rate);
      
      // Validate rate bounds
      if (rate < 0.1 || rate > 3.0) {
        sendResponse({ status: 'error', error: 'Rate must be between 0.1 and 3.0' });
        return;
      }

      // If TTS is currently speaking, we need to restart it with the new rate
      if (this.ttsService.isSpeaking || this.ttsService.isPaused) {
        // For now, just acknowledge the speed change
        // In a full implementation, we might need to restart current speech with new rate
        sendResponse({ status: 'success', message: 'Speed updated for future speech' });
      } else {
        sendResponse({ status: 'success', message: 'Speed updated' });
      }
    } catch (error) {
      console.error('Error updating speed:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle get highlighting settings message
  async handleGetHighlightingSettings(sendResponse) {
    try {
      const settings = await getHighlightingSettings();
      sendResponse({ status: 'success', settings: settings });
    } catch (error) {
      console.error('Error getting highlighting settings:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle save highlighting settings message
  async handleSaveHighlightingSettings(message, sendResponse) {
    try {
      await saveHighlightingSettings(message.settings);
      sendResponse({ status: 'success', message: 'Settings saved' });
    } catch (error) {
      console.error('Error saving highlighting settings:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle get speech status message
  async handleGetSpeechStatus(sendResponse) {
    const status = this.ttsService.getSpeakingStatus() ? 'speaking' : 'ended';
    sendResponse({ status: 'success', status: status });
  }

  // Handle test Google TTS connection
  async handleTestGoogleTTS(message, sendResponse) {
    try {
      // Basic test of Google TTS API with the provided key
      const testUrl = `https://texttospeech.googleapis.com/v1/voices?key=${message.apiKey}`;
      
      const response = await fetch(testUrl);
      if (response.ok) {
        sendResponse({ status: 'success', success: true });
      } else {
        const errorText = await response.text();
        sendResponse({ status: 'error', success: false, error: `API Error: ${response.status}` });
      }
    } catch (error) {
      sendResponse({ status: 'error', success: false, error: error.message });
    }
  }

  // Handle get quota usage message
  async handleGetQuotaUsage(sendResponse) {
    try {
      chrome.storage.local.get(['googleTTSUsage'], (result) => {
        const usage = result.googleTTSUsage || 0;
        sendResponse({ status: 'success', usage: usage });
      });
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle preview voice message
  async handlePreviewVoice(message, sendResponse) {
    try {
      const options = {
        rate: message.rate,
        voiceName: message.voiceName
      };

      await this.ttsService.speak(message.text, options);
      sendResponse({ status: 'success' });
    } catch (error) {
      console.error('Error previewing voice:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }
}

// Initialize services
const ttsService = new TTSService();
const googleTTSService = new GoogleTTSService();
const messageHandler = new MessageHandler(ttsService);

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle control bar position updates
  if (message.type === 'updateControlBarPosition') {
    globalTTSState.controlBarPosition = message.position;
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Handle Google TTS events from offscreen document
  if (message.type === 'googleTTSStarted') {
    globalTTSState.isSpeaking = true;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = true;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSEnded') {
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = false;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSPaused') {
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = true;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSError') {
    console.error('❌ Google TTS error:', message.error);
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = false;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Handle offscreen document messages (playGoogleTTS, stopGoogleTTS, etc.)
  if (message.type === 'playGoogleTTS' || message.type === 'stopGoogleTTS' || 
      message.type === 'pauseGoogleTTS' || message.type === 'resumeGoogleTTS') {
    // These are handled by the offscreen document, but we need to acknowledge them
    sendResponse({ status: 'received' });
    return true;
  }
  
  // All other messages go to MessageHandler
  messageHandler.handleMessage(message, sender, sendResponse);
  return true;
});

// TTS events are now handled directly in the onEvent callback of each speak() call

// Listen for the open_popup command and speak the selected content
chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open_popup") {
    const selectedText = await getSelectedTextFromActiveTab();
    if (selectedText) {
      // Get last used voice and rate from storage
      chrome.storage.sync.get(['selectedVoice', 'speechRate'], async (prefs) => {
        const message = {
          type: 'speak',
          text: selectedText,
          rate: prefs.speechRate ? parseFloat(prefs.speechRate) : 1.0,
          voiceName: prefs.selectedVoice
        };
        
        // Use the integrated handleSpeak method that includes Google TTS
        await messageHandler.handleSpeak(message, (response) => {
          if (response && response.status === 'error') {
            console.error('TTS Error from keyboard shortcut:', response.error);
          }
        });
      });
    }
  }
});

// Function to show floating control bar on active tab
async function showFloatingControlBar() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      // Inject content script if not already injected
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['controlbar.js']
      });
      
      // Send message to show control bar with current state
      const state = ttsService.getState();
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'showControlBar',
        isSpeaking: state.isSpeaking,
        isPaused: state.isPaused
      });
    }
  } catch (error) {
    console.error('Error showing floating control bar:', error);
  }
}

// Function to hide floating control bar
async function hideFloatingControlBar() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'hideControlBar' });
    }
  } catch (error) {
    console.error('Error hiding floating control bar:', error);
  }
}

// Function to update control bar status
async function updateControlBarStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const state = ttsService.getState();
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'updateStatus',
        isSpeaking: state.isSpeaking,
        isPaused: state.isPaused
      });
    }
  } catch (error) {
    console.error('Error updating control bar status:', error);
  }
}

// Listen for tab activation to show control bar on newly activated tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (globalTTSState.showControlBar) {
    try {
      // Get tab info
      const tab = await chrome.tabs.get(activeInfo.tabId);
      
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // Inject content script and show control bar on activated tab
        await chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          files: ['controlbar.js']
        });
        
        // Small delay to ensure content script is loaded
        setTimeout(() => {
          chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'showControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        }, 100);
      }
    } catch (error) {
      // Ignore errors silently
    }
  }
});

// Listen for tab updates (page navigation) to show control bar on new pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && globalTTSState.showControlBar) {
    if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      try {
        // Inject content script and show control bar on updated tab
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['controlbar.js']
        });
        
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'showControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          }).catch(() => {
            // Ignore errors for tabs that don't support content scripts
          });
        }, 100);
      } catch (error) {
        console.log(`Could not show control bar on updated tab: ${error.message}`);
      }
    }
  }
});

// Settings storage functions
async function getHighlightingSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['highlightingSettings'], (result) => {
      if (result.highlightingSettings) {
        // Merge with defaults to ensure all properties exist
        const settings = { ...DEFAULT_HIGHLIGHTING_SETTINGS, ...result.highlightingSettings };
        resolve(settings);
      } else {
        resolve(DEFAULT_HIGHLIGHTING_SETTINGS);
      }
    });
  });
}

async function saveHighlightingSettings(settings) {
  return new Promise((resolve, reject) => {
    // Validate settings structure
    if (!settings || typeof settings !== 'object') {
      reject(new Error('Invalid settings object'));
      return;
    }

    // Validate per-mode settings structure
    const validModes = ['fullSelection', 'sentence', 'word'];
    for (const mode of validModes) {
      if (settings[mode] && typeof settings[mode] !== 'object') {
        reject(new Error(`Invalid ${mode} settings object`));
        return;
      }
      if (settings[mode] && settings[mode].style && typeof settings[mode].style !== 'object') {
        reject(new Error(`Invalid ${mode} style settings object`));
        return;
      }
    }

    // Validate global settings
    if (settings.global && typeof settings.global !== 'object') {
      reject(new Error('Invalid global settings object'));
      return;
    }

    // Deep merge with existing settings and defaults
    const mergedSettings = deepMerge(DEFAULT_HIGHLIGHTING_SETTINGS, settings);

    chrome.storage.sync.set({ highlightingSettings: mergedSettings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Helper function for deep merging objects
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Initialize default settings on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await getHighlightingSettings();
  } catch (error) {
    console.error('Error loading highlighting settings:', error);
  }
});

// Initialize default settings on extension installation
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await getHighlightingSettings();
  } catch (error) {
    console.error('Error initializing highlighting settings:', error);
  }
});

// Offscreen document management
let offscreenDocumentCreated = false;

async function createOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    
    if (existingContexts.length > 0) {
      offscreenDocumentCreated = true;
      return;
    }
    
    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play Google TTS audio in service worker context'
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    offscreenDocumentCreated = false;
  }
}

async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) {
    return;
  }
  
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    console.error('Failed to close offscreen document:', error);
  }
}

// Create offscreen document on startup
createOffscreenDocument();

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSService, MessageHandler, getHighlightingSettings, saveHighlightingSettings };
} 