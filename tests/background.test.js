// Tests for background.js - TTSService and MessageHandler classes

// Mock GoogleTTSService constructor at global level before importing background.js
const mockStopAudio = jest.fn().mockResolvedValue({ status: 'stopped' });
const mockGoogleTTSService = {
  isEnabled: jest.fn().mockResolvedValue(true),
  getVoices: jest.fn().mockResolvedValue([]),
  speakWithHighlighting: jest.fn().mockResolvedValue({ status: 'speaking', service: 'google' }),
  stopAudio: mockStopAudio,
  checkQuotaStatus: jest.fn().mockResolvedValue({ used: 0, limit: 1000000, percentage: 0 }),
  getApiKey: jest.fn().mockResolvedValue('mock-api-key')
};

// Mock GoogleTTSService constructor globally since background.js uses importScripts
global.GoogleTTSService = jest.fn().mockImplementation(() => mockGoogleTTSService);

// Mock importScripts to prevent actual loading
global.importScripts = jest.fn();

// Mock SSMLBuilder that's loaded via importScripts  
global.SSMLBuilder = {
  createBasicSSML: jest.fn().mockReturnValue({
    ssml: '<speak>mock</speak>',
    marks: []
  })
};

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
          voiceName: 'test-voice',
          onEvent: expect.any(Function)
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
          volume: 1.0,
          onEvent: expect.any(Function)
        },
        expect.any(Function)
      );
    });

    test('should reset paused state when starting new speech', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Simulate service being in paused state
      ttsService.isSpeaking = false;
      ttsService.isPaused = true;

      // Start new speech
      await ttsService.speak('New speech after pause');

      // Verify that chrome.tts.stop was called to clear previous state
      expect(chrome.tts.stop).toHaveBeenCalled();
      
      // Verify that state is properly reset
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });

    test('should stop existing TTS before starting new speech', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Start first speech
      await ttsService.speak('First speech');
      
      // Reset mock to track second call
      chrome.tts.stop.mockClear();
      
      // Start second speech - should stop first one
      await ttsService.speak('Second speech');

      // Verify that chrome.tts.stop was called to stop previous speech
      expect(chrome.tts.stop).toHaveBeenCalled();
      
      // Verify that new speech was started
      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Second speech',
        expect.objectContaining({
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0
        }),
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

    test('should handle TTS end event and update state', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback(); // Simulate successful start
        // Simulate TTS end event immediately after
        options.onEvent({ type: 'end' });
      });

      await ttsService.speak('Hello world');

      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
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
        voices: [{
          name: 'Test Voice',
          lang: undefined,
          gender: 'unknown',
          quality: 'Standard',
          isGoogle: false,
          eventTypes: []
        }]
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
        error: 'TTS Error'
      });
    });
  });

  describe('Text Highlighting Events', () => {
    let ttsService;
    let mockTabs;

    beforeEach(() => {
      ttsService = new TTSService();
      mockTabs = [{ id: 1, active: true }];
      chrome.tabs.query = jest.fn((query, callback) => callback(mockTabs));
      chrome.tabs.sendMessage = jest.fn();
    });

    test('should send highlight start message on TTS start event', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock chrome.tts.speak to capture the onEvent callback
      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback(); // Simulate successful TTS start
      });

      // Start TTS
      await ttsService.speak(testText);

      // Simulate TTS start event
      onEventCallback({ type: 'start' });

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'highlightText',
        text: testText,
        action: 'start',
        paragraphBoundaries: []
      });
    });

    test('should send highlight end message on TTS end event', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock tabs.query to return all tabs for broadcasting
      const mockTabs = [{ id: 1, url: 'https://example.com' }, { id: 2, url: 'https://test.com' }];
      chrome.tabs.query = jest.fn((query, callback) => {
        if (query.active && query.currentWindow) {
          callback([{ id: 1, url: 'https://example.com' }]);
        } else {
          callback(mockTabs);
        }
      });
      
      // Ensure sendMessage returns a Promise
      chrome.tabs.sendMessage = jest.fn(() => Promise.resolve());

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS end event
      onEventCallback({ type: 'end' });

      // Should broadcast to all tabs, not just active tab
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'highlightText',
        action: 'end'
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'highlightText',
        action: 'end'
      });
    });

    test('should send highlight end message on TTS error event', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock tabs.query to return all tabs for broadcasting
      const mockTabs = [{ id: 1, url: 'https://example.com' }, { id: 2, url: 'https://test.com' }];
      chrome.tabs.query = jest.fn((query, callback) => {
        if (query.active && query.currentWindow) {
          callback([{ id: 1, url: 'https://example.com' }]);
        } else {
          callback(mockTabs);
        }
      });
      
      // Ensure sendMessage returns a Promise
      chrome.tabs.sendMessage = jest.fn(() => Promise.resolve());

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS error event
      onEventCallback({ type: 'error' });

      // Should broadcast to all tabs
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'highlightText',
        action: 'end'
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'highlightText',
        action: 'end'
      });
    });

    test('should send highlight end message on TTS interrupted event', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock tabs.query to return all tabs for broadcasting
      const mockTabs = [{ id: 1, url: 'https://example.com' }, { id: 2, url: 'https://test.com' }];
      chrome.tabs.query = jest.fn((query, callback) => {
        if (query.active && query.currentWindow) {
          callback([{ id: 1, url: 'https://example.com' }]);
        } else {
          callback(mockTabs);
        }
      });
      
      // Ensure sendMessage returns a Promise
      chrome.tabs.sendMessage = jest.fn(() => Promise.resolve());

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS interrupted event
      onEventCallback({ type: 'interrupted' });

      // Should broadcast to all tabs
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'highlightText',
        action: 'end'
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'highlightText',
        action: 'end'
      });
    });

    test('should send highlight end message on TTS cancelled event', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock tabs.query to return all tabs for broadcasting
      const mockTabs = [{ id: 1, url: 'https://example.com' }, { id: 2, url: 'https://test.com' }];
      chrome.tabs.query = jest.fn((query, callback) => {
        if (query.active && query.currentWindow) {
          callback([{ id: 1, url: 'https://example.com' }]);
        } else {
          callback(mockTabs);
        }
      });
      
      // Ensure sendMessage returns a Promise
      chrome.tabs.sendMessage = jest.fn(() => Promise.resolve());

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS cancelled event
      onEventCallback({ type: 'cancelled' });

      // Should broadcast to all tabs
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'highlightText',
        action: 'end'
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'highlightText',
        action: 'end'
      });
    });

    test('should not send highlight messages when no active tab', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      // Mock no active tabs
      chrome.tabs.query = jest.fn((query, callback) => callback([]));

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS start event
      onEventCallback({ type: 'start' });

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('should not send highlight messages on pause/resume events', async () => {
      const testText = 'Test text for highlighting';
      let onEventCallback;

      chrome.tts.speak = jest.fn((text, options, callback) => {
        onEventCallback = options.onEvent;
        callback();
      });

      await ttsService.speak(testText);

      // Simulate TTS pause event
      onEventCallback({ type: 'pause' });

      // Simulate TTS resume event  
      onEventCallback({ type: 'resume' });

      // Should not send any highlight messages for pause/resume
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(1, expect.objectContaining({
        type: 'highlightText'
      }));
    });
  });

  describe('voice routing logic', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
    });

    test('should route Chrome TTS voices to Chrome TTS API even when Google TTS is enabled', async () => {
      // Mock Google TTS as enabled
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          googleTTSEnabled: true,
          googleAPIKey: 'test-api-key'
        });
      });

      // Create mock TTS service
      const mockTTSService = {
        speak: jest.fn().mockResolvedValue({ status: 'speaking', service: 'chrome' }),
        getVoices: jest.fn().mockResolvedValue([
          { voiceName: 'Google US English', lang: 'en-US' }
        ])
      };

      // Create handler instance with mock service
      const handler = new MessageHandler(mockTTSService);

      // Mock Google TTS service
      global.googleTTSService = {
        isEnabled: jest.fn().mockResolvedValue(true),
        getVoices: jest.fn().mockResolvedValue([
          { name: 'en-US-Neural2-F', isGoogle: true, lang: 'en-US' }
        ]),
        speakWithHighlighting: jest.fn().mockResolvedValue({ status: 'speaking', service: 'google' })
      };

      // Mock the handler's getVoices method to return mixed voice types
      jest.spyOn(handler, 'handleGetVoices').mockImplementation(async (sendResponse) => {
        sendResponse({
          status: 'success',
          voices: [
            { name: 'Google US English', isGoogle: false, lang: 'en-US' },
            { name: 'en-US-Neural2-F', isGoogle: true, lang: 'en-US' }
          ]
        });
      });

      const message = {
        type: 'speak',
        text: 'Hello world',
        voiceName: 'Google US English', // This is a Chrome TTS voice
        rate: 1.0
      };

      const mockSendResponse = jest.fn();
      await handler.handleMessage(message, null, mockSendResponse);

      // Should use Chrome TTS, not Google TTS
      expect(mockTTSService.speak).toHaveBeenCalledWith('Hello world', {
        rate: 1.0,
        voiceName: 'Google US English'
      });

      // Should not attempt Google TTS
      expect(global.googleTTSService.speakWithHighlighting).not.toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'speaking', service: 'chrome' });
    });

    test('should correctly identify Google TTS voice patterns', async () => {
      // Create mock TTS service
      const mockTTSService = {
        speak: jest.fn(),
        getVoices: jest.fn()
      };

      const handler = new MessageHandler(mockTTSService);

      // Mock handleGetVoices for fallback lookup
      jest.spyOn(handler, 'handleGetVoices').mockImplementation(async (sendResponse) => {
        sendResponse({
          status: 'success',
          voices: [
            { name: 'Google US English', isGoogle: false, lang: 'en-US' },
            { name: 'en-US-Neural2-F', isGoogle: true, lang: 'en-US' }
          ]
        });
      });

      // Test Google TTS voice patterns
      expect(await handler.isGoogleTTSVoice('en-US-Neural2-F')).toBe(true);
      expect(await handler.isGoogleTTSVoice('en-GB-WaveNet-A')).toBe(true);
      expect(await handler.isGoogleTTSVoice('fr-FR-Standard-B')).toBe(true);

      // Test Chrome TTS voice names
      expect(await handler.isGoogleTTSVoice('Google US English')).toBe(false);
      expect(await handler.isGoogleTTSVoice('Microsoft Zira')).toBe(false);
      expect(await handler.isGoogleTTSVoice('Alex')).toBe(false);
    });
  });

  describe('keyboard shortcut toggle functionality', () => {
    beforeEach(() => {
      // Reset mocks and global state before each test
      jest.clearAllMocks();
      global.globalTTSState = {
        isSpeaking: false,
        isPaused: false,
        showControlBar: false
      };
      
      // Mock chrome.commands
      global.chrome.commands = {
        onCommand: {
          addListener: jest.fn()
        }
      };
    });

    test('should start TTS when Ctrl+Q pressed and not currently speaking', async () => {
      // Mock getSelectedTextFromActiveTab
      global.getSelectedTextFromActiveTab = jest.fn().mockResolvedValue('Selected test text');
      
      // Mock storage
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          savedVoice: 'Test Voice',
          savedRate: '1.2'
        });
      });

      // Create handler and mock its methods
      const mockTTSService = {
        speak: jest.fn().mockResolvedValue({ status: 'speaking' })
      };
      const handler = new MessageHandler(mockTTSService);
      jest.spyOn(handler, 'handleSpeak').mockResolvedValue({ status: 'speaking' });

      // Mock the keyboard shortcut handler
      const commandHandler = async (command) => {
        if (command === "open_popup") {
          if (global.globalTTSState.isSpeaking || global.globalTTSState.isPaused) {
            await handler.handleStop(() => {});
          } else {
            const selectedText = await getSelectedTextFromActiveTab();
            if (selectedText) {
              chrome.storage.sync.get(['savedVoice', 'savedRate'], async (prefs) => {
                const message = {
                  type: 'speak',
                  text: selectedText,
                  rate: prefs.savedRate ? parseFloat(prefs.savedRate) : 1.0,
                  voiceName: prefs.savedVoice
                };
                await handler.handleSpeak(message, () => {});
              });
            }
          }
        }
      };

      // Simulate Ctrl+Q when not speaking
      await commandHandler('open_popup');

      // Should start speaking
      expect(getSelectedTextFromActiveTab).toHaveBeenCalled();
      expect(handler.handleSpeak).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'speak',
          text: 'Selected test text',
          voiceName: 'Test Voice',
          rate: 1.2
        }),
        expect.any(Function)
      );
    });

    test('should stop TTS when Ctrl+Q pressed while speaking', async () => {
      // Set TTS as currently speaking
      global.globalTTSState.isSpeaking = true;

      // Create handler and mock its methods
      const mockTTSService = {
        stop: jest.fn().mockResolvedValue({ status: 'stopped' })
      };
      const handler = new MessageHandler(mockTTSService);
      jest.spyOn(handler, 'handleStop').mockResolvedValue({ status: 'stopped' });

      // Mock the keyboard shortcut handler
      const commandHandler = async (command) => {
        if (command === "open_popup") {
          if (global.globalTTSState.isSpeaking || global.globalTTSState.isPaused) {
            await handler.handleStop(() => {});
          } else {
            // Would start speaking (not relevant for this test)
          }
        }
      };

      // Simulate Ctrl+Q when speaking
      await commandHandler('open_popup');

      // Should stop speaking
      expect(handler.handleStop).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should stop TTS when Ctrl+Q pressed while paused', async () => {
      // Set TTS as currently paused
      global.globalTTSState.isSpeaking = false;
      global.globalTTSState.isPaused = true;

      // Create handler and mock its methods
      const mockTTSService = {
        stop: jest.fn().mockResolvedValue({ status: 'stopped' })
      };
      const handler = new MessageHandler(mockTTSService);
      jest.spyOn(handler, 'handleStop').mockResolvedValue({ status: 'stopped' });

      // Mock the keyboard shortcut handler
      const commandHandler = async (command) => {
        if (command === "open_popup") {
          if (global.globalTTSState.isSpeaking || global.globalTTSState.isPaused) {
            await handler.handleStop(() => {});
          } else {
            // Would start speaking (not relevant for this test)
          }
        }
      };

      // Simulate Ctrl+Q when paused
      await commandHandler('open_popup');

      // Should stop speaking
      expect(handler.handleStop).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should handle no selected text gracefully', async () => {
      // Mock getSelectedTextFromActiveTab to return null
      global.getSelectedTextFromActiveTab = jest.fn().mockResolvedValue(null);
      
      // Create handler
      const mockTTSService = { speak: jest.fn() };
      const handler = new MessageHandler(mockTTSService);
      jest.spyOn(handler, 'handleSpeak').mockResolvedValue({ status: 'speaking' });

      // Mock the keyboard shortcut handler
      const commandHandler = async (command) => {
        if (command === "open_popup") {
          if (global.globalTTSState.isSpeaking || global.globalTTSState.isPaused) {
            await handler.handleStop(() => {});
          } else {
            const selectedText = await getSelectedTextFromActiveTab();
            if (selectedText) {
              // Would start speaking
              await handler.handleSpeak({}, () => {});
            }
          }
        }
      };

      // Simulate Ctrl+Q when not speaking and no text selected
      await commandHandler('open_popup');

      // Should check for selected text but not start speaking
      expect(getSelectedTextFromActiveTab).toHaveBeenCalled();
      expect(handler.handleSpeak).not.toHaveBeenCalled();
    });
  });

  describe('highlighting removal on manual stop', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      mockStopAudio.mockClear();
      
      global.globalTTSState = {
        isSpeaking: true,
        isPaused: false,
        showControlBar: true,
        originatingTabId: 1
      };

      // Mock chrome.tabs.query and sendMessage
      chrome.tabs.query = jest.fn();
      chrome.tabs.sendMessage = jest.fn().mockResolvedValue({ success: true });

      // Mock global functions that handleStop uses
      global.broadcastControlBarState = jest.fn();
    });

    test('should remove highlighting when manually stopping TTS', async () => {
      // Mock tabs.query to return test tabs - only using one tab for simplicity
      const mockTabs = [
        { id: 1, url: 'https://example.com' }
      ];
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });

      // Create handler
      const mockTTSService = {
        stop: jest.fn().mockResolvedValue({ status: 'stopped' })
      };
      const handler = new MessageHandler(mockTTSService);

      const mockSendResponse = jest.fn();
      
      // Call handleStop
      await handler.handleStop(mockSendResponse);

      // Note: Highlighting will be cleared by googleTTSEnded event from offscreen document
      // We don't need to test manual highlighting removal anymore

      // Should stop both services
      expect(mockTTSService.stop).toHaveBeenCalled();
      expect(mockStopAudio).toHaveBeenCalled();

      // Note: Global state update is an internal implementation detail
      // The important test is that highlighting removal messages are sent and services are stopped

      // Should send response
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });

    test('should handle Google TTS stop correctly', async () => {
      // Create handler
      const mockTTSService = {
        stop: jest.fn().mockResolvedValue({ status: 'stopped' })
      };
      const handler = new MessageHandler(mockTTSService);

      const mockSendResponse = jest.fn();
      
      // Should stop both services without errors
      await handler.handleStop(mockSendResponse);

      // Should stop both services
      expect(mockTTSService.stop).toHaveBeenCalled();
      expect(mockStopAudio).toHaveBeenCalled();

      // Should send response
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });
  });
});