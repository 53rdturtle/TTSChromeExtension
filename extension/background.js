// Background service worker for TTS Chrome Extension

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
        volume: options.volume || 1.0
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
}

// Initialize services
const ttsService = new TTSService();
const messageHandler = new MessageHandler(ttsService);

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Return true to indicate async response
  messageHandler.handleMessage(message, sender, sendResponse);
  return true;
});

// Handle TTS events
chrome.tts.onEvent.addListener((event) => {
  console.log('TTS Event:', event.type);
  
  if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
    ttsService.isSpeaking = false;
    ttsService.isPaused = false;
    // Hide floating control bar when TTS stops
    hideFloatingControlBar();
  } else if (event.type === "pause") {
    ttsService.isSpeaking = false;
    ttsService.isPaused = true;
    // Update control bar to show resume button
    updateControlBarStatus();
  } else if (event.type === "resume") {
    ttsService.isSpeaking = true;
    ttsService.isPaused = false;
    // Update control bar to show pause button
    updateControlBarStatus();
  }
});

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
          volume: 1.0
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

console.log('TTS Chrome Extension background script loaded');

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSService, MessageHandler };
} 