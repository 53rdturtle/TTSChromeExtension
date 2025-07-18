// Background service worker for TTS Chrome Extension

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
  console.log('Broadcasting control bar state:', globalTTSState);
  try {
    const tabs = await chrome.tabs.query({});
    console.log(`Broadcasting to ${tabs.length} tabs`);
    
    for (const tab of tabs) {
      console.log(`Processing tab ${tab.id}: ${tab.url} (status: ${tab.status}, title: ${tab.title})`);
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          // Inject content script if not already injected
          console.log(`Injecting content script into tab ${tab.id}`);
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
          console.log(`Sending message to tab ${tab.id}:`, message);
          await chrome.tabs.sendMessage(tab.id, message);
          console.log(`Successfully sent message to tab ${tab.id}`);
        } catch (error) {
          // Ignore tabs that don't support content scripts
          console.log(`Could not broadcast to tab ${tab.id}: ${error.message}`);
        }
      } else {
        console.log(`Skipping tab ${tab.id}: unsupported URL`);
      }
    }
    console.log('Finished broadcasting to all tabs');
  } catch (error) {
    console.error('Error broadcasting control bar state:', error);
  }
}

// Shared utility to get selected text from active tab
async function getSelectedTextFromActiveTab() {
  return new Promise((resolve) => {
    console.log('getSelectedTextFromActiveTab called');
    // Query for tabs in the current window, excluding popup windows
    chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      windowType: 'normal' // Only normal windows, not popups
    }, (tabs) => {
      console.log('Active tabs (normal windows):', tabs);
      if (tabs && tabs[0]) {
        console.log('Executing script on tab:', tabs[0].id);
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.getSelection().toString()
        }, (results) => {
          console.log('Script execution results:', results);
          const selectedText = results && results[0] && results[0].result;
          console.log('Raw selected text:', selectedText);
          resolve(selectedText && selectedText.trim() !== "" ? selectedText : null);
        });
      } else {
        console.log('No active normal tab found, trying alternative approach');
        // Alternative: get the last active tab
        chrome.tabs.query({ 
          active: true, 
          windowType: 'normal'
        }, (allTabs) => {
          console.log('All active tabs:', allTabs);
          if (allTabs && allTabs.length > 0) {
            const tab = allTabs[0];
            console.log('Using tab:', tab.id);
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => window.getSelection().toString()
            }, (results) => {
              console.log('Script execution results (alternative):', results);
              const selectedText = results && results[0] && results[0].result;
              console.log('Raw selected text (alternative):', selectedText);
              resolve(selectedText && selectedText.trim() !== "" ? selectedText : null);
            });
          } else {
            console.log('No tabs found at all');
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
          console.log('TTS Event:', event.type);
          
          if (event.type === "start") {
            console.log('TTS Event: start - updating global state and broadcasting');
            this.isSpeaking = true;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = true;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = true;
            
            console.log('Global TTS state after start:', globalTTSState);
            
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
            console.log('Broadcasting control bar state after TTS start');
            broadcastControlBarState();
          } else if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
            console.log(`TTS Event: ${event.type} - hiding control bar globally`);
            this.isSpeaking = false;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = false;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = false;
            globalTTSState.originatingTabId = null;
            
            console.log('Global TTS state after end:', globalTTSState);
            
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
            console.log('Broadcasting control bar hide after TTS end');
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
      console.log('MessageHandler.handleMessage called with type:', message.type);
      switch (message.type) {
        case 'speak':
          await this.handleSpeak(message, sendResponse);
          break;
        case 'stop':
          await this.handleStop(sendResponse);
          break;
        case 'pause':
          await this.handlePause(sendResponse);
          break;
        case 'resume':
          await this.handleResume(sendResponse);
          break;
        case 'getVoices':
          await this.handleGetVoices(sendResponse);
          break;
        case 'getStatus':
          await this.handleGetStatus(sendResponse);
          break;
        case 'getSelectedText':
          await this.handleGetSelectedText(sendResponse);
          break;
        case 'updateSpeed':
          await this.handleUpdateSpeed(message, sendResponse);
          break;
        case 'getHighlightingSettings':
          await this.handleGetHighlightingSettings(sendResponse);
          break;
        case 'saveHighlightingSettings':
          await this.handleSaveHighlightingSettings(message, sendResponse);
          break;
        default:
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
    console.log('handleSpeak called with message:', message);
    if (!message.text || message.text.trim() === '') {
      console.log('No text provided for speak');
      sendResponse({ status: 'error', error: 'No text provided' });
      return;
    }

    const options = {
      rate: message.rate,
      voiceName: message.voiceName
    };
    console.log('TTS options:', options);

    try {
      console.log('Calling TTS service speak...');
      const result = await this.ttsService.speak(message.text, options);
      console.log('TTS service speak result:', result);
      
      // Control bar will be shown by TTS service callback
      sendResponse(result);
    } catch (error) {
      console.error('TTS service speak error:', error);
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle stop message
  async handleStop(sendResponse) {
    try {
      const result = await this.ttsService.stop();
      // Update control bar will be hidden by TTS event listener
      sendResponse(result);
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
      console.log('handleGetVoices called');
      console.log('Getting voices...');
      const voices = await this.ttsService.getVoices();
      console.log('Voices retrieved:', voices.length, 'voices');
      console.log('Sending voices response...');
      sendResponse({ status: 'success', voices: voices });
      console.log('Voices response sent');
    } catch (error) {
      console.error('Error getting voices:', error);
      sendResponse({ status: 'error', error: error });
    }
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
      console.log('Handling getSelectedText request...');
      const selectedText = await getSelectedTextFromActiveTab();
      console.log('Selected text result:', selectedText);
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
}

// Initialize services
const ttsService = new TTSService();
const messageHandler = new MessageHandler(ttsService);

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle control bar position updates
  if (message.type === 'updateControlBarPosition') {
    globalTTSState.controlBarPosition = message.position;
    console.log('Updated global control bar position:', message.position);
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Return true to indicate async response
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
      chrome.storage.sync.get(['selectedVoice', 'speechRate'], (prefs) => {
        const options = {
          rate: prefs.speechRate ? parseFloat(prefs.speechRate) : 1.0,
          pitch: 1.0,
          volume: 1.0,
          onEvent: (event) => {
            console.log('TTS Event (keyboard shortcut):', event.type);
            
            if (event.type === "start") {
              console.log('TTS Event (keyboard): start - updating global state and broadcasting');
              ttsService.isSpeaking = true;
              ttsService.isPaused = false;
              // Update global state
              globalTTSState.isSpeaking = true;
              globalTTSState.isPaused = false;
              globalTTSState.showControlBar = true;
              
              console.log('Global TTS state after keyboard start:', globalTTSState);
              
              // Send message to content script to highlight text
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                  // Store the originating tab ID
                  globalTTSState.originatingTabId = tabs[0].id;
                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'highlightText',
                    text: selectedText,
                    action: 'start'
                  });
                }
              });
              // Broadcast control bar to all tabs
              console.log('Broadcasting control bar state after keyboard TTS start');
              broadcastControlBarState();
            } else if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
              console.log(`TTS Event (keyboard): ${event.type} - hiding control bar globally`);
              ttsService.isSpeaking = false;
              ttsService.isPaused = false;
              // Update global state
              globalTTSState.isSpeaking = false;
              globalTTSState.isPaused = false;
              globalTTSState.showControlBar = false;
              globalTTSState.originatingTabId = null;
              
              console.log('Global TTS state after keyboard end:', globalTTSState);
              
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
              console.log('Broadcasting control bar hide after keyboard TTS end');
              broadcastControlBarState();
            } else if (event.type === "pause") {
              ttsService.isSpeaking = false;
              ttsService.isPaused = true;
              // Update global state
              globalTTSState.isSpeaking = false;
              globalTTSState.isPaused = true;
              
              // Broadcast updated state to all tabs
              broadcastControlBarState();
            } else if (event.type === "resume") {
              ttsService.isSpeaking = true;
              ttsService.isPaused = false;
              // Update global state
              globalTTSState.isSpeaking = true;
              globalTTSState.isPaused = false;
              
              // Broadcast updated state to all tabs
              broadcastControlBarState();
            }
          }
        };
        
        if (prefs.selectedVoice) {
          options.voiceName = prefs.selectedVoice;
        }
        
        // Stop any existing TTS before starting new speech
        chrome.tts.stop();
        
        // Reset TTS service state
        ttsService.isSpeaking = false;
        ttsService.isPaused = false;
        
        // Call TTS API directly
        chrome.tts.speak(selectedText, options, () => {
          if (chrome.runtime.lastError) {
            console.error('TTS Error:', chrome.runtime.lastError);
          } else {
            console.log('Speaking selected text:', selectedText);
            // Update TTS service state to reflect current speaking status
            ttsService.isSpeaking = true;
            ttsService.isPaused = false;
            // Show floating control bar on active tab
            showFloatingControlBar();
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
  console.log(`Tab activated: ${activeInfo.tabId}, globalTTSState:`, globalTTSState);
  if (globalTTSState.showControlBar) {
    try {
      // Get tab info
      const tab = await chrome.tabs.get(activeInfo.tabId);
      console.log(`Activated tab URL: ${tab.url} (status: ${tab.status}, title: ${tab.title})`);
      
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // Inject content script and show control bar on activated tab
        console.log(`Injecting content script into activated tab ${activeInfo.tabId}`);
        await chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          files: ['controlbar.js']
        });
        
        // Small delay to ensure content script is loaded
        setTimeout(() => {
          console.log(`Sending showControlBar message to activated tab ${activeInfo.tabId}`);
          chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'showControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          }).catch((error) => {
            console.log(`Failed to send message to activated tab: ${error.message}`);
          });
        }, 100);
      } else {
        console.log(`Skipping activated tab ${activeInfo.tabId}: unsupported URL`);
      }
    } catch (error) {
      console.log(`Could not show control bar on activated tab: ${error.message}`);
    }
  } else {
    console.log(`Not showing control bar on activated tab - showControlBar is false`);
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
  console.log('TTS Extension startup - initializing default settings');
  try {
    const settings = await getHighlightingSettings();
    console.log('Current highlighting settings:', settings);
  } catch (error) {
    console.error('Error loading highlighting settings:', error);
  }
});

// Initialize default settings on extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('TTS Extension installed - setting up default settings');
  try {
    const settings = await getHighlightingSettings();
    console.log('Initialized highlighting settings:', settings);
  } catch (error) {
    console.error('Error initializing highlighting settings:', error);
  }
});

console.log('TTS Chrome Extension background script loaded');

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSService, MessageHandler, getHighlightingSettings, saveHighlightingSettings };
} 