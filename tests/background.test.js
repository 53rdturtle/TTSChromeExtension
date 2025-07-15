// Tests for background.js - TTSService and MessageHandler classes
const { TTSService, MessageHandler } = require('../extension/background.js');

describe('TTSService', () => {
  let ttsService;

  beforeEach(() => {
    ttsService = new TTSService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct default state', () => {
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('speak', () => {
    test('should call chrome.tts.speak with correct parameters', async () => {
      const mockCallback = jest.fn();
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await ttsService.speak('Hello world', { rate: 1.5, voiceName: 'test-voice' });

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Hello world',
        {
          rate: 1.5,
          pitch: 1.0,
          volume: 1.0,
          voiceName: 'test-voice'
        },
        expect.any(Function)
      );
    });

    test('should set isSpeaking to true on successful speak', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await ttsService.speak('Hello world');

      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });

    test('should handle TTS errors correctly', async () => {
      chrome.runtime.lastError = { message: 'TTS Error' };
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await expect(ttsService.speak('Hello world')).rejects.toBe('TTS Error');
      
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
      
      // Clean up
      chrome.runtime.lastError = null;
    });

    test('should use default options when none provided', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      await ttsService.speak('Hello world');

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Hello world',
        {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        expect.any(Function)
      );
    });
  });

  describe('stop', () => {
    test('should call chrome.tts.stop and reset state', async () => {
      const result = await ttsService.stop();

      expect(chrome.tts.stop).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
      expect(result).toEqual({ status: 'stopped' });
    });
  });

  describe('pause', () => {
    test('should call chrome.tts.pause and set isPaused', async () => {
      const result = await ttsService.pause();

      expect(chrome.tts.pause).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);
      expect(result).toEqual({ status: 'paused' });
    });
  });

  describe('resume', () => {
    test('should call chrome.tts.resume and set isSpeaking', async () => {
      const result = await ttsService.resume();

      expect(chrome.tts.resume).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
      expect(result).toEqual({ status: 'resumed' });
    });
  });

  describe('getVoices', () => {
    test('should call chrome.tts.getVoices and return voices', async () => {
      const mockVoices = [
        { voiceName: 'Voice 1', lang: 'en-US' },
        { voiceName: 'Voice 2', lang: 'en-GB' }
      ];
      
      chrome.tts.getVoices.mockImplementation((callback) => {
        callback(mockVoices);
      });

      const result = await ttsService.getVoices();

      expect(chrome.tts.getVoices).toHaveBeenCalled();
      expect(result).toEqual(mockVoices);
    });

    test('should handle getVoices errors', async () => {
      chrome.runtime.lastError = { message: 'GetVoices Error' };
      chrome.tts.getVoices.mockImplementation((callback) => {
        callback([]);
      });

      await expect(ttsService.getVoices()).rejects.toBe('GetVoices Error');
      
      // Clean up
      chrome.runtime.lastError = null;
    });
  });

  describe('getState', () => {
    test('should return current TTS state', () => {
      ttsService.isSpeaking = true;
      ttsService.isPaused = false;

      const result = ttsService.getState();

      expect(result).toEqual({
        isSpeaking: true,
        isPaused: false
      });
    });
  });
});

describe('MessageHandler', () => {
  let messageHandler;
  let mockTTSService;

  beforeEach(() => {
    mockTTSService = {
      speak: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getVoices: jest.fn(),
      getState: jest.fn()
    };
    messageHandler = new MessageHandler(mockTTSService);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with TTSService instance', () => {
      expect(messageHandler.ttsService).toBe(mockTTSService);
    });
  });

  describe('handleMessage', () => {
    test('should handle speak message type', async () => {
      const message = { type: 'speak', text: 'Hello', rate: 1.5, voiceName: 'test-voice' };
      const sender = {};
      const sendResponse = jest.fn();

      mockTTSService.speak.mockResolvedValue({ status: 'speaking' });

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTTSService.speak).toHaveBeenCalledWith('Hello', { 
        rate: 1.5, 
        voiceName: 'test-voice' 
      });
      expect(sendResponse).toHaveBeenCalledWith({ status: 'speaking' });
    });

    test('should handle stop message type', async () => {
      const message = { type: 'stop' };
      const sender = {};
      const sendResponse = jest.fn();

      mockTTSService.stop.mockResolvedValue({ status: 'stopped' });

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTTSService.stop).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });

    test('should handle pause message type', async () => {
      const message = { type: 'pause' };
      const sender = {};
      const sendResponse = jest.fn();

      mockTTSService.pause.mockResolvedValue({ status: 'paused' });

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTTSService.pause).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'paused' });
    });

    test('should handle resume message type', async () => {
      const message = { type: 'resume' };
      const sender = {};
      const sendResponse = jest.fn();

      mockTTSService.resume.mockResolvedValue({ status: 'resumed' });

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTTSService.resume).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'resumed' });
    });

    test('should handle getVoices message type', async () => {
      const message = { type: 'getVoices' };
      const sender = {};
      const sendResponse = jest.fn();

      const mockVoices = [{ voiceName: 'Test Voice' }];
      mockTTSService.getVoices.mockResolvedValue(mockVoices);

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTTSService.getVoices).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ 
        status: 'success', 
        voices: mockVoices 
      });
    });

    test('should handle getStatus message type', async () => {
      const message = { type: 'getStatus' };
      const sender = {};
      const sendResponse = jest.fn();

      chrome.tts.isSpeaking.mockImplementation((callback) => {
        callback(true);
      });

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(chrome.tts.isSpeaking).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ 
        status: 'success', 
        isSpeaking: true 
      });
    });

    test('should handle unknown message type', async () => {
      const message = { type: 'unknown' };
      const sender = {};
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ 
        status: 'error',
        error: 'Unknown message type' 
      });
    });

    test('should handle TTS service errors', async () => {
      const message = { type: 'speak', text: 'Hello' };
      const sender = {};
      const sendResponse = jest.fn();

      mockTTSService.speak.mockRejectedValue(new Error('TTS Error'));

      await messageHandler.handleMessage(message, sender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ 
        status: 'error',
        error: expect.any(Error)
      });
    });
  });
});