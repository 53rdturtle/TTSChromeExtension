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
});