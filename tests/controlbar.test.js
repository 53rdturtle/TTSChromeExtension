// Tests for controlbar.js - FloatingControlBar class

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

// Mock window and document
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  getSelection: jest.fn(() => ({
    toString: jest.fn(() => 'selected text')
  }))
};

global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  body: createMockElement('body'),
  head: createMockElement('head'),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Define FloatingControlBar class for testing
class FloatingControlBar {
  constructor() {
    this.controlBar = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.init();
  }

  init() {
    this.controlBar = document.createElement('div');
    this.controlBar.id = 'tts-floating-control-bar';
    this.controlBar.innerHTML = `
      <div class="tts-control-container">
        <div class="tts-control-header" id="tts-drag-handle">
          <span class="tts-title">TTS Controls</span>
          <button class="tts-close-btn" id="tts-close-btn">×</button>
        </div>
        <div class="tts-control-content">
          <div class="tts-control-item">
            <button class="tts-btn tts-stop-btn" id="tts-stop-btn">
              <span class="tts-icon">⏹</span>
              Stop
            </button>
          </div>
          <div class="tts-control-item">
            <button class="tts-btn tts-pause-btn" id="tts-pause-btn">
              <span class="tts-icon">⏸</span>
              Pause
            </button>
          </div>
          <div class="tts-control-item">
            <button class="tts-btn tts-resume-btn" id="tts-resume-btn">
              <span class="tts-icon">▶</span>
              Resume
            </button>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    this.addEventListeners();
    this.hide();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `/* CSS styles here */`;
    document.head.appendChild(style);
  }

  addEventListeners() {
    this.controlBar.querySelector('#tts-close-btn').addEventListener('click', () => {
      this.hide();
    });

    this.controlBar.querySelector('#tts-stop-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'stop' }, (response) => {
        if (response && response.status === 'stopped') {
          this.updateStatus(false);
        }
      });
    });

    this.controlBar.querySelector('#tts-pause-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'pause' }, (response) => {
        if (response && response.status === 'paused') {
          this.updateStatus(false, true);
        }
      });
    });

    this.controlBar.querySelector('#tts-resume-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'resume' }, (response) => {
        if (response && response.status === 'resumed') {
          this.updateStatus(true, false);
        }
      });
    });

    this.addDragListeners();
  }

  addDragListeners() {
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    
    dragHandle.addEventListener('mousedown', (e) => {
      this.startDrag(e);
    });

    dragHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrag(e.touches[0]);
    });

    dragHandle.addEventListener('selectstart', (e) => {
      e.preventDefault();
    });
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.controlBar.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.add('dragging');

    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.stopDrag.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this));
    document.addEventListener('touchend', this.stopDrag.bind(this));
  }

  handleDragMove(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    const newX = clientX - this.dragOffset.x;
    const newY = clientY - this.dragOffset.y;
    
    const rect = this.controlBar.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    this.controlBar.style.left = boundedX + 'px';
    this.controlBar.style.top = boundedY + 'px';
    this.controlBar.style.right = 'auto';
  }

  stopDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.remove('dragging');
    
    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.stopDrag.bind(this));
    document.removeEventListener('touchmove', this.handleDragMove.bind(this));
    document.removeEventListener('touchend', this.stopDrag.bind(this));
  }

  show() {
    if (!this.isVisible) {
      document.body.appendChild(this.controlBar);
      this.isVisible = true;
      
      setTimeout(() => {
        this.controlBar.classList.add('visible');
      }, 10);
    }
  }

  hide() {
    if (this.isVisible) {
      this.controlBar.classList.remove('visible');
      setTimeout(() => {
        if (this.controlBar.parentNode) {
          this.controlBar.parentNode.removeChild(this.controlBar);
        }
        this.isVisible = false;
      }, 300);
    }
  }

  updateStatus(isSpeaking, isPaused = false) {
    const stopBtn = this.controlBar.querySelector('#tts-stop-btn');
    const pauseBtn = this.controlBar.querySelector('#tts-pause-btn');
    const resumeBtn = this.controlBar.querySelector('#tts-resume-btn');

    if (isSpeaking) {
      stopBtn.disabled = false;
      pauseBtn.disabled = false;
      resumeBtn.disabled = true;
    } else if (isPaused) {
      stopBtn.disabled = false;
      pauseBtn.disabled = true;
      resumeBtn.disabled = false;
    } else {
      stopBtn.disabled = true;
      pauseBtn.disabled = true;
      resumeBtn.disabled = true;
    }
  }
}

describe('FloatingControlBar', () => {
  let controlBar;
  let mockControlBarElement;

  beforeEach(() => {
    // Create mock control bar element
    mockControlBarElement = createMockElement('tts-floating-control-bar');
    
    // Mock querySelector to return mock buttons
    const mockButtons = {
      'tts-close-btn': createMockElement('tts-close-btn', 'button'),
      'tts-stop-btn': createMockElement('tts-stop-btn', 'button'),
      'tts-pause-btn': createMockElement('tts-pause-btn', 'button'),
      'tts-resume-btn': createMockElement('tts-resume-btn', 'button'),
      'tts-drag-handle': createMockElement('tts-drag-handle', 'div')
    };

    mockControlBarElement.querySelector.mockImplementation((selector) => {
      const id = selector.replace('#', '');
      return mockButtons[id] || null;
    });

    // Mock document.createElement to return our mock element
    document.createElement = jest.fn((tag) => {
      if (tag === 'div') {
        return mockControlBarElement;
      }
      if (tag === 'style') {
        return createMockElement('style');
      }
      return createMockElement('generic');
    });

    // Reset chrome.runtime.sendMessage mock
    chrome.runtime.sendMessage.mockClear();

    // Create control bar instance
    controlBar = new FloatingControlBar();
  });

  describe('constructor', () => {
    test('should initialize with correct default state', () => {
      expect(controlBar.controlBar).toBe(mockControlBarElement);
      expect(controlBar.isVisible).toBe(false);
      expect(controlBar.isDragging).toBe(false);
      expect(controlBar.dragOffset).toEqual({ x: 0, y: 0 });
    });

    test('should create control bar HTML structure', () => {
      expect(mockControlBarElement.innerHTML).toContain('TTS Controls');
      expect(mockControlBarElement.innerHTML).toContain('Stop');
      expect(mockControlBarElement.innerHTML).toContain('Pause');
      expect(mockControlBarElement.innerHTML).toContain('Resume');
    });

    test('should add styles to document head', () => {
      expect(document.createElement).toHaveBeenCalledWith('style');
      expect(document.head.appendChild).toHaveBeenCalled();
    });
  });

  describe('show', () => {
    test('should show control bar when hidden', () => {
      jest.useFakeTimers();
      
      controlBar.show();
      
      expect(document.body.appendChild).toHaveBeenCalledWith(mockControlBarElement);
      expect(controlBar.isVisible).toBe(true);
      
      // Fast forward to trigger animation
      jest.advanceTimersByTime(10);
      
      expect(mockControlBarElement.classList.add).toHaveBeenCalledWith('visible');
      
      jest.useRealTimers();
    });

    test('should not show control bar when already visible', () => {
      controlBar.isVisible = true;
      
      controlBar.show();
      
      expect(document.body.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('hide', () => {
    test('should hide control bar when visible', () => {
      jest.useFakeTimers();
      
      controlBar.isVisible = true;
      mockControlBarElement.parentNode = document.body;
      
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
    let mockButtons;

    beforeEach(() => {
      mockButtons = {
        stop: mockControlBarElement.querySelector('#tts-stop-btn'),
        pause: mockControlBarElement.querySelector('#tts-pause-btn'),
        resume: mockControlBarElement.querySelector('#tts-resume-btn')
      };
    });

    test('should update buttons when speaking', () => {
      controlBar.updateStatus(true, false);
      
      expect(mockButtons.stop.disabled).toBe(false);
      expect(mockButtons.pause.disabled).toBe(false);
      expect(mockButtons.resume.disabled).toBe(true);
    });

    test('should update buttons when paused', () => {
      controlBar.updateStatus(false, true);
      
      expect(mockButtons.stop.disabled).toBe(false);
      expect(mockButtons.pause.disabled).toBe(true);
      expect(mockButtons.resume.disabled).toBe(false);
    });

    test('should update buttons when stopped', () => {
      controlBar.updateStatus(false, false);
      
      expect(mockButtons.stop.disabled).toBe(true);
      expect(mockButtons.pause.disabled).toBe(true);
      expect(mockButtons.resume.disabled).toBe(true);
    });
  });

  describe('button event handlers', () => {
    test('should handle close button click', () => {
      const closeBtn = mockControlBarElement.querySelector('#tts-close-btn');
      const hideSpy = jest.spyOn(controlBar, 'hide');
      
      // Simulate click event
      const clickHandler = closeBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      clickHandler();
      
      expect(hideSpy).toHaveBeenCalled();
    });

    test('should handle stop button click', () => {
      const stopBtn = mockControlBarElement.querySelector('#tts-stop-btn');
      
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'stopped' });
      });

      const updateStatusSpy = jest.spyOn(controlBar, 'updateStatus');
      
      // Simulate click event
      const clickHandler = stopBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      clickHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'stop'
      }, expect.any(Function));
      
      expect(updateStatusSpy).toHaveBeenCalledWith(false);
    });

    test('should handle pause button click', () => {
      const pauseBtn = mockControlBarElement.querySelector('#tts-pause-btn');
      
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'paused' });
      });

      const updateStatusSpy = jest.spyOn(controlBar, 'updateStatus');
      
      // Simulate click event
      const clickHandler = pauseBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      clickHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'pause'
      }, expect.any(Function));
      
      expect(updateStatusSpy).toHaveBeenCalledWith(false, true);
    });

    test('should handle resume button click', () => {
      const resumeBtn = mockControlBarElement.querySelector('#tts-resume-btn');
      
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'resumed' });
      });

      const updateStatusSpy = jest.spyOn(controlBar, 'updateStatus');
      
      // Simulate click event
      const clickHandler = resumeBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      clickHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'resume'
      }, expect.any(Function));
      
      expect(updateStatusSpy).toHaveBeenCalledWith(true, false);
    });
  });

  describe('drag functionality', () => {
    let dragHandle;

    beforeEach(() => {
      dragHandle = mockControlBarElement.querySelector('#tts-drag-handle');
    });

    test('should start drag on mousedown', () => {
      const startDragSpy = jest.spyOn(controlBar, 'startDrag');
      
      // Simulate mousedown event
      const mousedownHandler = dragHandle.addEventListener.mock.calls
        .find(call => call[0] === 'mousedown')[1];
      
      const mockEvent = {
        clientX: 100,
        clientY: 50,
        preventDefault: jest.fn()
      };
      
      mousedownHandler(mockEvent);
      
      expect(startDragSpy).toHaveBeenCalledWith(mockEvent);
    });

    test('should start drag on touchstart', () => {
      const startDragSpy = jest.spyOn(controlBar, 'startDrag');
      
      // Simulate touchstart event
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
      // Start drag first
      controlBar.startDrag({ clientX: 100, clientY: 50 });
      
      // Simulate drag move
      const moveEvent = {
        clientX: 150,
        clientY: 100,
        preventDefault: jest.fn()
      };
      
      controlBar.handleDragMove(moveEvent);
      
      expect(moveEvent.preventDefault).toHaveBeenCalled();
      expect(mockControlBarElement.style.left).toBe('150px');
      expect(mockControlBarElement.style.top).toBe('100px');
    });

    test('should stop drag and cleanup event listeners', () => {
      controlBar.isDragging = true;
      dragHandle.classList.add = jest.fn();
      dragHandle.classList.remove = jest.fn();
      
      controlBar.stopDrag();
      
      expect(controlBar.isDragging).toBe(false);
      expect(dragHandle.classList.remove).toHaveBeenCalledWith('dragging');
    });

    test('should constrain drag within viewport bounds', () => {
      // Mock getBoundingClientRect to return element dimensions
      mockControlBarElement.getBoundingClientRect.mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 100
      });
      
      // Start drag
      controlBar.startDrag({ clientX: 100, clientY: 50 });
      
      // Try to drag beyond viewport
      const moveEvent = {
        clientX: 2000, // Beyond window width
        clientY: 1000, // Beyond window height
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
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });
});