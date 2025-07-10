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
  }

  // Speak the given text with specified options
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
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
          reject(chrome.runtime.lastError.message);
        } else {
          this.isSpeaking = true;
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
      resolve({ status: 'stopped' });
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
        case 'getVoices':
          await this.handleGetVoices(sendResponse);
          break;
        case 'getStatus':
          await this.handleGetStatus(sendResponse);
          break;
        case 'getSelectedText':
          await this.handleGetSelectedText(sendResponse);
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
  if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
    ttsService.isSpeaking = false;
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
        
        // Call TTS API directly
        chrome.tts.speak(selectedText, options, () => {
          if (chrome.runtime.lastError) {
            console.error('TTS Error:', chrome.runtime.lastError);
          } else {
            console.log('Speaking selected text:', selectedText);
          }
        });
      });
    }
  }
});

console.log('TTS Chrome Extension background script loaded'); 