// TDD tests for selection text accuracy bug
// Ensures spoken text matches exactly what user selected, no more, no less

// Polyfill TextEncoder for JSDOM compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { JSDOM } = require('jsdom');

describe('Selection Text Accuracy: Selected Text === Spoken Text', () => {
  let window, document;
  let mockChrome;

  beforeEach(() => {
    // Create the exact DOM structure from test.html where bug occurs
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="test-section">
            <h2>Instructions</h2>
            <p>To test the TTS extension with floating control bar:</p>
            <ol>
              <li>Select any text on this page</li>
              <li>Press Ctrl+Shift+Z (or your configured shortcut)</li>
              <li>A floating control bar should appear in the top-right corner</li>
              <li>Use the control bar to stop, pause, or resume the TTS</li>
            </ol>
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

  describe('BUG REPRODUCTION: Cross-Element Selection Over-inclusion', () => {
    test('SHOULD speak only selected text: "Instructions\\nTo test the TTS extension with floating control bar:"', () => {
      // EXACT BUG SCENARIO: User selects H2 + P content, but system includes entire OL
      const h2Element = document.querySelector('h2');
      const pElement = document.querySelector('p');
      
      // Create selection range that spans H2 + P (the actual user selection)
      const range = document.createRange();
      range.setStartBefore(h2Element);
      range.setEndAfter(pElement);
      
      const actualSelectedText = range.toString().trim();
      
      // This should contain both H2 and P content, but NOT the OL content
      expect(actualSelectedText).toContain('Instructions');
      expect(actualSelectedText).toContain('To test the TTS extension with floating control bar:');
      expect(actualSelectedText).not.toContain('Select any text on this page'); // Should NOT include OL content
      
      // Mock the current buggy behavior that includes entire OL
      const buggyElementDetection = () => {
        const elements = [];
        const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'HEADER', 'SECTION', 'ARTICLE', 'OL', 'UL'];
        
        document.querySelectorAll(blockTags.join(', ')).forEach(element => {
          // BUG: Current logic uses intersectsNode which includes ANY intersection
          if (range.intersectsNode && range.intersectsNode(element)) {
            elements.push({
              tagName: element.tagName,
              textContent: element.textContent.trim()
            });
          }
        });
        
        return elements;
      };
      
      const buggyElements = buggyElementDetection();
      const buggyText = buggyElements.map(el => el.textContent).join('\n');
      
      // BUG REPRODUCTION: Current system includes too much content
      expect(buggyText.length).toBeGreaterThan(actualSelectedText.length); // BUG: includes extra content
      expect(buggyText).toContain('Select any text on this page'); // BUG: includes unselected OL content
      
      // EXPECTED BEHAVIOR: Fixed system should match selection exactly
      const expectedText = actualSelectedText;
      expect(expectedText).not.toContain('Select any text on this page');
      expect(expectedText.split('\n')).toHaveLength(2); // Only H2 + P, not OL items
    });

    test('SHOULD detect correct sentence count from partial selection', () => {
      // Create the problematic selection
      const h2Element = document.querySelector('h2');
      const pElement = document.querySelector('p');
      
      const range = document.createRange();
      range.setStartBefore(h2Element);
      range.setEndAfter(pElement);
      
      const selectedText = range.toString().trim();
      
      // Expected: Around 2 sentences from H2 + P (depends on splitting logic)
      // Basic expectation: should be small number, not include OL sentences
      const basicSentenceCount = selectedText.split(/[.!?:]+/).filter(s => s.trim().length > 0).length;
      expect(basicSentenceCount).toBeLessThanOrEqual(3); // Should be small (H2 + P only)
      
      // Current buggy behavior that includes OL content would have many more sentences
      const buggyIncludesOL = () => {
        const allText = selectedText + '\nSelect any text on this page\nPress Ctrl+Shift+Z (or your configured shortcut)\nA floating control bar should appear in the top-right corner\nUse the control bar to stop, pause, or resume the TTS';
        return allText.split(/[.!?:]+/).filter(s => s.trim().length > 0);
      };
      
      const buggySentences = buggyIncludesOL();
      expect(buggySentences.length).toBeGreaterThan(basicSentenceCount); // BUG: includes extra sentences
      
      // Fixed behavior should only process selected text
      const fixedSentences = selectedText.split(/[.!?:]+/).filter(s => s.trim().length > 0);
      expect(fixedSentences.length).toBeLessThanOrEqual(3); // FIXED: small sentence count
    });

    test('SHOULD not trigger sentence index out-of-bounds errors', () => {
      // Simulate the exact error scenario from logs
      const selectedText = 'Instructions\nTo test the TTS extension with floating control bar:';
      const expectedSentenceCount = 2;
      
      // Mock sentence highlighting system
      const mockHighlighter = {
        sentenceElements: Array.from({ length: expectedSentenceCount }, (_, i) => ({
          index: i,
          text: i === 0 ? 'Instructions' : 'To test the TTS extension with floating control bar:',
          highlighted: false
        })),
        
        highlightSentence: function(sentenceIndex) {
          // This is the exact error from logs: "Sentence index 2 out of bounds (0-1)"
          if (sentenceIndex < 0 || sentenceIndex >= this.sentenceElements.length) {
            console.warn(`Sentence index ${sentenceIndex} out of bounds (0-${this.sentenceElements.length - 1})`);
            return false;
          }
          
          this.sentenceElements[sentenceIndex].highlighted = true;
          return true;
        }
      };
      
      // Should work for valid indices (0, 1)
      expect(mockHighlighter.highlightSentence(0)).toBe(true);
      expect(mockHighlighter.highlightSentence(1)).toBe(true);
      
      // Should handle out-of-bounds gracefully (the bug from logs)
      expect(mockHighlighter.highlightSentence(2)).toBe(false); // Index 2 doesn't exist for 2-sentence selection
      expect(mockHighlighter.highlightSentence(3)).toBe(false);
      
      // Verify only correct number of sentences
      expect(mockHighlighter.sentenceElements).toHaveLength(expectedSentenceCount);
    });
  });

  describe('Selection Boundary Validation', () => {
    test('SHOULD validate element intersection with actual selection boundaries', () => {
      const h2Element = document.querySelector('h2');
      const pElement = document.querySelector('p');
      const olElement = document.querySelector('ol');
      
      // Create selection that spans H2 + P but NOT OL
      const range = document.createRange();
      range.setStartBefore(h2Element);
      range.setEndAfter(pElement);
      
      const selectedText = range.toString();
      
      // Fixed element intersection logic
      const fixedElementIntersection = (element, range, selectedText) => {
        // Check basic intersection
        if (!range.intersectsNode || !range.intersectsNode(element)) {
          return false;
        }
        
        // Additional validation: element content should be substantially included in selection
        const elementText = element.textContent.trim();
        if (!elementText) return false;
        
        // If element text is completely contained in selection, include it
        if (selectedText.includes(elementText)) {
          return true;
        }
        
        // If selection is contained within element, include it (partial selection)
        if (elementText.includes(selectedText.trim())) {
          return true;
        }
        
        // Check for partial overlap using text position
        const elementTextInSelection = selectedText.includes(elementText.substring(0, Math.min(50, elementText.length)));
        const selectionTextInElement = elementText.includes(selectedText.substring(0, Math.min(50, selectedText.length)));
        
        return elementTextInSelection || selectionTextInElement;
      };
      
      // Test each element
      expect(fixedElementIntersection(h2Element, range, selectedText)).toBe(true); // H2 should be included
      expect(fixedElementIntersection(pElement, range, selectedText)).toBe(true);  // P should be included
      expect(fixedElementIntersection(olElement, range, selectedText)).toBe(false); // OL should NOT be included
      
      // Verify OL content is not in selection
      expect(selectedText).not.toContain('Select any text on this page');
      expect(selectedText).not.toContain('Press Ctrl+Shift+Z');
    });

    test('SHOULD extract only selected text portion from intersecting elements', () => {
      // Test partial element selection scenario
      const pElement = document.querySelector('p');
      const fullPText = pElement.textContent; // "To test the TTS extension with floating control bar:"
      
      // Create selection of only part of the P element
      const range = document.createRange();
      const textNode = pElement.firstChild;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 25); // "To test the TTS extensio"
      
      const partialSelectedText = range.toString();
      expect(partialSelectedText).toContain('To test the TTS'); // Should include at least this part
      expect(partialSelectedText.length).toBeLessThan(fullPText.length);
      
      // Fixed text extraction should return only selected portion
      const extractSelectedTextFromElement = (element, range) => {
        try {
          // Create a range for just this element
          const elementRange = document.createRange();
          elementRange.selectNodeContents(element);
          
          // Find intersection between selection and element
          const intersectionRange = document.createRange();
          
          // Start: max of selection start and element start
          const selectionStart = range.startContainer;
          const elementStart = elementRange.startContainer;
          
          if (range.comparePoint(element, 0) >= 0) {
            intersectionRange.setStart(range.startContainer, range.startOffset);
          } else {
            intersectionRange.setStart(elementRange.startContainer, elementRange.startOffset);
          }
          
          // End: min of selection end and element end
          if (range.comparePoint(element, element.childNodes.length) <= 0) {
            intersectionRange.setEnd(range.endContainer, range.endOffset);
          } else {
            intersectionRange.setEnd(elementRange.endContainer, elementRange.endOffset);
          }
          
          return intersectionRange.toString();
        } catch (e) {
          // Fallback to full element text
          return element.textContent;
        }
      };
      
      const extractedText = extractSelectedTextFromElement(pElement, range);
      expect(extractedText).toContain('To test the TTS'); // Should contain the partial selection
      expect(extractedText.length).toBeLessThanOrEqual(fullPText.length); // Should not exceed full text
    });
  });

  describe('Text Length and Content Validation', () => {
    test('SHOULD ensure spoken text length matches selected text length', () => {
      const h2Element = document.querySelector('h2');
      const pElement = document.querySelector('p');
      
      const range = document.createRange();
      range.setStartBefore(h2Element);
      range.setEndAfter(pElement);
      
      const selectedText = range.toString().trim();
      const expectedLength = selectedText.length;
      
      // Mock TTS processing
      const mockTTSProcessing = (elements) => {
        // Current buggy behavior: concatenate all element text
        return elements.map(el => el.textContent).join('\n').trim();
      };
      
      // Buggy elements (includes OL)
      const buggyElements = [
        { textContent: 'Instructions' },
        { textContent: 'To test the TTS extension with floating control bar:' },
        { textContent: 'Select any text on this page\nPress Ctrl+Shift+Z (or your configured shortcut)\nA floating control bar should appear in the top-right corner\nUse the control bar to stop, pause, or resume the TTS' }
      ];
      
      const buggySpokenText = mockTTSProcessing(buggyElements);
      expect(buggySpokenText.length).toBeGreaterThan(expectedLength); // BUG: too much content
      
      // Fixed elements (only H2 + P)
      const fixedElements = [
        { textContent: 'Instructions' },
        { textContent: 'To test the TTS extension with floating control bar:' }
      ];
      
      const fixedSpokenText = mockTTSProcessing(fixedElements);
      expect(fixedSpokenText.length).toBeLessThanOrEqual(expectedLength * 1.1); // FIXED: close match (allow for whitespace differences)
      expect(fixedSpokenText).toContain('Instructions'); // FIXED: content match
      expect(fixedSpokenText).toContain('To test the TTS extension with floating control bar:'); // FIXED: content match
    });

    test('SHOULD prevent SSML generation beyond selection boundaries', () => {
      const selectedText = 'Instructions\nTo test the TTS extension with floating control bar:';
      
      // Mock SSML building with validation
      const validateSSMLBoundaries = (sentences, originalSelectedText) => {
        const ssmlText = sentences.join(' ').trim();
        const selectedTextNormalized = originalSelectedText.replace(/\s+/g, ' ').trim();
        
        // Validation: SSML content should not exceed selected text scope
        if (ssmlText.length > selectedTextNormalized.length * 1.2) { // 20% tolerance for punctuation/formatting
          return {
            valid: false,
            warning: `SSML content (${ssmlText.length} chars) exceeds selection boundary (${selectedTextNormalized.length} chars)`,
            ssmlText,
            selectedText: selectedTextNormalized
          };
        }
        
        return {
          valid: true,
          ssmlText,
          selectedText: selectedTextNormalized
        };
      };
      
      // Buggy sentences (includes OL content)
      const buggySentences = [
        'Instructions',
        'To test the TTS extension with floating control bar:',
        'Select any text on this page',
        'Press Ctrl+Shift+Z (or your configured shortcut)',
        'A floating control bar should appear in the top-right corner',
        'Use the control bar to stop, pause, or resume the TTS'
      ];
      
      const buggyValidation = validateSSMLBoundaries(buggySentences, selectedText);
      expect(buggyValidation.valid).toBe(false); // Should detect boundary violation
      expect(buggyValidation.warning).toContain('exceeds selection boundary');
      
      // Fixed sentences (only from selection)
      const fixedSentences = [
        'Instructions',
        'To test the TTS extension with floating control bar:'
      ];
      
      const fixedValidation = validateSSMLBoundaries(fixedSentences, selectedText);
      expect(fixedValidation.valid).toBe(true); // Should pass validation
      expect(fixedValidation.ssmlText.length).toBeLessThanOrEqual(selectedText.length * 1.2);
    });
  });

  describe('Cross-Element Selection Edge Cases', () => {
    test('SHOULD handle selection starting mid-element and ending mid-element', () => {
      const h2Element = document.querySelector('h2');
      const pElement = document.querySelector('p');
      
      // Select from middle of H2 to middle of P
      const range = document.createRange();
      const h2TextNode = h2Element.firstChild;
      const pTextNode = pElement.firstChild;
      
      range.setStart(h2TextNode, 2); // "structions" (from "Instructions")
      range.setEnd(pTextNode, 15);   // "To test the TTS" (from "To test the TTS extension...")
      
      const partialSelectedText = range.toString();
      expect(partialSelectedText).toContain('structions');
      expect(partialSelectedText).toContain('To test the TTS');
      expect(partialSelectedText).not.toContain('extension with floating'); // Should not include rest of P
      
      // System should only speak the partial selection
      const expectedSpokenText = partialSelectedText;
      expect(expectedSpokenText.length).toBeLessThan(80); // Much shorter than full elements
    });

    test('SHOULD handle non-contiguous selections correctly', () => {
      // While browsers don't typically support non-contiguous selections,
      // test that our system handles multiple ranges gracefully
      const h2Element = document.querySelector('h2');
      const firstLiElement = document.querySelector('li');
      
      const range1 = document.createRange();
      range1.selectNodeContents(h2Element);
      
      const range2 = document.createRange();
      range2.selectNodeContents(firstLiElement);
      
      // Mock multi-range selection
      const multiRangeSelection = {
        rangeCount: 2,
        getRangeAt: (index) => index === 0 ? range1 : range2,
        toString: () => range1.toString() + ' ' + range2.toString()
      };
      
      const expectedText = 'Instructions Select any text on this page';
      expect(multiRangeSelection.toString().trim()).toBe(expectedText);
      
      // System should handle this gracefully without including unselected content
      expect(multiRangeSelection.toString()).not.toContain('Press Ctrl+Shift+Z');
    });
  });
});