// Content script for TTS Chrome Extension
// Handles floating control bar display

class FloatingControlBar {
  constructor() {
    this.controlBar = null;
    this.isVisible = false;
    this.init();
  }

  init() {
    // Create the floating control bar
    this.controlBar = document.createElement('div');
    this.controlBar.id = 'tts-floating-control-bar';
    this.controlBar.innerHTML = `
      <div class="tts-control-container">
        <div class="tts-control-header">
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
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        min-width: 200px;
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

      .tts-pause-btn {
        background: #ffc107;
        color: #212529;
      }

      .tts-pause-btn:hover {
        background: #e0a800;
      }

      .tts-resume-btn {
        background: #28a745;
      }

      .tts-resume-btn:hover {
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

    // Pause button
    this.controlBar.querySelector('#tts-pause-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'pause' }, (response) => {
        if (response && response.status === 'paused') {
          this.updateStatus(false, true); // paused state
        }
      });
    });

    // Resume button
    this.controlBar.querySelector('#tts-resume-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'resume' }, (response) => {
        if (response && response.status === 'resumed') {
          this.updateStatus(true, false); // speaking state
        }
      });
    });
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