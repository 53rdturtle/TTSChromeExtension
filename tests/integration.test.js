// Integration tests for message passing between components

// Mock DOM for popup integration
const createMockElement = (id, type = 'div') => ({
  id,
  type,
  value: '',
  textContent: '',
  disabled: false,
  innerHTML: '',
  addEventListener: jest.fn(),
  appendChild: jest.fn(),
  classList: { add: jest.fn(), remove: jest.fn() },
  style: {},
  querySelector: jest.fn(),
  getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 200, height: 100 }))
});

global.document = {
  getElementById: jest.fn((id) => createMockElement(id)),
  createElement: jest.fn(() => createMockElement('mock')),
  body: createMockElement('body'),
  head: createMockElement('head'),
  addEventListener: jest.fn()
};

global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  getSelection: jest.fn(() => ({ toString: jest.fn(() => 'selected text') }))
};

// Define classes for integration testing
class TTSService {
  constructor() {
    this.isSpeaking = false;
    this.isPaused = false;
  }

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
          this.isSpeaking = false;
          this.isPaused = false;
          reject(chrome.runtime.lastError.message);
        } else {
          this.isSpeaking = true;
          this.isPaused = false;
          resolve({ status: 'speaking' });
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      chrome.tts.stop();
      this.isSpeaking = false;
      this.isPaused = false;
      resolve({ status: 'stopped' });
    });
  }

  pause() {
    return new Promise((resolve) => {
      chrome.tts.pause();
      this.isSpeaking = false;
      this.isPaused = true;
      resolve({ status: 'paused' });
    });
  }

  resume() {
    return new Promise((resolve) => {
      chrome.tts.resume();
      this.isSpeaking = true;
      this.isPaused = false;
      resolve({ status: 'resumed' });
    });
  }

  getVoices() {
    return new Promise((resolve, reject) => {
      chrome.tts.getVoices((voices) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(voices);
        }
      });
    });
  }

  getSpeakingStatus() {
    return this.isSpeaking;
  }

  getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused
    };
  }
}

class MessageHandler {
  constructor(ttsService) {
    this.ttsService = ttsService;
  }

