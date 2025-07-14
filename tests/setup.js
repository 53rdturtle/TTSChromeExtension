// Test setup for Chrome Extension APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
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
});