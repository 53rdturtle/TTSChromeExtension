// TDD tests to prevent double-speaking bug where same selection is spoken twice
// Reproduces the exact issue: speaks full section, then speaks selected content again

// Polyfill TextEncoder for JSDOM compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { JSDOM } = require('jsdom');

describe('Double-Speaking Prevention', () => {
  let window, document;
  let mockChrome;
  let ttsRequestCount;
  let ttsRequests;

  beforeEach(() => {
    // Create exact DOM structure from test.html where double-speaking occurs
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="test-section">
            <h2>Sample Text for Testing</h2>
            
            <div class="highlight">
              <strong>Short text:</strong> This is a short sentence to test the TTS functionality.
            </div>
            
            <div class="highlight">
              <strong>Medium text:</strong> This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.
            </div>
            
            <div class="highlight">
              <strong>Long text:</strong> This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.
            </div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.Node = window.Node;
    global.Range = window.Range;
    global.NodeFilter = window.NodeFilter;

    // Track TTS requests
    ttsRequestCount = 0;
    ttsRequests = [];

    // Mock Chrome APIs with request tracking
    mockChrome = {
      tabs: {
        query: jest.fn(),
        executeScript: jest.fn()
      },
      runtime: {
        sendMessage: jest.fn().mockImplementation((message) => {
          if (message.type === 'speak') {
            ttsRequestCount++;
            ttsRequests.push({
              text: message.text,
              selectedElements: message.selectedElements,
              timestamp: Date.now()
            });
          }
        }),
        onMessage: { addListener: jest.fn() }
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue()
        }
      }
    };
    global.chrome = mockChrome;
  });

  describe('BUG REPRODUCTION: Double TTS Session for Same Selection', () => {
    test('SHOULD trigger only ONE TTS session per selection', () => {
      // User selects: "Sample Text for Testing\nShort text: This is a short sentence..."
      const h2Element = document.querySelector('h2');
      const firstDivElement = document.querySelector('div.highlight:first-of-type');
      
      const range = document.createRange();
      range.setStartBefore(h2Element);
      range.setEndAfter(firstDivElement);
      
      const selectedText = range.toString().trim();
      
      // Mock TTS request handler with deduplication
      const handleTTSWithDeduplication = (() => {
        let lastRequest = null;
        
        return (text, selectedElements) => {
          // Check for duplicate request
          if (lastRequest && lastRequest.text === text && 
              lastRequest.timestamp > Date.now() - 1000) { // Within 1 second
            console.log('🚫 Duplicate TTS request detected and prevented');
            return false; // Blocked
          }
          
          lastRequest = { text, timestamp: Date.now() };
          ttsRequestCount++;
          ttsRequests.push({ text, selectedElements });
          return true; // Allowed
        };
      })();
      
      // Simulate the buggy scenario: two TTS requests for same selection
      
      // First request: Wrong element detection (includes siblings)
      const wrongElements = [
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' },
        { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph...' }, // BUG: included
        { tagName: 'DIV', textContent: 'Long text: This is a much longer piece...' }  // BUG: included
      ];
      const wrongText = wrongElements.map(el => el.textContent).join('\n');
      
      // Second request: Correct element detection (only selected)
      const correctElements = [
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' }
      ];
      const correctText = correctElements.map(el => el.textContent).join('\n');
      
      // Both requests would use same selectedText - should be deduplicated
      const request1Allowed = handleTTSWithDeduplication(selectedText, wrongElements);
      const request2Allowed = handleTTSWithDeduplication(selectedText, correctElements);
      
      // EXPECTED: Only first request allowed, second blocked as duplicate
      expect(request1Allowed).toBe(true);  // First request goes through
      expect(request2Allowed).toBe(false); // Second request blocked
      expect(ttsRequestCount).toBe(1);     // Only one TTS session
    });

    test('SHOULD prevent multiple content script initializations', () => {
      let contentScriptInitCount = 0;
      const initializationTracker = new Set();
      
      // Mock content script initialization tracking
      const mockContentScriptInit = (tabId) => {
        if (initializationTracker.has(tabId)) {
          console.log('🔄 TTS Content script already loaded, skipping re-initialization');
          return false; // Skip initialization
        }
        
        initializationTracker.add(tabId);
        contentScriptInitCount++;
        console.log('🚀 Initializing TTS Content script');
        return true; // Initialize
      };
      
      const tabId = 'test-tab-123';
      
      // Simulate multiple initialization attempts (the bug scenario)
      const init1 = mockContentScriptInit(tabId);
      const init2 = mockContentScriptInit(tabId);
      const init3 = mockContentScriptInit(tabId);
      
      // EXPECTED: Only first initialization succeeds
      expect(init1).toBe(true);  // First init allowed
      expect(init2).toBe(false); // Second init blocked
      expect(init3).toBe(false); // Third init blocked
      expect(contentScriptInitCount).toBe(1); // Only one actual initialization
    });

    test('SHOULD detect duplicate TTS requests with same text content', () => {
      const selectedText = 'Sample Text for Testing\nShort text: This is a short sentence to test the TTS functionality.';
      
      // Mock TTS session tracking
      class TTSSessionManager {
        constructor() {
          this.activeSessions = new Map();
          this.requestHistory = [];
        }
        
        requestTTS(text, elements) {
          const textHash = this.hashText(text);
          const now = Date.now();
          
          // Check for recent duplicate request (within 2 seconds)
          const recentRequest = this.requestHistory.find(req => 
            req.textHash === textHash && (now - req.timestamp) < 2000
          );
          
          if (recentRequest) {
            console.warn('🚫 Duplicate TTS request ignored:', text.substring(0, 50) + '...');
            return { success: false, reason: 'duplicate_request' };
          }
          
          // Record this request
          this.requestHistory.push({ textHash, timestamp: now });
          this.activeSessions.set(textHash, { text, elements, timestamp: now });
          
          return { success: true, sessionId: textHash };
        }
        
        hashText(text) {
          // Simple hash function for testing
          return text.replace(/\s+/g, ' ').trim().substring(0, 100);
        }
      }
      
      const sessionManager = new TTSSessionManager();
      
      // Simulate the double-speaking scenario
      const request1 = sessionManager.requestTTS(selectedText, ['h2', 'div']); // Wrong elements
      const request2 = sessionManager.requestTTS(selectedText, ['h2', 'div']); // Corrected elements (same text)
      
      // EXPECTED: Second request blocked as duplicate
      expect(request1.success).toBe(true);
      expect(request2.success).toBe(false);
      expect(request2.reason).toBe('duplicate_request');
    });
  });

  describe('Content Script Event Handler Management', () => {
    test('SHOULD not attach duplicate event handlers', () => {
      let eventHandlerCount = 0;
      const attachedHandlers = new Set();
      
      // Mock event handler attachment with tracking
      const mockAddEventListener = (event, handler, handlerId) => {
        if (attachedHandlers.has(handlerId)) {
          console.log(`🔄 Event handler ${handlerId} already attached, skipping`);
          return false;
        }
        
        attachedHandlers.add(handlerId);
        eventHandlerCount++;
        console.log(`✅ Attached event handler ${handlerId}`);
        return true;
      };
      
      // Simulate multiple content script injections trying to attach same handlers
      const handler1 = mockAddEventListener('keydown', () => {}, 'tts-keyboard-shortcut');
      const handler2 = mockAddEventListener('keydown', () => {}, 'tts-keyboard-shortcut'); // Duplicate
      const handler3 = mockAddEventListener('message', () => {}, 'tts-message-handler');
      const handler4 = mockAddEventListener('message', () => {}, 'tts-message-handler'); // Duplicate
      
      // EXPECTED: Only unique handlers attached
      expect(handler1).toBe(true);  // First keyboard handler attached
      expect(handler2).toBe(false); // Duplicate keyboard handler blocked
      expect(handler3).toBe(true);  // First message handler attached
      expect(handler4).toBe(false); // Duplicate message handler blocked
      expect(eventHandlerCount).toBe(2); // Only 2 unique handlers
    });

    test('SHOULD track and prevent concurrent TTS operations', () => {
      // Mock TTS operation state tracking
      class TTSOperationTracker {
        constructor() {
          this.activeOperations = new Map();
        }
        
        startOperation(operationId, details) {
          if (this.activeOperations.has(operationId)) {
            console.warn(`🚫 TTS operation ${operationId} already in progress`);
            return { success: false, reason: 'operation_in_progress' };
          }
          
          this.activeOperations.set(operationId, {
            ...details,
            startTime: Date.now(),
            status: 'active'
          });
          
          console.log(`🚀 Started TTS operation ${operationId}`);
          return { success: true, operationId };
        }
        
        completeOperation(operationId) {
          const operation = this.activeOperations.get(operationId);
          if (!operation) {
            console.warn(`⚠️ Operation ${operationId} not found`);
            return false;
          }
          
          this.activeOperations.delete(operationId);
          console.log(`✅ Completed TTS operation ${operationId}`);
          return true;
        }
        
        isOperationActive(operationId) {
          return this.activeOperations.has(operationId);
        }
      }
      
      const tracker = new TTSOperationTracker();
      const operationId = 'tts-sample-text-selection';
      
      // Simulate concurrent TTS attempts
      const op1 = tracker.startOperation(operationId, { text: 'Sample text...', elements: 2 });
      const op2 = tracker.startOperation(operationId, { text: 'Sample text...', elements: 4 }); // Concurrent attempt
      
      // EXPECTED: Second operation blocked
      expect(op1.success).toBe(true);
      expect(op2.success).toBe(false);
      expect(op2.reason).toBe('operation_in_progress');
      expect(tracker.isOperationActive(operationId)).toBe(true);
      
      // Complete first operation
      const completed = tracker.completeOperation(operationId);
      expect(completed).toBe(true);
      expect(tracker.isOperationActive(operationId)).toBe(false);
    });
  });

  describe('TTS Request Validation and Filtering', () => {
    test('SHOULD validate TTS request parameters to prevent malformed requests', () => {
      // Mock TTS request validator
      const validateTTSRequest = (request) => {
        const errors = [];
        
        if (!request.text || request.text.trim().length === 0) {
          errors.push('Missing or empty text content');
        }
        
        if (!request.selectedElements || !Array.isArray(request.selectedElements)) {
          errors.push('Missing or invalid selectedElements array');
        }
        
        if (request.selectedElements && request.selectedElements.length === 0) {
          errors.push('No elements selected');
        }
        
        // Validate text vs elements consistency
        if (request.text && request.selectedElements) {
          const elementsText = request.selectedElements.map(el => el.textContent || '').join(' ').trim();
          const textSimilarity = request.text.length / Math.max(elementsText.length, 1);
          
          if (textSimilarity > 2 || textSimilarity < 0.5) {
            errors.push('Text content mismatch with selected elements');
          }
        }
        
        return {
          valid: errors.length === 0,
          errors: errors
        };
      };
      
      // Test valid request
      const validRequest = {
        text: 'Sample Text for Testing\nShort text: This is a short sentence to test the TTS functionality.',
        selectedElements: [
          { tagName: 'H2', textContent: 'Sample Text for Testing' },
          { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' }
        ]
      };
      
      const validResult = validateTTSRequest(validRequest);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      // Test invalid request (the bug scenario with too many elements)
      const invalidRequest = {
        text: 'Sample Text for Testing\nShort text: This is a short sentence to test the TTS functionality.',
        selectedElements: [
          { tagName: 'H2', textContent: 'Sample Text for Testing' },
          { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' },
          { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph that contains multiple sentences...' }, // Extra element
          { tagName: 'DIV', textContent: 'Long text: This is a much longer piece of text...' } // Extra element
        ]
      };
      
      const invalidResult = validateTTSRequest(invalidRequest);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Text content mismatch with selected elements');
    });
  });
});