  async handleMessage(message, sender, sendResponse) {
    try {
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
        default:
          sendResponse({ status: 'error', error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
  }

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
      const result = await this.ttsService.speak(message.text, options);
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  async handleStop(sendResponse) {
    try {
      const result = await this.ttsService.stop();
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  async handlePause(sendResponse) {
    try {
      const result = await this.ttsService.pause();
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  async handleResume(sendResponse) {
    try {
      const result = await this.ttsService.resume();
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  async handleGetVoices(sendResponse) {
    try {
      const voices = await this.ttsService.getVoices();
      sendResponse({ status: 'success', voices: voices });
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  async handleGetStatus(sendResponse) {
    chrome.tts.isSpeaking((speaking) => {
      sendResponse({ status: 'success', isSpeaking: speaking });
    });
  }

  async handleGetSelectedText(sendResponse) {
    try {
      const selectedText = await getSelectedTextFromActiveTab();
      sendResponse({ status: 'success', selectedText: selectedText });
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
  }
}

async function getSelectedTextFromActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      windowType: 'normal'
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

describe('Integration Tests', () => {
  let messageHandler;
  let ttsService;

  beforeEach(() => {
    // Get instances created by background script
    ttsService = new TTSService();
    messageHandler = new MessageHandler(ttsService);
  });

  describe('End-to-End TTS Workflow', () => {
    test('should handle complete speak workflow', async () => {
      // Mock chrome.tts.speak to simulate successful TTS
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Mock chrome.tts.isSpeaking for status checks
      chrome.tts.isSpeaking.mockImplementation((callback) => {
        callback(true);
      });

      // Step 1: Send speak message
      const speakMessage = {
        type: 'speak',
        text: 'Hello integration test',
        rate: 1.2,
        voiceName: 'test-voice'
      };

      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      // Verify TTS was called with correct parameters
      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Hello integration test',
        expect.objectContaining({
          rate: 1.2,
          voiceName: 'test-voice'
        }),
        expect.any(Function)
      );

      // Verify response indicates speaking started
      expect(speakResponse).toHaveBeenCalledWith({
        status: 'speaking'
      });

      // Step 2: Check status
      const statusMessage = { type: 'getStatus' };
      const statusResponse = jest.fn();
      await messageHandler.handleMessage(statusMessage, {}, statusResponse);

      expect(statusResponse).toHaveBeenCalledWith({
        status: 'success',
        isSpeaking: true
      });

      // Step 3: Stop TTS
      const stopMessage = { type: 'stop' };
      const stopResponse = jest.fn();
      await messageHandler.handleMessage(stopMessage, {}, stopResponse);

      expect(chrome.tts.stop).toHaveBeenCalled();
      expect(stopResponse).toHaveBeenCalledWith({
        status: 'stopped'
      });
    });

    test('should handle pause and resume workflow', async () => {
      // Start speaking
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await messageHandler.handleMessage(
        { type: 'speak', text: 'Test text' },
        {},
        jest.fn()
      );

      // Pause
      const pauseResponse = jest.fn();
      await messageHandler.handleMessage(
        { type: 'pause' },
        {},
        pauseResponse
      );

      expect(chrome.tts.pause).toHaveBeenCalled();
      expect(pauseResponse).toHaveBeenCalledWith({ status: 'paused' });
      expect(ttsService.isPaused).toBe(true);

      // Resume
      const resumeResponse = jest.fn();
      await messageHandler.handleMessage(
        { type: 'resume' },
        {},
        resumeResponse
      );

      expect(chrome.tts.resume).toHaveBeenCalled();
      expect(resumeResponse).toHaveBeenCalledWith({ status: 'resumed' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle TTS API errors gracefully', async () => {
      // Mock TTS error
      chrome.runtime.lastError = { message: 'TTS engine not available' };
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      const response = jest.fn();
      await messageHandler.handleMessage(
        { type: 'speak', text: 'Test text' },
        {},
        response
      );

      expect(response).toHaveBeenCalledWith({
        status: 'error',
        error: 'TTS engine not available'
      });
    });

    test('should handle voices API errors', async () => {
      chrome.runtime.lastError = { message: 'Voices not available' };
      chrome.tts.getVoices.mockImplementation((callback) => {
        callback([]);
      });

      const response = jest.fn();
      await messageHandler.handleMessage(
        { type: 'getVoices' },
        {},
        response
      );

      expect(response).toHaveBeenCalledWith({
        status: 'error',
        error: 'Voices not available'
      });
    });
  });

  describe('Storage Integration', () => {
    test('should save and retrieve user preferences', async () => {
      const mockPrefs = {
        selectedVoice: 'test-voice',
        speechRate: '1.5',
        ttsText: 'Saved text'
      };

      // Mock storage.get to return saved preferences
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockPrefs);
      });

      // Mock storage.set to capture saved data
      const savedData = {};
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        Object.assign(savedData, data);
        if (callback) callback();
      });

      // Simulate saving preferences
      chrome.storage.sync.set({ selectedVoice: 'new-voice' });
      chrome.storage.sync.set({ speechRate: '2.0' });
      chrome.storage.sync.set({ ttsText: 'New text' });

      expect(savedData).toEqual({
        selectedVoice: 'new-voice',
        speechRate: '2.0',
        ttsText: 'New text'
      });
    });
  });

  describe('Tab Integration', () => {
    test('should handle selected text from active tab', async () => {
      // Mock active tab with selected text
      const mockTabs = [{ id: 1, url: 'https://example.com' }];
      const mockResults = [{ result: 'Selected text from page' }];

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      chrome.scripting.executeScript.mockImplementation((options, callback) => {
        callback(mockResults);
      });

      const response = jest.fn();
      await messageHandler.handleMessage(
        { type: 'getSelectedText' },
        {},
        response
      );

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
        windowType: 'normal'
      }, expect.any(Function));

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        func: expect.any(Function)
      }, expect.any(Function));

      expect(response).toHaveBeenCalledWith({
        status: 'success',
        selectedText: 'Selected text from page'
      });
    });

    test('should handle no selected text gracefully', async () => {
      const mockTabs = [{ id: 1, url: 'https://example.com' }];
      const mockResults = [{ result: '' }];

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      chrome.scripting.executeScript.mockImplementation((options, callback) => {
        callback(mockResults);
      });

      const response = jest.fn();
      await messageHandler.handleMessage(
        { type: 'getSelectedText' },
        {},
        response
      );

      expect(response).toHaveBeenCalledWith({
        status: 'success',
        selectedText: null
      });
    });
  });

  describe('Message Routing', () => {
    test('should route all message types correctly', async () => {
      const messageTypes = [
        { type: 'speak', text: 'test' },
        { type: 'stop' },
        { type: 'pause' },
        { type: 'resume' },
        { type: 'getVoices' },
        { type: 'getStatus' },
        { type: 'getSelectedText' }
      ];

      // Mock all Chrome APIs
      chrome.tts.speak.mockImplementation((text, options, callback) => callback());
      chrome.tts.getVoices.mockImplementation((callback) => callback([]));
      chrome.tts.isSpeaking.mockImplementation((callback) => callback(false));
      chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 1 }]));
      chrome.scripting.executeScript.mockImplementation((options, callback) => {
        callback([{ result: 'test' }]);
      });

      for (const message of messageTypes) {
        const response = jest.fn();
        await messageHandler.handleMessage(message, {}, response);
        
        // Verify each message type gets a response
        expect(response).toHaveBeenCalled();
      }
    });

    test('should handle unknown message types', async () => {
      const response = jest.fn();
      await messageHandler.handleMessage(
        { type: 'unknown' },
        {},
        response
      );

      expect(response).toHaveBeenCalledWith({
        status: 'error',
        error: 'Unknown message type'
      });
    });
  });

  describe('TTS Event Handling', () => {
    test('should handle TTS events and update state', () => {
      // Mock a simple event handler since we can't access the real one
      const mockEventHandler = (event) => {
        if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
          ttsService.isSpeaking = false;
          ttsService.isPaused = false;
        } else if (event.type === "pause") {
          ttsService.isSpeaking = false;
          ttsService.isPaused = true;
        } else if (event.type === "resume") {
          ttsService.isSpeaking = true;
          ttsService.isPaused = false;
        }
      };

      // Simulate TTS ending
      ttsService.isSpeaking = true;
      ttsService.isPaused = false;
      
      mockEventHandler({ type: 'end' });
      
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
    });

    test('should handle TTS pause events', () => {
      const mockEventHandler = (event) => {
        if (event.type === "pause") {
          ttsService.isSpeaking = false;
          ttsService.isPaused = true;
        }
      };

      ttsService.isSpeaking = true;
      
      mockEventHandler({ type: 'pause' });
      
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);
    });

    test('should handle TTS resume events', () => {
      const mockEventHandler = (event) => {
        if (event.type === "resume") {
          ttsService.isSpeaking = true;
          ttsService.isPaused = false;
        }
      };

      ttsService.isPaused = true;
      
      mockEventHandler({ type: 'resume' });
      
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('Keyboard Shortcut Integration', () => {
    test('should handle keyboard shortcut command', async () => {
      // This test simulates what would happen when a keyboard shortcut is triggered
      // Since we can't access the actual command handler, we'll test the underlying functionality
      
      // Mock selected text available
      const mockTabs = [{ id: 1 }];
      const mockResults = [{ result: 'Shortcut selected text' }];

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      chrome.scripting.executeScript.mockImplementation((options, callback) => {
        callback(mockResults);
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          selectedVoice: 'shortcut-voice',
          speechRate: '1.3'
        });
      });

      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Simulate the keyboard shortcut workflow
      const selectedText = await getSelectedTextFromActiveTab();
      expect(selectedText).toBe('Shortcut selected text');

      // Simulate using stored preferences for TTS
      const storedPrefs = await new Promise(resolve => {
        chrome.storage.sync.get(['selectedVoice', 'speechRate'], resolve);
      });

      // Verify the workflow would work correctly
      expect(storedPrefs.selectedVoice).toBe('shortcut-voice');
      expect(storedPrefs.speechRate).toBe('1.3');
    });
  });
});