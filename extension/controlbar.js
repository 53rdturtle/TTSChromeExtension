// Content script for TTS Chrome Extension
// Handles floating control bar display and text highlighting

// TextHighlighter class to handle text highlighting during TTS
if (typeof window.TextHighlighter === 'undefined') {
class TextHighlighter {
  constructor() {
    this.highlightedElements = [];
    this.originalSelection = null;
  }

  // Highlight the selected text
  highlightText(text) {
    this.clearHighlights();
    
    // Store current selection
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    this.originalSelection = selection.getRangeAt(0).cloneRange();
    
    // Create highlight spans for the selected text
    const range = selection.getRangeAt(0);
    this.highlightRange(range);
    
    // Clear the selection to avoid blue highlight conflicting with yellow highlight
    selection.removeAllRanges();
  }

  // Apply highlighting to a range
  highlightRange(range) {
    if (range.collapsed) return;
    
    try {
      // Try simple surroundContents first for single-element ranges
      try {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'tts-highlight';
        highlightSpan.style.cssText = `
          background-color: #ffeb3b !important;
          color: #000 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          display: inline !important;
          position: static !important;
          transition: all 0.2s ease !important;
        `;
        
        range.surroundContents(highlightSpan);
        this.highlightedElements.push(highlightSpan);
      } catch (e) {
        // If surroundContents fails, use a more robust approach
        // that preserves the original DOM structure
        this.highlightComplexRange(range);
      }
    } catch (error) {
      console.error('Error highlighting text:', error);
    }
  }

  // Handle complex ranges that span multiple elements
  highlightComplexRange(range) {
    // Create a TreeWalker to traverse text nodes in the range
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Check if this text node intersects with our range
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          
          // Check if the node is within the selection range
          if (range.intersectsNode && range.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          // Fallback for older browsers
          try {
            return (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
                    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0) 
                    ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch (e) {
            return NodeFilter.FILTER_REJECT;
          }
        }
      }
    );

    const textNodes = [];
    let node;
    
    // Collect all text nodes in the range
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Highlight each text node separately
    textNodes.forEach(textNode => {
      try {
        // Create a range for this text node
        const textRange = document.createRange();
        textRange.selectNodeContents(textNode);
        
        // Adjust range boundaries if needed
        if (textNode === range.startContainer) {
          textRange.setStart(textNode, range.startOffset);
        }
        if (textNode === range.endContainer) {
          textRange.setEnd(textNode, range.endOffset);
        }
        
        // Only highlight if there's actual content
        if (!textRange.collapsed && textRange.toString().trim()) {
          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'tts-highlight';
          highlightSpan.style.cssText = `
            background-color: #ffeb3b !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            display: inline !important;
            position: static !important;
            transition: all 0.2s ease !important;
          `;
          
          textRange.surroundContents(highlightSpan);
          this.highlightedElements.push(highlightSpan);
        }
      } catch (e) {
        console.error('Error highlighting text node:', e);
      }
    });
  }

  // Clear all highlights
  clearHighlights() {
    this.highlightedElements.forEach(element => {
      if (element.parentNode) {
        // Move the contents back to the parent and remove the highlight span
        const parent = element.parentNode;
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        
        // Normalize the parent to merge adjacent text nodes
        parent.normalize();
      }
    });
    
    this.highlightedElements = [];
  }
}

// Make TextHighlighter available globally
window.TextHighlighter = TextHighlighter;
}

