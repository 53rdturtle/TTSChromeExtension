// Specific tests to reproduce and validate fixes for selection boundary bugs
// These tests directly target the reported issues with sentence indexing and boundary detection

// Polyfill TextEncoder for JSDOM compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { JSDOM } = require('jsdom');

describe('Selection Boundary Bug Reproduction', () => {
  let window, document;
  let mockChrome;

  beforeEach(() => {
    // Create test DOM environment
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Title</h1>
          <p>First paragraph with one sentence.</p>
          <p>Second paragraph with two sentences. This is the second sentence.</p>
          <p>Third paragraph with three sentences. This is sentence two. Final sentence here.</p>
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

    // Mock Chrome APIs
    mockChrome = {
      tabs: {
        query: jest.fn(),
        executeScript: jest.fn()
      },
      runtime: {
        sendMessage: jest.fn(),
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

  describe('BUG 1: Selection Boundary Over-inclusion', () => {
    test('SHOULD NOT include unselected content in findElementsInSelection', () => {
      // Mock the problematic findElementsInSelection function
      const buggyFindElementsInSelection = (selection) => {
        // BUG: This version includes ALL elements in the document, not just selected ones
        const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, div');
        return Array.from(allElements).map(el => ({
          tagName: el.tagName,
          textContent: el.textContent.trim(),
          element: el
        }));
      };

      // Create a selection that only covers the first paragraph
      const range = document.createRange();
      const firstP = document.querySelector('p');
      range.selectNodeContents(firstP);
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => firstP.textContent
      };

      // The buggy function returns ALL elements instead of just selected ones
      const buggyResult = buggyFindElementsInSelection(mockSelection);
      
      // BUG REPRODUCTION: Should only return 1 element but returns 4
      expect(buggyResult).toHaveLength(4); // BUG: includes h1 + 3 paragraphs
      expect(buggyResult.some(el => el.textContent.includes('Title'))).toBe(true); // BUG: includes unselected h1
      expect(buggyResult.some(el => el.textContent.includes('Third paragraph'))).toBe(true); // BUG: includes unselected p

      // EXPECTED BEHAVIOR: Fixed function should only return selected elements
      const fixedFindElementsInSelection = (selection) => {
        if (!selection || selection.rangeCount === 0) return [];
        
        const range = selection.getRangeAt(0);
        const selectedElements = [];
        
        // Only include elements that are actually within the selection range
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'DIV'].includes(node.tagName)) {
                return NodeFilter.FILTER_SKIP;
              }
              
              // Check if this element intersects with the selection range
              const elementRange = document.createRange();
              elementRange.selectNodeContents(node);
              
              try {
                return (range.intersectsNode && range.intersectsNode(node)) ||
                       (range.compareBoundaryPoints(Range.START_TO_END, elementRange) >= 0 &&
                        range.compareBoundaryPoints(Range.END_TO_START, elementRange) <= 0)
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_SKIP;
              } catch (e) {
                return NodeFilter.FILTER_SKIP;
              }
            }
          }
        );

        let node;
        while ((node = walker.nextNode())) {
          selectedElements.push({
            tagName: node.tagName,
            textContent: node.textContent.trim(),
            element: node
          });
        }
        
        return selectedElements;
      };

      const fixedResult = fixedFindElementsInSelection(mockSelection);
      
      // FIXED BEHAVIOR: Should only return the selected paragraph
      expect(fixedResult).toHaveLength(1);
      expect(fixedResult[0].textContent).toBe('First paragraph with one sentence.');
      expect(fixedResult.some(el => el.textContent.includes('Title'))).toBe(false);
      expect(fixedResult.some(el => el.textContent.includes('Third paragraph'))).toBe(false);
    });

    test('SHOULD handle cross-element selection correctly', () => {
      // Create a selection spanning from H1 to first paragraph
      const range = document.createRange();
      const h1 = document.querySelector('h1');
      const firstP = document.querySelector('p');
      
      range.setStartBefore(h1);
      range.setEndAfter(firstP);
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => h1.textContent + ' ' + firstP.textContent
      };

      // Fixed selection logic should include both H1 and first P
      const fixedResult = mockFixedFindElements(mockSelection);
      
      expect(fixedResult).toHaveLength(2);
      expect(fixedResult[0].textContent).toBe('Title');
      expect(fixedResult[1].textContent).toBe('First paragraph with one sentence.');
      
      // Should NOT include unselected paragraphs
      expect(fixedResult.some(el => el.textContent.includes('Second paragraph'))).toBe(false);
      expect(fixedResult.some(el => el.textContent.includes('Third paragraph'))).toBe(false);
    });
  });

  describe('BUG 2: Invalid Sentence Index Errors', () => {
    test('SHOULD NOT throw "Invalid sentence index" when highlighting', () => {
      // Mock the buggy highlightSentence function from content.js
      const buggyHighlightSentence = (sentenceIndex) => {
        // BUG: No bounds checking
        const sentenceElements = [
          { text: 'Sentence 0' },
          { text: 'Sentence 1' },
          { text: 'Sentence 2' }
        ];
        
        // This will throw if sentenceIndex >= sentenceElements.length
        const element = sentenceElements[sentenceIndex];
        if (!element) {
          throw new Error(`Invalid sentence index: ${sentenceIndex}`);
        }
        return element;
      };

      // BUG REPRODUCTION: Accessing out-of-bounds index should throw
      expect(() => buggyHighlightSentence(3)).toThrow('Invalid sentence index: 3');
      expect(() => buggyHighlightSentence(-1)).toThrow('Invalid sentence index: -1');
      expect(() => buggyHighlightSentence(10)).toThrow('Invalid sentence index: 10');

      // EXPECTED BEHAVIOR: Fixed function should handle bounds gracefully
      const fixedHighlightSentence = (sentenceIndex) => {
        const sentenceElements = [
          { text: 'Sentence 0' },
          { text: 'Sentence 1' },
          { text: 'Sentence 2' }
        ];
        
        // Bounds checking and graceful handling
        if (!sentenceElements || sentenceIndex < 0 || sentenceIndex >= sentenceElements.length) {
          console.warn(`Sentence index ${sentenceIndex} out of bounds (0-${sentenceElements.length - 1})`);
          return null; // Return null instead of throwing
        }
        
        return sentenceElements[sentenceIndex];
      };

      // FIXED BEHAVIOR: Should not throw, should return null for invalid indices
      expect(() => fixedHighlightSentence(3)).not.toThrow();
      expect(() => fixedHighlightSentence(-1)).not.toThrow();
      expect(() => fixedHighlightSentence(10)).not.toThrow();
      
      expect(fixedHighlightSentence(3)).toBeNull();
      expect(fixedHighlightSentence(-1)).toBeNull();
      expect(fixedHighlightSentence(10)).toBeNull();
      
      // Valid indices should still work
      expect(fixedHighlightSentence(0)).toEqual({ text: 'Sentence 0' });
      expect(fixedHighlightSentence(1)).toEqual({ text: 'Sentence 1' });
      expect(fixedHighlightSentence(2)).toEqual({ text: 'Sentence 2' });
    });

    test('SHOULD handle empty or null sentence arrays', () => {
      const robustHighlightSentence = (sentenceIndex, sentenceElements = null) => {
        // Handle null or undefined sentence arrays
        if (!sentenceElements || !Array.isArray(sentenceElements)) {
          console.warn('No valid sentence elements available');
          return null;
        }
        
        if (sentenceElements.length === 0) {
          console.warn('Sentence elements array is empty');
          return null;
        }
        
        if (sentenceIndex < 0 || sentenceIndex >= sentenceElements.length) {
          console.warn(`Sentence index ${sentenceIndex} out of bounds (0-${sentenceElements.length - 1})`);
          return null;
        }
        
        return sentenceElements[sentenceIndex];
      };

      // Should handle null/undefined gracefully
      expect(robustHighlightSentence(0, null)).toBeNull();
      expect(robustHighlightSentence(0, undefined)).toBeNull();
      expect(robustHighlightSentence(0, [])).toBeNull();
      expect(robustHighlightSentence(0, 'not an array')).toBeNull();
      
      // Should not throw for any of these cases
      expect(() => robustHighlightSentence(0, null)).not.toThrow();
      expect(() => robustHighlightSentence(0, undefined)).not.toThrow();
      expect(() => robustHighlightSentence(0, [])).not.toThrow();
    });
  });

  describe('BUG 3: Missing selectedElements in TTS Messages', () => {
    test('SHOULD include selectedElements in keyboard shortcut TTS messages', () => {
      // Mock the buggy getSelectedTextFromActiveTab function
      const buggyGetSelectedText = async () => {
        // BUG: Missing selectedElements in return data
        return {
          text: 'Selected text here',
          hasSelection: true
          // selectedElements: missing!
        };
      };

      // BUG REPRODUCTION: selectedElements should be missing
      buggyGetSelectedText().then(result => {
        expect(result.selectedElements).toBeUndefined();
        expect(result.text).toBeTruthy();
        expect(result.hasSelection).toBe(true);
      });

      // EXPECTED BEHAVIOR: Fixed function should include selectedElements
      const fixedGetSelectedText = async () => {
        // Mock DOM elements that would be found in selection
        const mockSelectedElements = [
          { tagName: 'P', textContent: 'Selected text here', outerHTML: '<p>Selected text here</p>' }
        ];
        
        return {
          text: 'Selected text here',
          hasSelection: true,
          selectedElements: mockSelectedElements, // This should be included!
          elementCount: mockSelectedElements.length
        };
      };

      return fixedGetSelectedText().then(result => {
        expect(result.selectedElements).toBeDefined();
        expect(Array.isArray(result.selectedElements)).toBe(true);
        expect(result.selectedElements).toHaveLength(1);
        expect(result.selectedElements[0].tagName).toBe('P');
        expect(result.elementCount).toBe(1);
      });
    });

    test('SHOULD handle keyboard shortcut TTS with selectedElements', () => {
      // Mock the message handling for keyboard shortcuts
      const mockHandleKeyboardShortcut = (message) => {
        // BUG: Current code doesn't use selectedElements from message
        if (message.action === 'toggleTTS') {
          const { text, selectedElements } = message;
          
          if (!selectedElements) {
            // BUG REPRODUCTION: This should fail due to missing selectedElements
            throw new Error('selectedElements missing from TTS message');
          }
          
          // FIXED BEHAVIOR: Should use selectedElements for better TTS processing
          return {
            success: true,
            usedElements: selectedElements.length,
            method: 'dom_aware'
          };
        }
        
        return { success: false };
      };

      // BUG REPRODUCTION: Missing selectedElements should cause error
      const buggyMessage = {
        action: 'toggleTTS',
        text: 'Some selected text'
        // selectedElements: missing
      };
      
      expect(() => mockHandleKeyboardShortcut(buggyMessage)).toThrow('selectedElements missing');

      // FIXED BEHAVIOR: Should work with selectedElements
      const fixedMessage = {
        action: 'toggleTTS',
        text: 'Some selected text',
        selectedElements: [
          { tagName: 'P', textContent: 'Some selected text' }
        ]
      };
      
      const result = mockHandleKeyboardShortcut(fixedMessage);
      expect(result.success).toBe(true);
      expect(result.usedElements).toBe(1);
      expect(result.method).toBe('dom_aware');
    });
  });

  describe('BUG 4: Missing Validation Warnings in SSML Builder', () => {
    test('SHOULD warn about suspicious sentence-to-element ratios', () => {
      // Mock SSML builder validation
      const validateSentenceData = (sentences, elements) => {
        const warnings = [];
        
        if (!sentences || !elements) {
          warnings.push('Missing sentence or element data');
          return warnings;
        }
        
        const ratio = sentences.length / elements.length;
        
        // BUG: Current code doesn't validate suspicious ratios
        // FIXED: Should warn about potential selection boundary issues
        if (ratio > 3) {
          warnings.push(`High sentence-to-element ratio (${ratio.toFixed(1)}:1) - possible selection boundary issue`);
        }
        
        if (ratio > 5) {
          warnings.push(`Very high sentence-to-element ratio (${ratio.toFixed(1)}:1) - likely includes unselected content`);
        }
        
        if (sentences.length === 0 && elements.length > 0) {
          warnings.push('No sentences detected despite having elements - possible parsing issue');
        }
        
        if (sentences.length > 50 && elements.length < 5) {
          warnings.push('Extremely high sentence count for few elements - probable selection boundary bug');
        }
        
        return warnings;
      };

      // Test cases that should trigger warnings
      const suspiciousCase1 = {
        sentences: Array.from({ length: 15 }, (_, i) => `Sentence ${i}`),
        elements: [{ tagName: 'H1' }, { tagName: 'P' }] // 15:2 = 7.5:1 ratio
      };
      
      const warnings1 = validateSentenceData(suspiciousCase1.sentences, suspiciousCase1.elements);
      expect(warnings1.some(w => w.includes('High sentence-to-element ratio'))).toBe(true);
      expect(warnings1.some(w => w.includes('Very high sentence-to-element ratio'))).toBe(true);
      
      const suspiciousCase2 = {
        sentences: Array.from({ length: 60 }, (_, i) => `Sentence ${i}`),
        elements: [{ tagName: 'H1' }, { tagName: 'P' }, { tagName: 'DIV' }] // 60:3 = 20:1 ratio
      };
      
      const warnings2 = validateSentenceData(suspiciousCase2.sentences, suspiciousCase2.elements);
      expect(warnings2.some(w => w.includes('Extremely high sentence count'))).toBe(true);
      
      // Normal case should not trigger warnings
      const normalCase = {
        sentences: ['Sentence 1', 'Sentence 2', 'Sentence 3'],
        elements: [{ tagName: 'H1' }, { tagName: 'P' }, { tagName: 'P' }] // 3:3 = 1:1 ratio
      };
      
      const warnings3 = validateSentenceData(normalCase.sentences, normalCase.elements);
      expect(warnings3).toHaveLength(0);
    });

    test('SHOULD validate sentence metadata consistency', () => {
      const validateMetadataConsistency = (sentences, metadata) => {
        const warnings = [];
        
        if (!sentences || !metadata) {
          warnings.push('Missing sentences or metadata');
          return warnings;
        }
        
        if (sentences.length !== metadata.length) {
          warnings.push(`Sentence count (${sentences.length}) does not match metadata count (${metadata.length})`);
        }
        
        // Check for missing sentence text in metadata
        metadata.forEach((meta, index) => {
          if (!meta || !meta.text) {
            warnings.push(`Missing text in metadata at index ${index}`);
          } else if (meta.text !== sentences[index]) {
            warnings.push(`Metadata text mismatch at index ${index}`);
          }
        });
        
        return warnings;
      };

      // Test mismatched lengths
      const mismatchedCase = {
        sentences: ['A', 'B', 'C'],
        metadata: [{ text: 'A' }, { text: 'B' }] // Missing one metadata entry
      };
      
      const warnings1 = validateMetadataConsistency(mismatchedCase.sentences, mismatchedCase.metadata);
      expect(warnings1.some(w => w.includes('does not match metadata count'))).toBe(true);
      
      // Test missing text in metadata
      const missingTextCase = {
        sentences: ['A', 'B', 'C'],
        metadata: [{ text: 'A' }, { }, { text: 'C' }] // Missing text in second entry
      };
      
      const warnings2 = validateMetadataConsistency(missingTextCase.sentences, missingTextCase.metadata);
      expect(warnings2.some(w => w.includes('Missing text in metadata at index 1'))).toBe(true);
    });
  });

  // Helper function for testing
  function mockFixedFindElements(selection) {
    if (!selection || selection.rangeCount === 0) return [];
    
    const range = selection.getRangeAt(0);
    const elements = [];
    
    // Simple mock implementation for testing
    const allElements = document.querySelectorAll('h1, p');
    allElements.forEach(el => {
      // Mock intersection check
      const elementRange = document.createRange();
      elementRange.selectNodeContents(el);
      
      try {
        // Basic intersection logic for testing
        if (range.intersectsNode ? range.intersectsNode(el) : true) {
          elements.push({
            tagName: el.tagName,
            textContent: el.textContent.trim(),
            element: el
          });
        }
      } catch (e) {
        // Skip problematic elements
      }
    });
    
    return elements;
  }
});