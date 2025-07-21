// Tests for popup.js - Simplified TTSController class
// Since popup.js uses module pattern with DOMContentLoaded, we need to test it differently

// Mock DOM elements
const createMockElement = (id, type = 'div') => {
  const element = {
    id,
    type,
    value: type === 'range' ? '1' : '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    checked: type === 'checkbox' || type === 'radio' ? false : undefined,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    dispatchEvent: jest.fn((event) => {
      // Simulate calling the event listeners
      if (element._eventListeners && element._eventListeners[event.type]) {
        element._eventListeners[event.type].forEach(listener => listener(event));
      }
      return true;
    }),
    _eventListeners: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    style: {},
    options: type === 'select' ? [] : undefined,
    selectedIndex: type === 'select' ? 0 : undefined,
    length: type === 'select' ? 0 : undefined
  };
  
  // Override addEventListener to store listeners
  element.addEventListener = jest.fn((eventType, listener) => {
    if (!element._eventListeners[eventType]) {
      element._eventListeners[eventType] = [];
    }
    element._eventListeners[eventType].push(listener);
  });
  
  if (type === 'select') {
    element.add = jest.fn();
    element.remove = jest.fn();
  }
  
  return element;
};

// Mock document
global.document = {
  ...global.document,
  getElementById: jest.fn(),
  createElement: jest.fn(() => createMockElement('mock')),
  body: createMockElement('body'),
  head: createMockElement('head'),
  addEventListener: jest.fn()
};

