// Content script for TTS Chrome Extension
// Handles floating control bar display

class FloatingControlBar {
  constructor() {
    this.controlBar = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.init();
  }

  init() {
    // Create the floating control bar
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
            <button class="tts-btn tts-toggle-btn" id="tts-toggle-btn">
              <span class="tts-icon" id="tts-toggle-icon">⏸</span>
              <span class="tts-toggle-text" id="tts-toggle-text">Pause</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Add event listeners
    this.addEventListeners();

    // Initially hide the control bar
    this.hide();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #tts-floating-control-bar {
        position: fixed;
        top: auto;
        right: auto;
        bottom: 20px;
        left: 20px;
        z-index: 10000;
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        min-width: 200px;
        height: auto;
        max-height: 220px;
        overflow: auto;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      #tts-floating-control-bar.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .tts-control-container {
        padding: 12px;
      }

      .tts-control-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
        cursor: move;
        user-select: none;
      }

      .tts-control-header.dragging {
        cursor: grabbing;
        background-color: #f8f9fa;
      }

      .tts-title {
        font-weight: 600;
        color: #333;
      }

      .tts-close-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .tts-close-btn:hover {
        background-color: #f0f0f0;
        color: #333;
      }

      .tts-control-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tts-control-item {
        display: flex;
      }

      .tts-btn {
        flex: 1;
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.2s ease;
      }

      .tts-btn:hover {
        background: #0056b3;
      }

      .tts-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .tts-stop-btn {
        background: #dc3545;
      }

      .tts-stop-btn:hover {
        background: #c82333;
      }

      .tts-toggle-btn {
        background: #ffc107;
        color: #212529;
      }

      .tts-toggle-btn:hover {
        background: #e0a800;
      }

      .tts-toggle-btn.resume-state {
        background: #28a745;
        color: white;
      }

      .tts-toggle-btn.resume-state:hover {
        background: #218838;
      }

      .tts-icon {
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  addEventListeners() {
    // Close button
    this.controlBar.querySelector('#tts-close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Stop button
    this.controlBar.querySelector('#tts-stop-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'stop' }, (response) => {
        if (response && response.status === 'stopped') {
          this.updateStatus(false);
        }
      });
    });

    // Toggle button (pause/resume)
    this.controlBar.querySelector('#tts-toggle-btn').addEventListener('click', () => {
      const toggleBtn = this.controlBar.querySelector('#tts-toggle-btn');
      const isResumeState = toggleBtn.classList.contains('resume-state');
      
      if (isResumeState) {
        // Currently showing resume, so resume playback
        chrome.runtime.sendMessage({ type: 'resume' }, (response) => {
          if (response && response.status === 'resumed') {
            this.updateStatus(true, false); // speaking state
          }
        });
      } else {
        // Currently showing pause, so pause playback
        chrome.runtime.sendMessage({ type: 'pause' }, (response) => {
          if (response && response.status === 'paused') {
            this.updateStatus(false, true); // paused state
          }
        });
      }
    });

    // Drag functionality
    this.addDragListeners();
  }

  addDragListeners() {
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    
    // Mouse events for drag
    dragHandle.addEventListener('mousedown', (e) => {
      this.startDrag(e);
    });

    // Touch events for mobile drag
    dragHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrag(e.touches[0]);
    });

    // Prevent text selection during drag
    dragHandle.addEventListener('selectstart', (e) => {
      e.preventDefault();
    });
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.controlBar.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    // Add dragging class for visual feedback
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.add('dragging');

    // Add global event listeners
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
    
    // Calculate new position
    const newX = clientX - this.dragOffset.x;
    const newY = clientY - this.dragOffset.y;
    
    // Keep control bar within viewport bounds
    const rect = this.controlBar.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    // Apply new position
    this.controlBar.style.left = boundedX + 'px';
    this.controlBar.style.top = boundedY + 'px';
    this.controlBar.style.right = 'auto';
  }

  stopDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // Remove dragging class
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.remove('dragging');
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.stopDrag.bind(this));
    document.removeEventListener('touchmove', this.handleDragMove.bind(this));
    document.removeEventListener('touchend', this.stopDrag.bind(this));
  }

  show() {
    if (!this.isVisible) {
      document.body.appendChild(this.controlBar);
      this.isVisible = true;
      
      // Trigger animation
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
    const toggleBtn = this.controlBar.querySelector('#tts-toggle-btn');
    const toggleIcon = this.controlBar.querySelector('#tts-toggle-icon');
    const toggleText = this.controlBar.querySelector('#tts-toggle-text');

    if (isSpeaking) {
      // Currently speaking - show pause button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
    } else if (isPaused) {
      // Currently paused - show resume button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.add('resume-state');
      toggleIcon.textContent = '▶';
      toggleText.textContent = 'Resume';
    } else {
      // Not speaking or paused - disable toggle button
      stopBtn.disabled = true;
      toggleBtn.disabled = true;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
    }
  }
}

// Initialize the floating control bar
let floatingControlBar = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!floatingControlBar) {
    floatingControlBar = new FloatingControlBar();
  }

  switch (message.type) {
    case 'showControlBar':
      floatingControlBar.show();
      // Set initial state if provided
      if (message.isSpeaking !== undefined || message.isPaused !== undefined) {
        floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
      }
      sendResponse({ status: 'success' });
      break;
    case 'hideControlBar':
      floatingControlBar.hide();
      sendResponse({ status: 'success' });
      break;
    case 'updateStatus':
      floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
      sendResponse({ status: 'success' });
      break;
    default:
      sendResponse({ status: 'error', error: 'Unknown message type' });
  }
});

console.log('TTS Content script loaded');

// Export class for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FloatingControlBar };
} 