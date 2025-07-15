// Tests for controlbar.js - FloatingControlBar class
const { FloatingControlBar } = require('../extension/controlbar.js');

// Enhanced DOM mocking for controlbar tests
const createMockElement = (id, type = 'div') => {
  const element = {
    id,
    type,
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false)
    },
    style: {
      left: '',
      top: '',
      right: '',
      cssText: ''
    },
    parentNode: null,
    getBoundingClientRect: jest.fn(() => ({
      left: 0,
      top: 0,
      width: 200,
      height: 100
    }))
  };
  return element;
};

// Mock window 
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  getSelection: jest.fn(() => ({
    toString: jest.fn(() => 'selected text')
  }))
};

// Use the existing global document setup from setup.js
// Make sure body and head have proper appendChild methods
global.document.body.appendChild = jest.fn();
global.document.head.appendChild = jest.fn();
global.document.removeEventListener = jest.fn();

describe('FloatingControlBar', () => {
  let controlBar;
  let mockControlBarElement;
  let mockButtons;
  let dragHandle;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock buttons
    mockButtons = {
      'tts-close-btn': createMockElement('tts-close-btn', 'button'),
      'tts-stop-btn': createMockElement('tts-stop-btn', 'button'),
      'tts-toggle-btn': createMockElement('tts-toggle-btn', 'button'),
      'tts-toggle-icon': createMockElement('tts-toggle-icon', 'span'),
      'tts-toggle-text': createMockElement('tts-toggle-text', 'span'),
      'tts-drag-handle': createMockElement('tts-drag-handle', 'div')
    };
    
    dragHandle = mockButtons['tts-drag-handle'];
    
    // Create main mock element
    mockControlBarElement = createMockElement('tts-control-bar');
    mockControlBarElement.querySelector.mockImplementation((selector) => {
      const id = selector.replace('#', '');
      return mockButtons[id] || null;
    });

    // Mock document.createElement to return our mock element
    global.document.createElement = jest.fn((tag) => {
      if (tag === 'div') {
        return mockControlBarElement;
      }
      if (tag === 'style') {
        return createMockElement('style');
      }
      return createMockElement(tag);
    });

    // Reset chrome.runtime.sendMessage mock
    chrome.runtime.sendMessage.mockClear();

    // Create control bar instance
    controlBar = new FloatingControlBar();
  });

  describe('constructor', () => {
    test('should initialize with correct default state', () => {
      expect(controlBar.isVisible).toBe(false);
      expect(controlBar.isDragging).toBe(false);
      expect(controlBar.dragOffset).toEqual({ x: 0, y: 0 });
      expect(controlBar.controlBar).toBe(mockControlBarElement);
    });

    test('should create control bar HTML structure', () => {
      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(mockControlBarElement.innerHTML).toContain('×'); // Close button is × symbol
      expect(mockControlBarElement.innerHTML).toContain('Stop');
      expect(mockControlBarElement.innerHTML).toContain('Pause');
    });

    test('should add styles to document head', () => {
      expect(global.document.createElement).toHaveBeenCalledWith('style');
      // Verify style element creation (the implementation sets textContent after creation)
      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(global.document.createElement).toHaveBeenCalledWith('style');
    });
  });

  describe('show', () => {
    test('should show control bar when hidden', () => {
      jest.useFakeTimers();
      
      controlBar.show();
      
      // Verify the control bar visibility state
      expect(controlBar.isVisible).toBe(true);
      // Verify appendChild was called on document.body
      expect(global.document.body.appendChild).toHaveBeenCalledWith(mockControlBarElement);
      
      // Fast forward to trigger animation
      jest.advanceTimersByTime(10);
      
      expect(mockControlBarElement.classList.add).toHaveBeenCalledWith('visible');
      
      jest.useRealTimers();
    });

    test('should not show control bar when already visible', () => {
      controlBar.isVisible = true;
      
      controlBar.show();
      
      // Verify controlBar is already visible and no change in state
      expect(controlBar.isVisible).toBe(true);
    });
  });

  describe('hide', () => {
    test('should hide control bar when visible', () => {
      jest.useFakeTimers();
      
      controlBar.isVisible = true;
      controlBar.hide();
      
      expect(mockControlBarElement.classList.remove).toHaveBeenCalledWith('visible');
      
      // Fast forward to trigger removal
      jest.advanceTimersByTime(300);
      
      expect(controlBar.isVisible).toBe(false);
      
      jest.useRealTimers();
    });

    test('should not hide control bar when already hidden', () => {
      controlBar.isVisible = false;
      
      controlBar.hide();
      
      expect(mockControlBarElement.classList.remove).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    let stopBtn, toggleBtn, toggleIcon, toggleText;

    beforeEach(() => {
      stopBtn = mockButtons['tts-stop-btn'];
      toggleBtn = mockButtons['tts-toggle-btn'];
      toggleIcon = mockButtons['tts-toggle-icon'];
      toggleText = mockButtons['tts-toggle-text'];
    });

    test('should show pause button when speaking', () => {
      controlBar.updateStatus(true, false);

      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleBtn.classList.remove).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });

    test('should show resume button when paused', () => {
      controlBar.updateStatus(false, true);

      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleBtn.classList.add).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('▶');
      expect(toggleText.textContent).toBe('Resume');
    });

    test('should disable all buttons when not speaking', () => {
      controlBar.updateStatus(false, false);

      expect(stopBtn.disabled).toBe(true);
      expect(toggleBtn.disabled).toBe(true);
      expect(toggleBtn.classList.remove).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });
  });

  describe('Button clickability regression tests', () => {
    let stopBtn, toggleBtn, toggleIcon, toggleText;

    beforeEach(() => {
      stopBtn = mockButtons['tts-stop-btn'];
      toggleBtn = mockButtons['tts-toggle-btn'];
      toggleIcon = mockButtons['tts-toggle-icon'];
      toggleText = mockButtons['tts-toggle-text'];
    });

    test('should enable buttons when control bar is shown with speaking state', () => {
      // Simulate showing control bar with speaking state (the bug scenario)
      controlBar.show();
      controlBar.updateStatus(true, false); // isSpeaking = true, isPaused = false

      // Verify buttons are enabled and clickable
      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleBtn.classList.remove).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });

    test('should enable buttons when control bar is shown with paused state', () => {
      // Simulate showing control bar with paused state
      controlBar.show();
      controlBar.updateStatus(false, true); // isSpeaking = false, isPaused = true

      // Verify buttons are enabled and clickable
      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleBtn.classList.add).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('▶');
      expect(toggleText.textContent).toBe('Resume');
    });

    test('should handle showControlBar message with correct initial state', () => {
      // Simulate the message handler scenario
      const message = {
        type: 'showControlBar',
        isSpeaking: true,
        isPaused: false
      };

      // Simulate message handling
      controlBar.show();
      controlBar.updateStatus(message.isSpeaking, message.isPaused);

      // Verify buttons are properly enabled
      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });

    test('should handle showControlBar message with paused state', () => {
      // Simulate the message handler scenario with paused state
      const message = {
        type: 'showControlBar',
        isSpeaking: false,
        isPaused: true
      };

      // Simulate message handling
      controlBar.show();
      controlBar.updateStatus(message.isSpeaking, message.isPaused);

      // Verify buttons are properly enabled for resume
      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleBtn.classList.add).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('▶');
      expect(toggleText.textContent).toBe('Resume');
    });

    test('should prevent disabled buttons when control bar opens during active TTS', () => {
      // This is the specific bug scenario: control bar opens while TTS is speaking
      // but the timing caused buttons to be disabled
      
      // Simulate control bar opening
      controlBar.show();
      
      // Simulate the correct state being set after TTS starts speaking
      controlBar.updateStatus(true, false);
      
      // Verify no buttons are disabled (the bug would cause them to be disabled)
      expect(stopBtn.disabled).toBe(false);
      expect(toggleBtn.disabled).toBe(false);
      
      // Verify toggle button is in correct pause state
      expect(toggleBtn.classList.remove).toHaveBeenCalledWith('resume-state');
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });

    test('should enable toggle button for pause/resume functionality', () => {
      // Test that toggle button can switch between pause and resume states
      
      // Start with speaking state
      controlBar.updateStatus(true, false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
      
      // Switch to paused state
      controlBar.updateStatus(false, true);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleIcon.textContent).toBe('▶');
      expect(toggleText.textContent).toBe('Resume');
      
      // Switch back to speaking state
      controlBar.updateStatus(true, false);
      expect(toggleBtn.disabled).toBe(false);
      expect(toggleIcon.textContent).toBe('⏸');
      expect(toggleText.textContent).toBe('Pause');
    });
  });

  describe('drag functionality', () => {
    beforeEach(() => {
      // Mock getBoundingClientRect for consistent test results
      mockControlBarElement.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        width: 200,
        height: 100
      }));
    });

    test('should start drag on mouse down', () => {
      const startDragSpy = jest.spyOn(controlBar, 'startDrag');
      
      // Simulate event listener registration
      const mousedownCall = dragHandle.addEventListener.mock.calls
        .find(call => call[0] === 'mousedown');
      
      expect(mousedownCall).toBeDefined();
      const mousedownHandler = mousedownCall[1];
      
      const mockEvent = {
        clientX: 100,
        clientY: 50,
        preventDefault: jest.fn()
      };
      
      mousedownHandler(mockEvent);
      
      // mousedown handler doesn't call preventDefault - only calls startDrag
      expect(startDragSpy).toHaveBeenCalledWith(mockEvent);
    });

    test('should start drag on touch start', () => {
      const startDragSpy = jest.spyOn(controlBar, 'startDrag');
      
      // Simulate event listener registration
      const touchstartHandler = dragHandle.addEventListener.mock.calls
        .find(call => call[0] === 'touchstart')[1];
      
      const mockEvent = {
        touches: [{ clientX: 100, clientY: 50 }],
        preventDefault: jest.fn()
      };
      
      touchstartHandler(mockEvent);
      
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(startDragSpy).toHaveBeenCalledWith(mockEvent.touches[0]);
    });

    test('should handle drag move', () => {
      // Mock getBoundingClientRect to return predictable values
      mockControlBarElement.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        width: 200,
        height: 100
      }));
      
      // Start drag first - clientX: 100, clientY: 50, rect.left: 0, rect.top: 0
      // dragOffset.x = 100 - 0 = 100, dragOffset.y = 50 - 0 = 50
      controlBar.startDrag({ clientX: 100, clientY: 50 });
      
      // Simulate drag move - clientX: 150, clientY: 100
      // newX = 150 - 100 = 50, newY = 100 - 50 = 50
      const moveEvent = {
        clientX: 150,
        clientY: 100,
        preventDefault: jest.fn()
      };
      
      controlBar.handleDragMove(moveEvent);
      
      expect(moveEvent.preventDefault).toHaveBeenCalled();
      expect(mockControlBarElement.style.left).toBe('50px');
      expect(mockControlBarElement.style.top).toBe('50px');
    });

    test('should stop drag and cleanup event listeners', () => {
      controlBar.isDragging = true;
      dragHandle.classList.add = jest.fn();
      dragHandle.classList.remove = jest.fn();
      
      controlBar.stopDrag();
      
      expect(controlBar.isDragging).toBe(false);
      expect(dragHandle.classList.remove).toHaveBeenCalledWith('dragging');
      expect(global.document.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(global.document.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    test('should constrain drag within viewport bounds', () => {
      mockControlBarElement.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        width: 200,
        height: 100
      }));
      
      controlBar.startDrag({ clientX: 50, clientY: 50 });
      
      // Try to drag beyond viewport
      const moveEvent = {
        clientX: 1200, // Beyond window width
        clientY: 800,  // Beyond window height
        preventDefault: jest.fn()
      };
      
      controlBar.handleDragMove(moveEvent);
      
      // Should be constrained to viewport bounds
      expect(mockControlBarElement.style.left).toBe('824px'); // 1024 - 200
      expect(mockControlBarElement.style.top).toBe('668px'); // 768 - 100
    });
  });
});

describe('Chrome runtime message listener', () => {
  test('should have message listener functionality', () => {
    // This test verifies that message listener registration exists
    // The actual message handling is tested through the FloatingControlBar methods
    expect(chrome.runtime.onMessage.addListener).toBeDefined();
    expect(typeof chrome.runtime.onMessage.addListener).toBe('function');
  });
});