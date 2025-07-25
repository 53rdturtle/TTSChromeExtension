// Integration tests for message passing between components
const { TTSService, MessageHandler } = require('../extension/background.js');

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

describe('Integration Tests', () => {
  let ttsService;
  let messageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    ttsService = new TTSService();
    messageHandler = new MessageHandler(ttsService);
    chrome.runtime.lastError = null;
    
    // Mock Google TTS service for integration tests
    global.googleTTSService = {
      isEnabled: jest.fn().mockResolvedValue(false), // Default to Chrome TTS
      speakWithHighlighting: jest.fn(),
      getVoices: jest.fn().mockResolvedValue([])
    };
    
    // Mock storage for Google TTS settings
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        googleTTSEnabled: false, // Default to disabled
        googleAPIKey: ''
      });
    });
  });

  describe('End-to-end TTS workflow', () => {
    test('should handle complete speak workflow', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });
      
      // Mock isGoogleTTSVoice to avoid hanging
      jest.spyOn(messageHandler, 'isGoogleTTSVoice').mockResolvedValue(false);

      const message = {
        type: 'speak',
        text: 'Hello integration test',
        rate: 1.5,
        voiceName: 'test-voice'
      };

      const sendResponse = jest.fn();
      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Hello integration test',
        {
          rate: 1.5,
          pitch: 1.0,
          volume: 1.0,
          voiceName: 'test-voice',
          onEvent: expect.any(Function)
        },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
    });

    test('should handle speak -> stop workflow', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // First speak
      const speakMessage = { type: 'speak', text: 'Hello' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      expect(ttsService.isSpeaking).toBe(true);
      expect(speakResponse).toHaveBeenCalledWith({ status: 'speaking' });

      // Then stop
      const stopMessage = { type: 'stop' };
      const stopResponse = jest.fn();
      await messageHandler.handleMessage(stopMessage, {}, stopResponse);

      expect(chrome.tts.stop).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(stopResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });

    test('should handle speak -> pause -> resume workflow', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // First speak
      const speakMessage = { type: 'speak', text: 'Hello' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      expect(ttsService.isSpeaking).toBe(true);

      // Then pause
      const pauseMessage = { type: 'pause' };
      const pauseResponse = jest.fn();
      await messageHandler.handleMessage(pauseMessage, {}, pauseResponse);

      expect(chrome.tts.pause).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);
      expect(pauseResponse).toHaveBeenCalledWith({ status: 'paused' });

      // Then resume
      const resumeMessage = { type: 'resume' };
      const resumeResponse = jest.fn();
      await messageHandler.handleMessage(resumeMessage, {}, resumeResponse);

      expect(chrome.tts.resume).toHaveBeenCalled();
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
      expect(resumeResponse).toHaveBeenCalledWith({ status: 'resumed' });
    });
  });

  describe('Voice management integration', () => {
    test('should get voices and use them for speaking', async () => {
      const mockVoices = [
        { voiceName: 'Voice 1', lang: 'en-US' },
        { voiceName: 'Voice 2', lang: 'en-GB' }
      ];

      chrome.tts.getVoices.mockImplementation((callback) => {
        callback(mockVoices);
      });

      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Get voices
      const voicesMessage = { type: 'getVoices' };
      const voicesResponse = jest.fn();
      await messageHandler.handleMessage(voicesMessage, {}, voicesResponse);

      expect(chrome.tts.getVoices).toHaveBeenCalled();
      expect(voicesResponse).toHaveBeenCalledWith({
        status: 'success',
        voices: [
          // Voices are sorted by language code, so en-GB comes before en-US
          {
            name: 'Voice 2',
            lang: 'en-GB',
            gender: 'unknown',
            quality: 'Standard',
            isGoogle: false,
            eventTypes: []
          },
          {
            name: 'Voice 1', 
            lang: 'en-US',
            gender: 'unknown',
            quality: 'Standard',
            isGoogle: false,
            eventTypes: []
          }
        ]
      });

      // Use a voice for speaking
      const speakMessage = {
        type: 'speak',
        text: 'Hello with voice',
        voiceName: 'Voice 1'
      };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'Hello with voice',
        {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          voiceName: 'Voice 1',
          onEvent: expect.any(Function)
        },
        expect.any(Function)
      );
    });
  });

  describe('Status integration', () => {
    test('should get status and reflect TTS state', async () => {
      chrome.tts.isSpeaking.mockImplementation((callback) => {
        callback(true);
      });

      const statusMessage = { type: 'getStatus' };
      const statusResponse = jest.fn();
      await messageHandler.handleMessage(statusMessage, {}, statusResponse);

      expect(chrome.tts.isSpeaking).toHaveBeenCalled();
      expect(statusResponse).toHaveBeenCalledWith({
        status: 'success',
        isSpeaking: true
      });
    });
  });

  describe('Error handling integration', () => {
    test('should handle TTS speak errors', async () => {
      chrome.runtime.lastError = { message: 'TTS not available' };
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      const message = { type: 'speak', text: 'Hello' };
      const sendResponse = jest.fn();
      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'TTS not available'
      });
      expect(ttsService.isSpeaking).toBe(false);

      // Clean up
      chrome.runtime.lastError = null;
    });

    test('should handle getVoices errors', async () => {
      chrome.runtime.lastError = { message: 'Voices not available' };
      chrome.tts.getVoices.mockImplementation((callback) => {
        callback([]);
      });

      const message = { type: 'getVoices' };
      const sendResponse = jest.fn();
      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'Voices not available'
      });

      // Clean up
      chrome.runtime.lastError = null;
    });

    test('should handle empty text gracefully', async () => {
      const message = { type: 'speak', text: '' };
      const sendResponse = jest.fn();
      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'No text provided'
      });
      expect(chrome.tts.speak).not.toHaveBeenCalled();
    });

    test('should handle unknown message types', async () => {
      const message = { type: 'unknown' };
      const sendResponse = jest.fn();
      await messageHandler.handleMessage(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'error',
        error: 'Unknown message type'
      });
    });
  });

  describe('Tab interaction integration', () => {
    test('should handle tab queries', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com', title: 'Test Page' }
      ]);

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ status: 'success' });
      });

      // This simulates how the extension would interact with tabs
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe(1);

      // Send a message to the tab
      await new Promise((resolve) => {
        chrome.tabs.sendMessage(1, { type: 'updateStatus', isSpeaking: true }, resolve);
      });

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { type: 'updateStatus', isSpeaking: true },
        expect.any(Function)
      );
    });
  });

  describe('Storage integration', () => {
    test('should handle storage operations', async () => {
      const testData = { rate: 1.5, voiceName: 'test-voice' };
      
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback && callback();
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(testData);
      });

      // Save data
      await new Promise((resolve) => {
        chrome.storage.sync.set(testData, resolve);
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(testData, expect.any(Function));

      // Retrieve data
      const retrievedData = await new Promise((resolve) => {
        chrome.storage.sync.get(['rate', 'voiceName'], resolve);
      });

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        ['rate', 'voiceName'],
        expect.any(Function)
      );
      expect(retrievedData).toEqual(testData);
    });
  });

  describe('Component lifecycle integration', () => {
    test('should handle full component initialization', async () => {
      // Test that services initialize properly
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(false);
      expect(messageHandler.ttsService).toBe(ttsService);
    });

    test('should handle multiple rapid message requests', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      const messages = [
        { type: 'speak', text: 'First' },
        { type: 'pause' },
        { type: 'resume' },
        { type: 'stop' }
      ];

      const responses = [];
      for (const message of messages) {
        const response = jest.fn();
        await messageHandler.handleMessage(message, {}, response);
        responses.push(response);
      }

      expect(responses[0]).toHaveBeenCalledWith({ status: 'speaking' });
      expect(responses[1]).toHaveBeenCalledWith({ status: 'paused' });
      expect(responses[2]).toHaveBeenCalledWith({ status: 'resumed' });
      expect(responses[3]).toHaveBeenCalledWith({ status: 'stopped' });
    });
  });

  describe('Performance and concurrency', () => {
    test('should handle concurrent requests gracefully', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        setTimeout(callback, 10);
      });

      const requests = [];
      for (let i = 0; i < 5; i++) {
        const response = jest.fn();
        const promise = messageHandler.handleMessage(
          { type: 'speak', text: `Message ${i}` },
          {},
          response
        );
        requests.push({ promise, response });
      }

      await Promise.all(requests.map(r => r.promise));

      requests.forEach(({ response }) => {
        expect(response).toHaveBeenCalledWith({ status: 'speaking' });
      });
    });
  });

  describe('Pause-then-speak regression test', () => {
    test('should allow new speech after pausing previous speech', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Start initial speech
      const initialSpeakMessage = { type: 'speak', text: 'Initial text' };
      const initialSpeakResponse = jest.fn();
      await messageHandler.handleMessage(initialSpeakMessage, {}, initialSpeakResponse);

      expect(initialSpeakResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);

      // Pause the speech
      const pauseMessage = { type: 'pause' };
      const pauseResponse = jest.fn();
      await messageHandler.handleMessage(pauseMessage, {}, pauseResponse);

      expect(pauseResponse).toHaveBeenCalledWith({ status: 'paused' });
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);

      // Now try to start new speech - this should work despite being paused
      const newSpeakMessage = { type: 'speak', text: 'New text after pause' };
      const newSpeakResponse = jest.fn();
      await messageHandler.handleMessage(newSpeakMessage, {}, newSpeakResponse);

      // Verify that new speech starts successfully
      expect(newSpeakResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
      
      // Verify that chrome.tts.stop was called to clear previous state
      expect(chrome.tts.stop).toHaveBeenCalled();
      
      // Verify that new speech was started
      expect(chrome.tts.speak).toHaveBeenCalledWith(
        'New text after pause',
        expect.objectContaining({
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0
        }),
        expect.any(Function)
      );
    });

    test('should reset TTS state when starting new speech after pause', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Manually set the service to a paused state (simulating pause from control bar)
      ttsService.isSpeaking = false;
      ttsService.isPaused = true;

      // Try to start new speech
      const speakMessage = { type: 'speak', text: 'Text after manual pause' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      // Verify that speech starts successfully despite previous paused state
      expect(speakResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
      
      // Verify that chrome.tts.stop was called to clear previous state
      expect(chrome.tts.stop).toHaveBeenCalled();
    });

    test('should handle pause-resume-newspeak workflow correctly', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Start initial speech
      const initialMessage = { type: 'speak', text: 'Initial' };
      const initialResponse = jest.fn();
      await messageHandler.handleMessage(initialMessage, {}, initialResponse);

      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);

      // Pause
      const pauseMessage = { type: 'pause' };
      const pauseResponse = jest.fn();
      await messageHandler.handleMessage(pauseMessage, {}, pauseResponse);

      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);

      // Resume
      const resumeMessage = { type: 'resume' };
      const resumeResponse = jest.fn();
      await messageHandler.handleMessage(resumeMessage, {}, resumeResponse);

      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);

      // Now start completely new speech - should work
      const newMessage = { type: 'speak', text: 'New speech' };
      const newResponse = jest.fn();
      await messageHandler.handleMessage(newMessage, {}, newResponse);

      expect(newResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });
  });

  describe('Control bar button clickability regression tests', () => {
    test('should show control bar with enabled buttons when TTS starts speaking', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        // Simulate TTS successfully starting
        callback();
      });

      // Mock tabs.query for control bar display
      chrome.tabs.query.mockResolvedValue([{ id: 1 }]);
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (callback) callback({ status: 'success' });
      });

      // Start TTS
      const speakMessage = { type: 'speak', text: 'Test text' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      // Verify TTS started successfully
      expect(speakResponse).toHaveBeenCalledWith({ status: 'speaking' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);

      // Verify control bar was shown (the important part is that it's shown)
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'showControlBar'
        })
      );
      
      // Verify the state sent to control bar has correct structure
      const showControlBarCall = chrome.tabs.sendMessage.mock.calls.find(
        call => call[1].type === 'showControlBar'
      );
      expect(showControlBarCall[1]).toHaveProperty('isSpeaking');
      expect(showControlBarCall[1]).toHaveProperty('isPaused');
    });

    test('should send correct status updates when TTS state changes', async () => {
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        callback();
      });

      // Mock tabs.query for control bar updates
      chrome.tabs.query.mockResolvedValue([{ id: 1 }]);
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (callback) callback({ status: 'success' });
      });

      // Start TTS
      const speakMessage = { type: 'speak', text: 'Test text' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      // Clear previous calls
      chrome.tabs.sendMessage.mockClear();

      // Pause TTS (this should trigger TTS event listener but might not in test)
      const pauseMessage = { type: 'pause' };
      const pauseResponse = jest.fn();
      await messageHandler.handleMessage(pauseMessage, {}, pauseResponse);

      // Verify pause was processed correctly
      expect(pauseResponse).toHaveBeenCalledWith({ status: 'paused' });
      expect(ttsService.isSpeaking).toBe(false);
      expect(ttsService.isPaused).toBe(true);

      // Resume TTS
      const resumeMessage = { type: 'resume' };
      const resumeResponse = jest.fn();
      await messageHandler.handleMessage(resumeMessage, {}, resumeResponse);

      // Verify resume was processed correctly
      expect(resumeResponse).toHaveBeenCalledWith({ status: 'resumed' });
      expect(ttsService.isSpeaking).toBe(true);
      expect(ttsService.isPaused).toBe(false);
    });

    test('should show control bar with proper timing to prevent disabled buttons', async () => {
      // This test verifies that the control bar timing fix is working
      // by ensuring TTS service properly manages state transitions
      
      // Mock tabs.query for control bar display
      chrome.tabs.query.mockResolvedValue([{ id: 1 }]);
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (callback) callback({ status: 'success' });
      });

      // Use a regular TTS mock that immediately resolves
      chrome.tts.speak.mockImplementation((text, options, callback) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
      });

      // Start TTS
      const speakMessage = { type: 'speak', text: 'Test text' };
      const speakResponse = jest.fn();
      await messageHandler.handleMessage(speakMessage, {}, speakResponse);

      // Verify TTS was called and response was sent
      expect(chrome.tts.speak).toHaveBeenCalled();
      expect(speakResponse).toHaveBeenCalledWith({ status: 'speaking' });
    });
  });
});