if (typeof window.FloatingControlBar === 'undefined') {
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
          <div class="tts-control-item tts-speed-controls">
            <button class="tts-btn tts-speed-btn tts-speed-down-btn" id="tts-speed-down-btn">
              <span class="tts-icon">🐌</span>
              Slower
            </button>
            <span class="tts-speed-display" id="tts-speed-display">1.0x</span>
            <button class="tts-btn tts-speed-btn tts-speed-up-btn" id="tts-speed-up-btn">
              <span class="tts-icon">🐰</span>
              Faster
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

      .tts-speed-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tts-speed-btn {
        background: #6c757d;
        color: white;
        flex: 0 0 auto;
        min-width: 70px;
        padding: 6px 10px;
        font-size: 11px;
      }

      .tts-speed-btn:hover {
        background: #5a6268;
      }

      .tts-speed-down-btn {
        background: #fd7e14;
      }

      .tts-speed-down-btn:hover {
        background: #e8690b;
      }

      .tts-speed-up-btn {
        background: #20c997;
      }

      .tts-speed-up-btn:hover {
        background: #1aa085;
      }

      .tts-speed-display {
        font-size: 11px;
        font-weight: bold;
        color: #333;
        min-width: 35px;
        text-align: center;
        padding: 0 4px;
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

    // Speed control buttons
    this.controlBar.querySelector('#tts-speed-down-btn').addEventListener('click', () => {
      this.changeSpeed(-0.1);
    });

    this.controlBar.querySelector('#tts-speed-up-btn').addEventListener('click', () => {
      this.changeSpeed(0.1);
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
    const speedDownBtn = this.controlBar.querySelector('#tts-speed-down-btn');
    const speedUpBtn = this.controlBar.querySelector('#tts-speed-up-btn');

    if (isSpeaking) {
      // Currently speaking - show pause button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
      speedDownBtn.disabled = false;
      speedUpBtn.disabled = false;
    } else if (isPaused) {
      // Currently paused - show resume button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.add('resume-state');
      toggleIcon.textContent = '▶';
      toggleText.textContent = 'Resume';
      speedDownBtn.disabled = false;
      speedUpBtn.disabled = false;
    } else {
      // Not speaking or paused - disable toggle button
      stopBtn.disabled = true;
      toggleBtn.disabled = true;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
      speedDownBtn.disabled = true;
      speedUpBtn.disabled = true;
    }
  }

  changeSpeed(delta) {
    // Get current speed from storage
    chrome.storage.sync.get(['speechRate'], (result) => {
      const currentRate = result.speechRate ? parseFloat(result.speechRate) : 1.0;
      let newRate = currentRate + delta;
      
      // Clamp speed between 0.1 and 3.0
      newRate = Math.max(0.1, Math.min(3.0, newRate));
      
      // Round to 1 decimal place
      newRate = Math.round(newRate * 10) / 10;
      
      // Update storage
      chrome.storage.sync.set({ speechRate: newRate.toString() }, () => {
        // Update display
        this.updateSpeedDisplay(newRate);
        
        // If currently speaking, send message to background to apply new speed
        chrome.runtime.sendMessage({ 
          type: 'updateSpeed', 
          rate: newRate 
        }, (response) => {
          if (response && response.status === 'error') {
            console.error('Speed update error:', response.error);
          }
        });
      });
    });
  }

  updateSpeedDisplay(rate) {
    const speedDisplay = this.controlBar.querySelector('#tts-speed-display');
    if (speedDisplay) {
      speedDisplay.textContent = rate.toFixed(1) + 'x';
    }
  }

  initializeSpeedDisplay() {
    // Get current speed from storage and update display
    chrome.storage.sync.get(['speechRate'], (result) => {
      const currentRate = result.speechRate ? parseFloat(result.speechRate) : 1.0;
      this.updateSpeedDisplay(currentRate);
    });
  }
}

// Make FloatingControlBar available globally
window.FloatingControlBar = FloatingControlBar;
}

// Initialize the floating control bar and text highlighter
if (typeof window.floatingControlBar === 'undefined') {
  window.floatingControlBar = null;
}
if (typeof window.textHighlighter === 'undefined') {
  window.textHighlighter = null;
}

// Only add message listener if not already added
if (!window.ttsMessageListenerAdded) {
  window.ttsMessageListenerAdded = true;
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!window.floatingControlBar) {
    window.floatingControlBar = new FloatingControlBar();
  }
  
  if (!window.textHighlighter) {
    window.textHighlighter = new TextHighlighter();
  }

  switch (message.type) {
    case 'showControlBar':
      window.floatingControlBar.show();
      // Set initial state if provided
      if (message.isSpeaking !== undefined || message.isPaused !== undefined) {
        window.floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
      }
      // Initialize speed display
      window.floatingControlBar.initializeSpeedDisplay();
      sendResponse({ status: 'success' });
      break;
    case 'hideControlBar':
      window.floatingControlBar.hide();
      sendResponse({ status: 'success' });
      break;
    case 'updateStatus':
      window.floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
      sendResponse({ status: 'success' });
      break;
    case 'highlightText':
      if (message.action === 'start') {
        window.textHighlighter.highlightText(message.text);
      } else if (message.action === 'end') {
        window.textHighlighter.clearHighlights();
      }
      sendResponse({ status: 'success' });
      break;
    default:
      sendResponse({ status: 'error', error: 'Unknown message type' });
  }
});

} // End of message listener guard

console.log('TTS Content script loaded');

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FloatingControlBar, TextHighlighter };
} 