// Test setup for Chrome Extension APIs
// Mock importScripts for service worker imports
global.importScripts = jest.fn();

// Mock GoogleTTSService class
global.GoogleTTSService = class {
  constructor() {
    this.apiKey = null;
  }
  
  async isEnabled() {
    return false;
  }
  
  async speak(text, options) {
    return { status: 'speaking', service: 'google' };
  }
  
  async stopAudio() {
    return { status: 'stopped' };
  }
  
  async synthesize(text, options) {
    return { audioContent: 'mock-audio-data' };
  }
  
  async getVoices() {
    return [];
  }
};

global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(() => Promise.resolve()),
    onActivated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tts: {
    speak: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(),
    isSpeaking: jest.fn(),
    onEvent: {
      addListener: jest.fn()
    }
  },
  scripting: {
    executeScript: jest.fn()
  },
  commands: {
    onCommand: {
      addListener: jest.fn()
    }
  }
};

// Mock DOM methods
Object.defineProperty(window, 'getSelection', {
  value: jest.fn(() => ({
    toString: jest.fn(() => 'selected text')
  }))
});

// Create proper DOM element mocks
const createMockElement = (tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    style: {},
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn()
    },
    parentNode: null,
    textContent: '',
    innerHTML: '',
    value: '',
    offsetWidth: 100,
    offsetHeight: 50
  };
  return element;
};

// Mock document methods with proper element creation
global.document = {
  ...document,
  createElement: jest.fn((tagName) => createMockElement(tagName)),
  getElementById: jest.fn((id) => {
    // Return mock elements for the IDs used in popup.js
    const mockElements = {
      'voiceSelect': createMockElement('select'),
      'rateRange': createMockElement('input'),
      'rateValue': createMockElement('span'),
      'text': createMockElement('textarea'),
      'speakBtn': createMockElement('button'),
      'stopBtn': createMockElement('button'),
      'settingsBtn': createMockElement('button'),
      'settingsPanel': createMockElement('div'),
      'closeSettingsBtn': createMockElement('button'),
      'modeFullSelection': createMockElement('input'),
      'modeSentence': createMockElement('input'),
      'modeWord': createMockElement('input'),
      'highlightColor': createMockElement('input'),
      'highlightOpacity': createMockElement('input'),
      'opacityValue': createMockElement('span'),
      'autoScrollToggle': createMockElement('input'),
      'highlightingToggle': createMockElement('input'),
      // Google TTS elements
      'googleTTSToggle': createMockElement('input'),
      'googleAPIKey': createMockElement('input'),
      // Voice preview element
      'previewVoiceBtn': createMockElement('button')
    };
    return mockElements[id] || createMockElement('div');
  }),
  body: {
    ...document.body,
    appendChild: jest.fn(),
    removeChild: jest.fn()
  },
  head: {
    ...document.head,
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  chrome.runtime.lastError = null;
  
  // Ensure sendMessage always returns a Promise
  chrome.tabs.sendMessage = jest.fn(() => Promise.resolve());
});