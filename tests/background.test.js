// Tests for background.js - TTSService and MessageHandler classes

// Define TTSService class for testing
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

// Define MessageHandler class for testing
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

// Define getSelectedTextFromActiveTab function for testing
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

describe('TTSService', () => {
  let ttsService;

  beforeEach(() => {
    ttsService = new TTSService();
  });

  describe('constructor', () => {
    test('should initialize with correct default state', () => {
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('speak', () => {
    test('should call chrome.tts.speak with correct parameters', async () => {
      const text = 'Hello world';
      const options = { rate: 1.5, pitch: 1.2, volume: 0.8, voiceName: 'test-voice' };
      
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await ttsService.speak(text, options);

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        text,
        expect.objectContaining({
          rate: 1.5,
          pitch: 1.2,
          volume: 0.8,
          voiceName: 'test-voice'
        }),
        expect.any(Function)
      );
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });

    test('should use default options when none provided', async () => {
      const text = 'Hello world';
      
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await ttsService.speak(text);

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        text,
        expect.objectContaining({
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0
        }),
        expect.any(Function)
      );
    });

    test('should handle TTS errors', async () => {
      const text = 'Hello world';
      const errorMessage = 'TTS not available';
      
      chrome.runtime.lastError = { message: errorMessage };
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await expect(ttsService.speak(text)).rejects.toBe(errorMessage);
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('stop', () => {
    test('should call chrome.tts.stop and reset state', async () => {
      ttsService.isSpeaking = true;
      ttsService.isPaused = true;

      const result = await ttsService.stop();

      expect(chrome.tts.stop).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
      expect(result).toEqual({ status: 'stopped' });
    });
  });

  describe('pause', () => {
    test('should call chrome.tts.pause and update state', async () => {
      ttsService.isSpeaking = true;

      const result = await ttsService.pause();

      expect(chrome.tts.pause).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);
      expect(result).toEqual({ status: 'paused' });
    });
  });

  describe('resume', () => {
    test('should call chrome.tts.resume and update state', async () => {
      ttsService.isPaused = true;

      const result = await ttsService.resume();

      expect(chrome.tts.resume).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
      expect(result).toEqual({ status: 'resumed' });
    });
  });

  describe('getVoices', () => {
    test('should return voices from chrome.tts.getVoices', async () => {
      const mockVoices = [
        { voiceName: 'Voice 1', lang: 'en-US', default: true },
        { voiceName: 'Voice 2', lang: 'en-GB', default: false }
      ];

      chrome.tts.getVoices.mockImplementation((callback) => {
        callback(mockVoices);
      });

      const result = await ttsService.getVoices();

      expect(chrome.tts.getVoices).toHaveBeenCalled();
      expect(result).toEqual(mockVoices);
    });

    test('should handle getVoices errors', async () => {
      const errorMessage = 'Failed to get voices';
      chrome.runtime.lastError = { message: errorMessage };

      chrome.tts.getVoices.mockImplementation((callback) => {
        callback([]);
      });

      await expect(ttsService.getVoices()).rejects.toBe(errorMessage);
    });
  });

  describe('getSpeakingStatus', () => {
    test('should return current speaking state', () => {
      ttsService.isSpeaking = true;
      expect(ttsService.getSpeakingStatus()).toBe(true);

      ttsService.isSpeaking = false;
      expect(ttsService.getSpeakingStatus()).toBe(false);
    });
  });

  describe('getState', () => {
    test('should return current TTS state', () => {
      ttsService.isSpeaking = true;
      ttsService.isPaused = false;

      const state = ttsService.getState();

      expect(state).toEqual({
        isSpeaking: true,
        isPaused: false
      });
    });
  });
});

describe('MessageHandler', () => {
  let messageHandler;
  let mockTtsService;

  beforeEach(() => {
    mockTtsService = {
      speak: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getVoices: jest.fn(),
      getSpeakingStatus: jest.fn(),
      getState: jest.fn()
    };
    messageHandler = new MessageHandler(mockTtsService);
  });

  describe('handleMessage', () => {
    test('should handle speak message', async () => {
      const message = { type: 'speak', text: 'Hello world', rate: 1.0, voiceName: 'test-voice' };
      const sendResponse = jest.fn();

      mockTtsService.speak.mockResolvedValue({ status: 'speaking' });

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.speak).toHaveBeenCalledWith('Hello world', {
        rate: 1.0,
        voiceName: 'test-voice'
      });
      expect(sendResponse).toHaveBeenCalledWith({ status: 'speaking' });
    });

    test('should handle speak message with empty text', async () => {
      const message = { type: 'speak', text: '', rate: 1.0 };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.speak).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'No text provided'
      });
    });

    test('should handle stop message', async () => {
      const message = { type: 'stop' };
      const sendResponse = jest.fn();

      mockTtsService.stop.mockResolvedValue({ status: 'stopped' });

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.stop).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });

    test('should handle pause message', async () => {
      const message = { type: 'pause' };
      const sendResponse = jest.fn();

      mockTtsService.pause.mockResolvedValue({ status: 'paused' });

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.pause).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'paused' });
    });

    test('should handle resume message', async () => {
      const message = { type: 'resume' };
      const sendResponse = jest.fn();

      mockTtsService.resume.mockResolvedValue({ status: 'resumed' });

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.resume).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'resumed' });
    });

    test('should handle getVoices message', async () => {
      const message = { type: 'getVoices' };
      const sendResponse = jest.fn();
      const mockVoices = [{ voiceName: 'Test Voice', lang: 'en-US' }];

      mockTtsService.getVoices.mockResolvedValue(mockVoices);

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(mockTtsService.getVoices).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        voices: mockVoices
      });
    });

    test('should handle getStatus message', async () => {
      const message = { type: 'getStatus' };
      const sendResponse = jest.fn();

      chrome.tts.isSpeaking.mockImplementation((callback) => {
        callback(true);
      });

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(chrome.tts.isSpeaking).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        isSpeaking: true
      });
    });

    test('should handle unknown message type', async () => {
      const message = { type: 'unknown' };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'Unknown message type'
      });
    });

    test('should handle errors in message processing', async () => {
      const message = { type: 'speak', text: 'Hello world' };
      const sendResponse = jest.fn();
      const error = new Error('TTS failed');

      mockTtsService.speak.mockRejectedValue(error);

      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: error
      });
    });
  });
});

describe('getSelectedTextFromActiveTab', () => {
  test('should return selected text from active tab', async () => {
    const mockTabs = [{ id: 1, url: 'https://example.com' }];
    const mockResults = [{ result: 'selected text' }];

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback(mockTabs);
    });

    chrome.scripting.executeScript.mockImplementation((options, callback) => {
      callback(mockResults);
    });

    const result = await getSelectedTextFromActiveTab();

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
      windowType: 'normal'
    }, expect.any(Function));

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function)
    }, expect.any(Function));

    expect(result).toBe('selected text');
  });

  test('should return null when no text is selected', async () => {
    const mockTabs = [{ id: 1, url: 'https://example.com' }];
    const mockResults = [{ result: '' }];

    chrome.tabs.query.mockImplementation((query, callback) => {
      callback(mockTabs);
    });

    chrome.scripting.executeScript.mockImplementation((options, callback) => {
      callback(mockResults);
    });

    const result = await getSelectedTextFromActiveTab();

    expect(result).toBe(null);
  });

  test('should handle no active tabs', async () => {
    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([]);
    });

    const result = await getSelectedTextFromActiveTab();

    expect(result).toBe(null);
  });
});