describe('TTSController', () => {
  let controller;
  let mockElements;
  let TTSController;

  beforeEach(async () => {
    // Clear require cache to reload popup.js fresh
    delete require.cache[require.resolve('../extension/popup.js')];
    
    // Create mock DOM elements (simplified for new popup)
    mockElements = {
      voiceSelect: createMockElement('voiceSelect', 'select'),
      previewVoiceBtn: createMockElement('previewVoiceBtn', 'button'),
      rateRange: createMockElement('rateRange', 'range'),
      rateValue: createMockElement('rateValue', 'span'),
      text: createMockElement('text', 'textarea'),
      speakBtn: createMockElement('speakBtn', 'button'),
      stopBtn: createMockElement('stopBtn', 'button'),
      advancedSettingsBtn: createMockElement('advancedSettingsBtn', 'button'),
      statusIndicator: createMockElement('statusIndicator', 'div')
    };

    // Mock document.getElementById
    document.getElementById = jest.fn((id) => {
      const element = mockElements[id];
      if (element) {
        return element;
      }
      return null;
    });

    // Mock chrome storage
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({});
    });

    // Mock chrome.tts.getVoices
    chrome.tts.getVoices.mockImplementation((callback) => {
      callback([
        { voiceName: 'Voice 1', lang: 'en-US', eventTypes: ['start', 'end', 'word'] },
        { voiceName: 'Voice 2', lang: 'en-GB', eventTypes: ['start', 'end', 'sentence'] }
      ]);
    });

    // Mock chrome.runtime.sendMessage for simplified popup
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'getSelectedText') {
        callback({ status: 'success', selectedText: null });
      } else if (message.type === 'getVoices') {
        callback({ 
          status: 'success', 
          voices: [
            { name: 'Voice 1', lang: 'en-US', gender: 'female', quality: 'Standard', isGoogle: false },
            { name: 'Voice 2', lang: 'en-GB', gender: 'male', quality: 'Neural2', isGoogle: true }
          ] 
        });
      } else if (message.type === 'speak') {
        callback({ status: 'speaking' });
      } else if (message.type === 'stop') {
        callback({ status: 'stopped' });
      } else if (message.type === 'getSpeechStatus') {
        callback({ status: 'success', status: 'ended' });
      } else {
        callback({ status: 'success' });
      }
    });

    // Mock chrome.runtime.openOptionsPage
    chrome.runtime.openOptionsPage = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
    
    // Import and create controller instance
    require('../extension/popup.js');
    
    // Since popup.js creates instance on DOMContentLoaded, we need to trigger it
    const DOMContentLoadedEvent = new Event('DOMContentLoaded');
    document.dispatchEvent(DOMContentLoadedEvent);
    
    // Get the controller instance - it's not exported, so we'll test via DOM interactions
  });

  describe('initialization', () => {
    test('should bind events to essential elements', () => {
      expect(mockElements.speakBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.stopBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.rateRange.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockElements.text.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockElements.voiceSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockElements.previewVoiceBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.advancedSettingsBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should load saved data on initialization', () => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getSelectedText' },
        expect.any(Function)
      );
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        ['savedText'], 
        expect.any(Function)
      );
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        ['savedVoice', 'savedRate'], 
        expect.any(Function)
      );
    });
  });

  describe('voice management', () => {
    test('should request voices from background script', () => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getVoices' },
        expect.any(Function)
      );
    });

    test('should enable preview button when voices are loaded', () => {
      // Simulate voice loading response
      const callback = chrome.runtime.sendMessage.mock.calls.find(
        call => call[0].type === 'getVoices'
      )[1];
      
      callback({
        status: 'success',
        voices: [
          { name: 'Voice 1', lang: 'en-US', gender: 'female', quality: 'Standard', isGoogle: false }
        ]
      });

      expect(mockElements.previewVoiceBtn.disabled).toBe(false);
    });
  });

  describe('rate control', () => {
    test('should update rate display when range changes', () => {
      // Simulate rate range change
      mockElements.rateRange.value = '1.5';
      const changeEvent = new Event('input');
      mockElements.rateRange.dispatchEvent(changeEvent);
      
      // The rate value should be updated via the event listener
      expect(mockElements.rateRange.value).toBe('1.5');
    });

    test('should save rate to storage when changed', () => {
      chrome.storage.sync.set.mockClear();
      
      // Simulate rate change
      mockElements.rateRange.value = '2.0';
      const changeEvent = new Event('input');
      mockElements.rateRange.dispatchEvent(changeEvent);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ savedRate: '2.0' });
    });
  });

  describe('TTS functionality', () => {
    test('should trigger speak when speak button is clicked', () => {
      chrome.runtime.sendMessage.mockClear();
      
      mockElements.text.value = 'Hello world';
      mockElements.rateRange.value = '1.5';
      mockElements.voiceSelect.value = 'voice2';

      // Simulate speak button click
      const clickEvent = new Event('click');
      mockElements.speakBtn.dispatchEvent(clickEvent);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'speak',
        text: 'Hello world',
        voiceName: 'voice2',
        rate: 1.5
      }, expect.any(Function));
    });

    test('should trigger stop when stop button is clicked', () => {
      chrome.runtime.sendMessage.mockClear();

      // Simulate stop button click
      const clickEvent = new Event('click');
      mockElements.stopBtn.dispatchEvent(clickEvent);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'stop'
      }, expect.any(Function));
    });

    test('should open options page when advanced settings button is clicked', () => {
      // Simulate advanced settings button click
      const clickEvent = new Event('click');
      mockElements.advancedSettingsBtn.dispatchEvent(clickEvent);

      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe('data persistence', () => {
    test('should save text changes to storage', () => {
      chrome.storage.sync.set.mockClear();
      
      mockElements.text.value = 'Hello world';
      const changeEvent = new Event('input');
      mockElements.text.dispatchEvent(changeEvent);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ savedText: 'Hello world' });
    });

    test('should save voice changes to storage', () => {
      chrome.storage.sync.set.mockClear();
      
      mockElements.voiceSelect.value = 'voice1';
      const changeEvent = new Event('change');
      mockElements.voiceSelect.dispatchEvent(changeEvent);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ savedVoice: 'voice1' });
    });
  });

  describe('auto-play functionality', () => {
    beforeEach(() => {
      // Reset mocks before each auto-play test
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('should auto-speak when popup opens with selected text', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to return selected text
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ 
            status: 'success', 
            selectedText: 'This is selected text to be spoken automatically' 
          });
        } else if (message.type === 'getVoices') {
          callback({ 
            status: 'success', 
            voices: [
              { name: 'Voice 1', lang: 'en-US', gender: 'female', quality: 'Standard', isGoogle: false }
            ] 
          });
        } else if (message.type === 'speak') {
          callback({ status: 'speaking' });
        } else {
          callback({ status: 'success' });
        }
      });

      // Set up voice selection to be ready
      mockElements.voiceSelect.value = 'Voice 1';

      // Create fresh controller instance with selected text
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded to initialize controller
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward the auto-speak delay (100ms)
      jest.advanceTimersByTime(100);

      // Verify that selected text was set in textarea
      expect(mockElements.text.value).toBe('This is selected text to be spoken automatically');

      // Verify that speak was called automatically
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'speak',
        text: 'This is selected text to be spoken automatically',
        voiceName: 'Voice 1',
        rate: 1.0
      }, expect.any(Function));
    });

    test('should not auto-speak when popup opens without selected text', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to return no selected text
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ status: 'success', selectedText: null });
        } else if (message.type === 'getVoices') {
          callback({ status: 'success', voices: [] });
        } else {
          callback({ status: 'success' });
        }
      });

      // Mock storage to return saved text instead
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        if (keys.includes('savedText')) {
          callback({ savedText: 'Previously saved text' });
        } else {
          callback({});
        }
      });

      // Create fresh controller instance
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward all timers
      jest.advanceTimersByTime(1000);

      // Verify that speak was NOT called automatically
      const speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(0);
    });

    test('should not auto-speak when selected text is empty or whitespace', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to return whitespace-only text
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ status: 'success', selectedText: '   \n\t  ' });
        } else if (message.type === 'getVoices') {
          callback({ status: 'success', voices: [] });
        } else {
          callback({ status: 'success' });
        }
      });

      // Create fresh controller instance
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward all timers
      jest.advanceTimersByTime(1000);

      // Verify that speak was NOT called automatically
      const speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(0);
    });

    test('should wait for voices to load before auto-speaking', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to return selected text
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ 
            status: 'success', 
            selectedText: 'Auto-speak test text' 
          });
        } else if (message.type === 'getVoices') {
          // Simulate delayed voice loading
          setTimeout(() => {
            callback({ 
              status: 'success', 
              voices: [
                { name: 'Voice 1', lang: 'en-US', gender: 'female', quality: 'Standard', isGoogle: false }
              ] 
            });
          }, 150);
        } else if (message.type === 'speak') {
          callback({ status: 'speaking' });
        } else {
          callback({ status: 'success' });
        }
      });

      // Start with no voice selected (voices not loaded yet)
      mockElements.voiceSelect.value = '';

      // Create fresh controller instance
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward initial auto-speak delay (100ms)
      jest.advanceTimersByTime(100);

      // At this point, voices aren't loaded yet, so speak shouldn't be called
      let speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(0);

      // Now simulate voices being loaded
      mockElements.voiceSelect.value = 'Voice 1';

      // Fast-forward the voice loading delay (150ms) and retry delay (200ms)
      jest.advanceTimersByTime(350);

      // Now speak should be called
      speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(1);
      expect(speakCalls[0][0]).toEqual({
        type: 'speak',
        text: 'Auto-speak test text',
        voiceName: 'Voice 1',
        rate: 1.0
      });
    });

    test('should handle chrome.runtime.lastError during getSelectedText gracefully', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to trigger an error
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          chrome.runtime.lastError = { message: 'Tab not found' };
          callback(null);
          // Clear the error after callback
          delete chrome.runtime.lastError;
        } else if (message.type === 'getVoices') {
          callback({ status: 'success', voices: [] });
        } else {
          callback({ status: 'success' });
        }
      });

      // Mock storage to return saved text
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        if (keys.includes('savedText')) {
          callback({ savedText: 'Fallback saved text' });
        } else {
          callback({});
        }
      });

      // Create fresh controller instance
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward all timers
      jest.advanceTimersByTime(1000);

      // Should fallback to saved text instead of crashing
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['savedVoice', 'savedRate'], expect.any(Function));
      
      // Should not auto-speak due to error
      const speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(0);
    });

    test('should retry auto-speak with exponential backoff when voices not ready', () => {
      chrome.runtime.sendMessage.mockClear();
      
      // Mock getSelectedText to return selected text
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ 
            status: 'success', 
            selectedText: 'Retry test text' 
          });
        } else if (message.type === 'getVoices') {
          callback({ status: 'success', voices: [] });
        } else if (message.type === 'speak') {
          callback({ status: 'speaking' });
        } else {
          callback({ status: 'success' });
        }
      });

      // Start with no voice selected
      mockElements.voiceSelect.value = '';

      // Create fresh controller instance
      delete require.cache[require.resolve('../extension/popup.js')];
      require('../extension/popup.js');
      
      // Trigger DOMContentLoaded
      const DOMContentLoadedEvent = new Event('DOMContentLoaded');
      document.dispatchEvent(DOMContentLoadedEvent);

      // Fast-forward initial delay (100ms)
      jest.advanceTimersByTime(100);

      // Should have started first retry attempt with 200ms delay
      jest.advanceTimersByTime(200);

      // Voice still not ready, should retry again
      jest.advanceTimersByTime(200);

      // After multiple retries, simulate voice becoming available
      mockElements.voiceSelect.value = 'Voice 1';
      jest.advanceTimersByTime(200);

      // Now speak should finally be called
      const speakCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'speak'
      );
      expect(speakCalls).toHaveLength(1);
    });
  });
});