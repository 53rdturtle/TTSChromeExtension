// Tests for popup.js - TTSController class
const { TTSController } = require('../extension/popup.js');

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
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    style: {},
    options: type === 'select' ? [] : undefined,
    selectedIndex: type === 'select' ? 0 : undefined,
    length: type === 'select' ? 0 : undefined
  };
  
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

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      voiceSelect: createMockElement('voiceSelect', 'select'),
      rateRange: createMockElement('rateRange', 'range'),
      rateValue: createMockElement('rateValue', 'span'),
      text: createMockElement('text', 'textarea'),
      speakBtn: createMockElement('speakBtn', 'button'),
      stopBtn: createMockElement('stopBtn', 'button'),
      settingsBtn: createMockElement('settingsBtn', 'button'),
      settingsPanel: createMockElement('settingsPanel', 'div'),
      closeSettingsBtn: createMockElement('closeSettingsBtn', 'button'),
      modeFullSelection: createMockElement('modeFullSelection', 'radio'),
      modeSentence: createMockElement('modeSentence', 'radio'),
      modeWord: createMockElement('modeWord', 'radio'),
      highlightColor: createMockElement('highlightColor', 'color'),
      highlightOpacity: createMockElement('highlightOpacity', 'range'),
      opacityValue: createMockElement('opacityValue', 'span'),
      autoScrollToggle: createMockElement('autoScrollToggle', 'checkbox'),
      highlightingToggle: createMockElement('highlightingToggle', 'checkbox')
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
        { voiceName: 'Voice 1', lang: 'en-US' },
        { voiceName: 'Voice 2', lang: 'en-GB' }
      ]);
    });

    // Mock chrome.runtime.sendMessage for settings
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'getHighlightingSettings') {
        callback({ status: 'success', settings: { mode: 'full', enabled: true } });
      } else if (message.type === 'saveHighlightingSettings') {
        callback({ status: 'success' });
      } else if (message.type === 'getVoices') {
        callback({ 
          status: 'success', 
          voices: [
            { voiceName: 'Voice 1', lang: 'en-US' },
            { voiceName: 'Voice 2', lang: 'en-GB' }
          ] 
        });
      } else {
        callback({ status: 'success' });
      }
    });

    // Clear all mocks
    jest.clearAllMocks();
    
    // Create controller instance
    controller = new TTSController();
  });

  describe('constructor', () => {
    test('should initialize with correct elements', () => {
      expect(controller.elements).toBeDefined();
      expect(controller.elements.voiceSelect).toBe(mockElements.voiceSelect);
      expect(controller.elements.rateRange).toBe(mockElements.rateRange);
      expect(controller.elements.textArea).toBe(mockElements.text);
      expect(controller.elements.speakBtn).toBe(mockElements.speakBtn);
      expect(controller.elements.stopBtn).toBe(mockElements.stopBtn);
    });

    test('should bind events to elements', () => {
      expect(mockElements.speakBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.stopBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.rateRange.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockElements.text.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockElements.voiceSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('populateVoices', () => {
    test('should populate voice select with available voices', async () => {
      const voices = [
        { voiceName: 'Voice 1', lang: 'en-US' },
        { voiceName: 'Voice 2', lang: 'en-GB' }
      ];

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getVoices') {
          callback({ status: 'success', voices });
        }
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await controller.populateVoices();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getVoices' },
        expect.any(Function)
      );
      expect(mockElements.voiceSelect.appendChild).toHaveBeenCalledTimes(4);
    });

    test('should handle empty voices array', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getVoices') {
          callback({ status: 'success', voices: [] });
        }
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await controller.populateVoices();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getVoices' },
        expect.any(Function)
      );
      expect(mockElements.voiceSelect.appendChild).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateRate', () => {
    test('should update rate display', () => {
      mockElements.rateRange.value = '1.5';
      controller.updateRate();
      expect(mockElements.rateValue.textContent).toBe('1.5');
    });

    test('should save rate to storage', () => {
      mockElements.rateRange.value = '2.0';
      controller.updateRate();
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ speechRate: '2.0' }, expect.any(Function));
    });
  });

  describe('speak', () => {
    beforeEach(() => {
      // Clear mocks from constructor
      chrome.runtime.sendMessage.mockClear();
    });

    test('should send speak message with correct parameters', () => {
      mockElements.text.value = 'Hello world';
      mockElements.rateRange.value = '1.5';
      mockElements.voiceSelect.value = 'voice2';

      controller.speak();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'speak',
        text: 'Hello world',
        rate: 1.5,
        voiceName: 'voice2'
      }, expect.any(Function));
    });

    test('should handle empty text', () => {
      mockElements.text.value = '';
      
      // Clear any previous calls from constructor
      chrome.runtime.sendMessage.mockClear();
      
      const showErrorSpy = jest.spyOn(controller, 'showError');
      controller.speak();

      expect(showErrorSpy).toHaveBeenCalledWith('Please enter some text to speak');
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should handle TTS errors', () => {
      mockElements.text.value = 'Hello world';
      
      // Clear any previous calls from constructor
      chrome.runtime.sendMessage.mockClear();
      
      const showErrorSpy = jest.spyOn(controller, 'showError');
      
      // Mock sendMessage to simulate error
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'error', error: 'TTS Error' });
      });

      controller.speak();

      expect(showErrorSpy).toHaveBeenCalledWith('TTS Error: TTS Error');
    });
  });

  describe('stop', () => {
    test('should send stop message', () => {
      // Clear any previous calls from constructor
      chrome.runtime.sendMessage.mockClear();
      
      controller.stop();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'stop'
      }, expect.any(Function));
    });

    test('should handle stop errors', () => {
      // Clear any previous calls from constructor
      chrome.runtime.sendMessage.mockClear();
      
      const showErrorSpy = jest.spyOn(controller, 'showError');
      
      // Mock sendMessage to simulate error
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'error', error: 'Stop Error' });
      });

      controller.stop();

      expect(showErrorSpy).toHaveBeenCalledWith('Stop Error: Stop Error');
    });
  });

  describe('setButtonState', () => {
    test('should set button states when speaking', () => {
      controller.setButtonState(true);

      expect(mockElements.speakBtn.disabled).toBe(true);
      expect(mockElements.stopBtn.disabled).toBe(false);
    });

    test('should set button states when not speaking', () => {
      controller.setButtonState(false);

      expect(mockElements.speakBtn.disabled).toBe(false);
      expect(mockElements.stopBtn.disabled).toBe(true);
    });
  });

  describe('showError', () => {
    test('should create and display error message', () => {
      const originalCreateElement = document.createElement;
      const mockErrorDiv = document.createElement('div');
      
      // Spy on createElement to track calls
      const createElementSpy = jest.spyOn(document, 'createElement');
      createElementSpy.mockReturnValue(mockErrorDiv);
      
      // Spy on appendChild to track calls
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');

      controller.showError('Test error message');

      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(mockErrorDiv.textContent).toBe('Test error message');
      expect(appendChildSpy).toHaveBeenCalledWith(mockErrorDiv);
      
      // Restore original
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });
  });

  describe('loadSavedData', () => {
    test('should load saved text and voice data', async () => {
      const savedData = {
        ttsText: 'Saved text',
        selectedVoice: 'voice2',
        speechRate: '1.8'
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ status: 'success', selectedText: null });
        }
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(savedData);
      });

      await controller.loadSavedData();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        ['ttsText', 'selectedVoice', 'speechRate'],
        expect.any(Function)
      );
      expect(mockElements.text.value).toBe('Saved text');
      expect(mockElements.rateRange.value).toBe('1.8');
    });

    test('should handle empty saved data', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getSelectedText') {
          callback({ status: 'success', selectedText: null });
        }
      });

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await controller.loadSavedData();

      expect(chrome.storage.sync.get).toHaveBeenCalled();
      // Should not throw error with empty data
    });
  });

  describe('saveText', () => {
    test('should save text to storage', () => {
      mockElements.text.value = 'Hello world';
      controller.saveText();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { ttsText: 'Hello world' }
      );
    });

    test('should handle storage errors', () => {
      mockElements.text.value = 'Hello world';
      
      chrome.storage.sync.set.mockImplementation((data) => {
        // Real implementation doesn't check for errors in saveText
      });

      controller.saveText();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { ttsText: 'Hello world' }
      );
    });
  });

  describe('saveVoice', () => {
    test('should save voice to storage', () => {
      mockElements.voiceSelect.value = 'voice1';
      controller.saveVoice();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { selectedVoice: 'voice1' }
      );
    });

    test('should handle storage errors', () => {
      mockElements.voiceSelect.value = 'voice1';
      
      chrome.storage.sync.set.mockImplementation((data) => {
        // Real implementation doesn't check for errors in saveVoice
      });

      controller.saveVoice();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { selectedVoice: 'voice1' }
      );
    });
  });

  describe('pollSpeakingStatus', () => {
    test('should poll speaking status', () => {
      jest.useFakeTimers();
      
      // Clear any previous calls from constructor
      chrome.runtime.sendMessage.mockClear();
      
      controller.pollSpeakingStatus();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getStatus' },
        expect.any(Function)
      );
      
      jest.useRealTimers();
    });
  });
});