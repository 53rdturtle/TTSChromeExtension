// DOM-based sentence detection utility
// Uses TreeWalker to detect sentences based on HTML block elements

class DOMSentenceDetector {
  constructor() {
    this.blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'HEADER', 'SECTION', 'ARTICLE'];
    this.isServiceWorkerContext = this.detectServiceWorkerContext();
  }

  /**
   * Detect if we're running in a service worker context (no DOM access)
   * @returns {boolean} True if in service worker context
   */
  detectServiceWorkerContext() {
    return typeof document === 'undefined' || 
           typeof window === 'undefined' || 
           !document.createRange;
  }

  /**
   * Split text into sentences using sentencex library with fallback
   * @param {string} text - Text to split into sentences
   * @param {string} language - Language code (default: 'en')
   * @returns {Array} Array of sentence strings
   */
  splitTextIntoSentences(text, language = 'en') {
    // Try to use SimpleSentenceDetector (which uses sentencex) for accurate splitting
    if (typeof SimpleSentenceDetector !== 'undefined') {
      try {
        const detector = new SimpleSentenceDetector();
        const result = detector.detectSentences(text, language);
        return result.sentences || [];
      } catch (error) {
        console.warn('Sentencex failed, using fallback:', error);
      }
    }
    
    // Fallback to improved regex if SimpleSentenceDetector not available
    return this.fallbackSentenceSplit(text);
  }

  /**
   * Fallback sentence splitting using improved regex
   * @param {string} text - Text to split
   * @returns {Array} Array of sentence strings
   */
  fallbackSentenceSplit(text) {
    // Improved regex fallback (better than current primitive version)
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Detect sentences from DOM structure using block elements as boundaries
   * @param {Element} container - Container element to search within
   * @returns {Array} Array of sentence objects with text, element, and range
   */
  detectSentencesFromDOM(container) {
    const sentences = [];
    const blockElements = this.getBlockElementsWithTreeWalker(container);
    
    if (blockElements.length > 0) {
      // Process block elements with sentencex
      blockElements.forEach(element => {
        this.processElementWithSentencex(element, sentences);
      });
    } else {
      // CRITICAL FIX: Handle inline-only containers (no block elements found)
      this.processInlineContainer(container, sentences);
    }
    
    return sentences;
  }

  /**
   * SELECTION BUG FIX: Detect sentences from only selected elements
   * This fixes the bug where partial selections speak entire containers
   * @param {Array} selectedElements - Array of elements within the selection
   * @param {string} selectedText - The actual selected text (for validation)
   * @returns {Object} Sentence data object with sentences and metadata
   */
  detectSentencesFromSelection(selectedElements, selectedText) {
    const sentences = [];
    
    if (!selectedElements || selectedElements.length === 0) {
      console.warn('No selected elements provided for sentence detection');
      return { sentences: [], metadata: [], totalSentences: 0, method: 'dom_structure' };
    }
    
    // Process only the selected elements
    this.processSelectedElements(selectedElements, sentences);
    
    // Create sentence data format for compatibility
    const sentenceTexts = sentences.map(s => s.text);
    const metadata = sentences.map((sentence, index) => ({
      id: index,
      text: sentence.text,
      element: sentence.element,
      range: sentence.range,
      startPos: this.calculateTextPosition(sentences, index),
      length: sentence.text.length
    }));

    return {
      sentences: sentenceTexts,
      metadata: metadata,
      totalSentences: sentences.length,
      method: 'dom_structure',
      highlightingMode: 'sentence',
      selectedElements: selectedElements, // Pass through for validation
      originalSelectedText: selectedText // SELECTION ACCURACY FIX: Pass through for boundary validation
    };
  }

  /**
   * Process only the selected elements for sentence detection
   * @param {Array} selectedElements - Array of elements within the selection
   * @param {Array} sentences - Array to add detected sentences to
   */
  processSelectedElements(selectedElements, sentences) {
    selectedElements.forEach(element => {
      // Check if element is a block element
      if (this.blockTags.includes(element.tagName)) {
        this.processElementWithSentencex(element, sentences);
      } else {
        // Handle inline elements or text nodes
        this.processInlineContainer(element, sentences);
      }
    });
  }

  /**
   * Process a block element using sentencex for sentence splitting
   * @param {Element} element - DOM element to process
   * @param {Array} sentences - Array to add detected sentences to
   */
  processElementWithSentencex(element, sentences) {
    const text = element.textContent ? element.textContent.trim() : '';
    if (!text) return;
    
    // Use sentencex for ALL elements, not just paragraphs with '. '
    const sentenceParts = this.splitTextIntoSentences(text);
    sentenceParts.forEach(sentencePart => {
      const normalizedSentence = this.normalizeText(sentencePart);
      if (normalizedSentence && this.isValidSentence(normalizedSentence)) {
        sentences.push({
          text: normalizedSentence,
          element: element,
          range: this.createRangeFromElement(element, normalizedSentence)
        });
      }
    });
  }

  /**
   * Process inline-only containers when no block elements are found
   * @param {Element} container - Container element with inline content
   * @param {Array} sentences - Array to add detected sentences to
   */
  processInlineContainer(container, sentences) {
    const text = container.textContent ? container.textContent.trim() : '';
    if (!text) return;
    
    // Use sentencex to split text content from inline elements
    const sentenceParts = this.splitTextIntoSentences(text);
    sentenceParts.forEach(sentence => {
      const normalizedSentence = this.normalizeText(sentence);
      if (normalizedSentence && this.isValidSentence(normalizedSentence)) {
        sentences.push({
          text: normalizedSentence,
          element: container,
          range: this.createRangeFromElement(container, normalizedSentence)
        });
      }
    });
  }

  /**
   * Normalize text by cleaning up extra whitespace
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if text represents a valid sentence (not just punctuation)
   * @param {string} text - Text to validate
   * @returns {boolean} True if valid sentence
   */
  isValidSentence(text) {
    if (!text || text.length === 0) return false;
    
    // Filter out text that's only punctuation and/or whitespace
    const cleanText = text.replace(/[^\w\s]/g, '').trim();
    return cleanText.length > 0;
  }

  /**
   * Get block-level elements using TreeWalker API
   * @param {Element} container - Container element to search within
   * @returns {Array} Array of block-level DOM elements
   */
  getBlockElementsWithTreeWalker(container) {
    const blockElements = [];
    
    // Check if we're in a test environment with mock DOM objects
    // Test for mock objects by checking if children is a plain array (not NodeList)
    if (container && container.children && Array.isArray(container.children)) {
      // Use mock implementation for testing
      return this.getBlockElementsMock(container);
    }
    
    // Create TreeWalker to traverse elements
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Accept only block-level elements
          return this.blockTags.includes(node.tagName) 
            ? NodeFilter.FILTER_ACCEPT 
            : NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    // Collect all block elements
    let node;
    while (node = walker.nextNode()) {
      blockElements.push(node);
    }
    
    return blockElements;
  }

  /**
   * Mock implementation for testing environment
   * @param {Object} container - Mock container element
   * @returns {Array} Array of mock block-level DOM elements
   */
  getBlockElementsMock(container) {
    const blockElements = [];
    
    // Recursively collect elements
    const collectElements = (element) => {
      if (element.children) {
        element.children.forEach(child => {
          if (this.blockTags.includes(child.tagName)) {
            blockElements.push(child);
          }
          collectElements(child);
        });
      }
    };
    
    collectElements(container);
    return blockElements;
  }

  /**
   * Create a DOM Range from an element
   * @param {Element} element - DOM element
   * @param {string} text - Text content (for validation)
   * @returns {Range} DOM Range object
   */
  createRangeFromElement(element, text) {
    // SERVICE WORKER CONTEXT FIX: Check if we're in a context without DOM access
    if (this.isServiceWorkerContext) {
      console.log('🔧 Service worker context detected, using mock range for element:', element?.tagName || 'unknown');
      return this.createMockRange(element, text);
    }

    // Check if this is a mock element in test environment
    if (element && Array.isArray(element.children)) {
      return this.createMockRange(element, text);
    }
    
    // Normal DOM context - use real Range API
    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range;
    } catch (error) {
      console.warn('Failed to create DOM range, falling back to mock:', error);
      return this.createMockRange(element, text);
    }
  }

  /**
   * Create a mock range object for service worker or fallback contexts
   * @param {Element|Object} element - Element or element data
   * @param {string} text - Text content
   * @returns {Object} Mock range object
   */
  createMockRange(element, text = '') {
    const elementText = text || element?.textContent || element?.text || '';
    return {
      element: element,
      text: elementText,
      textContent: elementText,
      toString: () => elementText,
      selectNodeContents: () => {},
      isMockRange: true,
      serviceWorkerCompatible: true
    };
  }

  /**
   * Create sentence data compatible with SSML Builder
   * @param {Element} container - Container element to analyze
   * @returns {Object} Sentence data object with sentences and metadata
   */
  createSentenceData(container) {
    const sentences = this.detectSentencesFromDOM(container);
    
    const sentenceTexts = sentences.map(s => s.text);
    const metadata = sentences.map((sentence, index) => ({
      id: index,
      text: sentence.text,
      element: sentence.element,
      range: sentence.range,
      startPos: this.calculateTextPosition(sentences, index),
      length: sentence.text.length
    }));

    return {
      sentences: sentenceTexts,
      metadata: metadata,
      totalSentences: sentences.length,
      method: 'dom_structure',
      highlightingMode: 'sentence'
    };
  }

  /**
   * Calculate text position for a sentence within the full text
   * @param {Array} sentences - Array of all sentences
   * @param {number} index - Index of current sentence
   * @returns {number} Character position in full text
   */
  calculateTextPosition(sentences, index) {
    let position = 0;
    for (let i = 0; i < index; i++) {
      position += sentences[i].text.length;
      // Add space between sentences (except for the last one)
      if (i < sentences.length - 1) {
        position += 1;
      }
    }
    return position;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMSentenceDetector;
} else if (typeof window !== 'undefined') {
  window.DOMSentenceDetector = DOMSentenceDetector;
}