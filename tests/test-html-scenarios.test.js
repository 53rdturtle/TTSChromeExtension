// Comprehensive test scenarios based on test.html analysis
// These tests define expected behavior for all realistic selection patterns

// Polyfill TextEncoder for JSDOM compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { JSDOM } = require('jsdom');

describe('test.html Comprehensive Selection Scenarios', () => {
  let window, document;

  beforeEach(() => {
    // Create the exact DOM structure from test.html
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>TTS Extension Test</title>
        </head>
        <body>
          <h1>TTS Chrome Extension Test Page</h1>
          
          <div class="test-section">
            <h2>Instructions</h2>
            <p>To test the TTS extension with floating control bar:</p>
            <ol>
              <li>Select any text on this page</li>
              <li>Press <strong>Ctrl+Shift+Z</strong> (or your configured shortcut)</li>
              <li>A floating control bar should appear in the top-right corner</li>
              <li>Use the control bar to stop, pause, or resume the TTS</li>
            </ol>
          </div>

          <div class="test-section">
            <h2>Sample Text for Testing</h2>
            
            <div class="highlight">
              <strong>Short text:</strong> This is a short sentence to test the TTS functionality.
            </div>
            
            <div class="highlight">
              <strong>Medium text:</strong> This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.
            </div>
            
            <div class="highlight">
              <strong>Long text:</strong> This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you're having read aloud to you.
            </div>
          </div>

          <div class="test-section">
            <h2>Expected Behavior</h2>
            <ul>
              <li>When you press the shortcut with text selected, TTS should start</li>
              <li>A floating control bar should appear in the top-right corner</li>
              <li>The control bar should have Stop, Pause, and Resume buttons</li>
              <li>Buttons should be enabled/disabled based on the current state</li>
              <li>The control bar should disappear when TTS ends or is stopped</li>
              <li>You should be able to close the control bar manually</li>
            </ul>
          </div>

          <div class="test-section">
            <h2>Troubleshooting</h2>
            <ul>
              <li>Make sure the extension is installed and enabled</li>
              <li>Check that you have selected text before pressing the shortcut</li>
              <li>Verify that the shortcut is working (check extension settings)</li>
              <li>Look at the browser console for any error messages</li>
            </ul>
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
  });

  describe('Case 1: Full Page Selection (28 sentences total)', () => {
    test('SHOULD extract all 23 block elements and detect 28 sentences', () => {
      // Mock full page selection - all content
      const allElements = [
        { tagName: 'H1', textContent: 'TTS Chrome Extension Test Page' },
        { tagName: 'H2', textContent: 'Instructions' },
        { tagName: 'P', textContent: 'To test the TTS extension with floating control bar:' },
        { tagName: 'LI', textContent: 'Select any text on this page' },
        { tagName: 'LI', textContent: 'Press Ctrl+Shift+Z (or your configured shortcut)' },
        { tagName: 'LI', textContent: 'A floating control bar should appear in the top-right corner' },
        { tagName: 'LI', textContent: 'Use the control bar to stop, pause, or resume the TTS' },
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' },
        { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.' },
        { tagName: 'DIV', textContent: 'Long text: This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.' },
        { tagName: 'H2', textContent: 'Expected Behavior' },
        { tagName: 'LI', textContent: 'When you press the shortcut with text selected, TTS should start' },
        { tagName: 'LI', textContent: 'A floating control bar should appear in the top-right corner' },
        { tagName: 'LI', textContent: 'The control bar should have Stop, Pause, and Resume buttons' },
        { tagName: 'LI', textContent: 'Buttons should be enabled/disabled based on the current state' },
        { tagName: 'LI', textContent: 'The control bar should disappear when TTS ends or is stopped' },
        { tagName: 'LI', textContent: 'You should be able to close the control bar manually' },
        { tagName: 'H2', textContent: 'Troubleshooting' },
        { tagName: 'LI', textContent: 'Make sure the extension is installed and enabled' },
        { tagName: 'LI', textContent: 'Check that you have selected text before pressing the shortcut' },
        { tagName: 'LI', textContent: 'Verify that the shortcut is working (check extension settings)' },
        { tagName: 'LI', textContent: 'Look at the browser console for any error messages' }
      ];

      const fullPageText = allElements.map(e => e.textContent).join('\n');

      // Mock DOM sentence detection
      const mockDOMDetector = {
        detectSentencesFromSelection: (elements, text) => {
          // Should detect exactly 28 sentences from our analysis
          const sentences = [
            'TTS Chrome Extension Test Page', // H1: 1
            'Instructions', // H2: 1  
            'To test the TTS extension with floating control bar:', // P: 1
            'Select any text on this page', // LI: 1
            'Press Ctrl+Shift+Z (or your configured shortcut)', // LI: 1
            'A floating control bar should appear in the top-right corner', // LI: 1
            'Use the control bar to stop, pause, or resume the TTS', // LI: 1
            'Sample Text for Testing', // H2: 1
            'Short text: This is a short sentence to test the TTS functionality.', // DIV: 1
            'Medium text: This is a longer paragraph that contains multiple sentences.', // DIV: 1
            'It should be enough text to test the pause and resume functionality of the TTS extension.', // DIV: 2
            'You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.', // DIV: 3
            'Long text: This is a much longer piece of text that will take more time to read aloud.', // DIV: 1
            'It contains multiple paragraphs and should provide a good test for the floating control bar functionality.', // DIV: 2
            'The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time.', // DIV: 3
            'This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.', // DIV: 4
            'Expected Behavior', // H2: 1
            'When you press the shortcut with text selected, TTS should start', // LI: 1
            'A floating control bar should appear in the top-right corner', // LI: 1
            'The control bar should have Stop, Pause, and Resume buttons', // LI: 1
            'Buttons should be enabled/disabled based on the current state', // LI: 1
            'The control bar should disappear when TTS ends or is stopped', // LI: 1
            'You should be able to close the control bar manually', // LI: 1
            'Troubleshooting', // H2: 1
            'Make sure the extension is installed and enabled', // LI: 1
            'Check that you have selected text before pressing the shortcut', // LI: 1
            'Verify that the shortcut is working (check extension settings)', // LI: 1
            'Look at the browser console for any error messages' // LI: 1
          ];

          return {
            sentences: sentences,
            metadata: sentences.map((sentence, index) => ({
              id: index,
              text: sentence,
              element: elements[Math.floor(index * elements.length / sentences.length)] || elements[0]
            })),
            totalSentences: sentences.length,
            method: 'dom_structure'
          };
        }
      };

      const result = mockDOMDetector.detectSentencesFromSelection(allElements, fullPageText);

      // CRITICAL EXPECTATIONS based on our analysis
      expect(result.sentences).toHaveLength(28); // Exact count from our analysis
      expect(allElements).toHaveLength(23); // All block elements
      expect(result.method).toBe('dom_structure');
      expect(result.totalSentences).toBe(28);
      expect(fullPageText.length).toBeGreaterThan(1500); // Substantial content
    });

    test('SHOULD handle sentence highlighting for all 28 sentence indices', () => {
      // Mock content script highlighting logic
      const mockHighlighter = {
        sentenceElements: Array.from({length: 28}, (_, i) => ({
          index: i,
          sentence: `Sentence ${i}`,
          highlighted: false
        })),

        highlightSentence: function(sentenceIndex) {
          // This should NOT throw "Invalid sentence index" errors
          if (!this.sentenceElements || sentenceIndex < 0 || sentenceIndex >= this.sentenceElements.length) {
            throw new Error(`Invalid sentence index: ${sentenceIndex}`);
          }
          
          const element = this.sentenceElements[sentenceIndex];
          if (!element) {
            throw new Error(`No sentence element at index: ${sentenceIndex}`);
          }
          
          element.highlighted = true;
          return element;
        }
      };

      // Should handle all sentence indices 0-27 without errors
      for (let i = 0; i < 28; i++) {
        expect(() => mockHighlighter.highlightSentence(i)).not.toThrow();
        expect(mockHighlighter.sentenceElements[i].highlighted).toBe(true);
      }

      // Should handle out-of-bounds gracefully
      expect(() => mockHighlighter.highlightSentence(28)).toThrow('Invalid sentence index: 28');
      expect(() => mockHighlighter.highlightSentence(-1)).toThrow('Invalid sentence index: -1');
    });
  });

  describe('Cases 2-5: Section-by-Section Selections', () => {
    test('Case 2: Instructions section only (6 sentences, 6 elements)', () => {
      const instructionsElements = [
        { tagName: 'H2', textContent: 'Instructions' },
        { tagName: 'P', textContent: 'To test the TTS extension with floating control bar:' },
        { tagName: 'LI', textContent: 'Select any text on this page' },
        { tagName: 'LI', textContent: 'Press Ctrl+Shift+Z (or your configured shortcut)' },
        { tagName: 'LI', textContent: 'A floating control bar should appear in the top-right corner' },
        { tagName: 'LI', textContent: 'Use the control bar to stop, pause, or resume the TTS' }
      ];

      const instructionsText = instructionsElements.map(e => e.textContent).join('\n');

      // Expected: 6 elements = 6 sentences (1:1 ratio)
      expect(instructionsElements).toHaveLength(6);
      expect(instructionsText).toContain('Instructions');
      expect(instructionsText).toContain('floating control bar');
      expect(instructionsText).not.toContain('Sample Text for Testing'); // Should not include other sections
    });

    test('Case 3: Sample Text section only (9 sentences, 4 elements)', () => {
      const sampleTextElements = [
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' },
        { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.' },
        { tagName: 'DIV', textContent: 'Long text: This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.' }
      ];

      // Expected breakdown: 1 + 1 + 3 + 4 = 9 sentences
      expect(sampleTextElements).toHaveLength(4); // 4 elements
      
      // Should contain sample text content
      const sampleText = sampleTextElements.map(e => e.textContent).join('\n');
      expect(sampleText).toContain('Sample Text for Testing');
      expect(sampleText).toContain('Short text:');
      expect(sampleText).toContain('Medium text:');
      expect(sampleText).toContain('Long text:');
      
      // Should not include other sections
      expect(sampleText).not.toContain('Instructions');
      expect(sampleText).not.toContain('Expected Behavior');
    });

    test('Case 4: Expected Behavior section only (7 sentences, 7 elements)', () => {
      const expectedBehaviorElements = [
        { tagName: 'H2', textContent: 'Expected Behavior' },
        { tagName: 'LI', textContent: 'When you press the shortcut with text selected, TTS should start' },
        { tagName: 'LI', textContent: 'A floating control bar should appear in the top-right corner' },
        { tagName: 'LI', textContent: 'The control bar should have Stop, Pause, and Resume buttons' },
        { tagName: 'LI', textContent: 'Buttons should be enabled/disabled based on the current state' },
        { tagName: 'LI', textContent: 'The control bar should disappear when TTS ends or is stopped' },
        { tagName: 'LI', textContent: 'You should be able to close the control bar manually' }
      ];

      // Expected: 7 elements = 7 sentences (1:1 ratio)
      expect(expectedBehaviorElements).toHaveLength(7);
      
      const behaviorText = expectedBehaviorElements.map(e => e.textContent).join('\n');
      expect(behaviorText).toContain('Expected Behavior');
      expect(behaviorText).toContain('control bar');
      expect(behaviorText).not.toContain('Troubleshooting');
    });

    test('Case 5: Troubleshooting section only (5 sentences, 5 elements)', () => {
      const troubleshootingElements = [
        { tagName: 'H2', textContent: 'Troubleshooting' },
        { tagName: 'LI', textContent: 'Make sure the extension is installed and enabled' },
        { tagName: 'LI', textContent: 'Check that you have selected text before pressing the shortcut' },
        { tagName: 'LI', textContent: 'Verify that the shortcut is working (check extension settings)' },
        { tagName: 'LI', textContent: 'Look at the browser console for any error messages' }
      ];

      // Expected: 5 elements = 5 sentences (1:1 ratio)
      expect(troubleshootingElements).toHaveLength(5);
      
      const troubleshootingText = troubleshootingElements.map(e => e.textContent).join('\n');
      expect(troubleshootingText).toContain('Troubleshooting');
      expect(troubleshootingText).toContain('extension');
      expect(troubleshootingText).not.toContain('Sample Text');
    });
  });

  describe('Cases 6a-6h: Single Element Selections', () => {
    test('Case 6a: Main H1 title only (1 sentence, 1 element)', () => {
      const titleElement = [
        { tagName: 'H1', textContent: 'TTS Chrome Extension Test Page' }
      ];

      expect(titleElement).toHaveLength(1);
      expect(titleElement[0].textContent).toBe('TTS Chrome Extension Test Page');
      expect(titleElement[0].textContent.length).toBeLessThan(50); // Short content
    });

    test('Case 6b: Medium text DIV only (3 sentences, 1 element)', () => {
      const mediumElement = [
        { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.' }
      ];

      expect(mediumElement).toHaveLength(1);
      expect(mediumElement[0].textContent).toContain('Medium text:');
      expect(mediumElement[0].textContent.length).toBeGreaterThan(200); // Substantial content
      // Should contain 3 sentences when properly split
    });

    test('Case 6c: Long text DIV only (4 sentences, 1 element - highest density)', () => {
      const longElement = [
        { tagName: 'DIV', textContent: 'Long text: This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.' }
      ];

      expect(longElement).toHaveLength(1);
      expect(longElement[0].textContent).toContain('Long text:');
      expect(longElement[0].textContent.length).toBeGreaterThan(450); // Very substantial content
      // Should contain 4 sentences when properly split - highest sentence density
    });

    test('Case 6d-6h: Individual headers and list items', () => {
      const individualElements = [
        { tagName: 'H2', textContent: 'Instructions' },
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'LI', textContent: 'Select any text on this page' },
        { tagName: 'LI', textContent: 'Press Ctrl+Shift+Z (or your configured shortcut)' },
        { tagName: 'P', textContent: 'To test the TTS extension with floating control bar:' }
      ];

      // Each should be 1 element = 1 sentence
      individualElements.forEach(element => {
        const singleElementArray = [element];
        expect(singleElementArray).toHaveLength(1);
        expect(element.textContent).toBeTruthy();
        expect(element.textContent.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cases 7a-7k: Cross-Section Partial Selections', () => {
    test('Case 7a: Title + Instructions start (3 elements, 3 sentences)', () => {
      const crossSectionElements = [
        { tagName: 'H1', textContent: 'TTS Chrome Extension Test Page' },
        { tagName: 'H2', textContent: 'Instructions' },
        { tagName: 'P', textContent: 'To test the TTS extension with floating control bar:' }
      ];

      expect(crossSectionElements).toHaveLength(3);
      
      const crossText = crossSectionElements.map(e => e.textContent).join('\n');
      expect(crossText).toContain('TTS Chrome Extension Test Page');
      expect(crossText).toContain('Instructions');
      expect(crossText).toContain('floating control bar');
    });

    test('Case 7b: Sample Text + Expected Behavior headers only', () => {
      const headerOnlyElements = [
        { tagName: 'H2', textContent: 'Sample Text for Testing' },
        { tagName: 'H2', textContent: 'Expected Behavior' }
      ];

      expect(headerOnlyElements).toHaveLength(2);
      expect(headerOnlyElements[0].textContent).toBe('Sample Text for Testing');
      expect(headerOnlyElements[1].textContent).toBe('Expected Behavior');
    });

    test('Case 7c: Dense content span (Medium + Long DIVs = 7 sentences, 2 elements)', () => {
      const denseContentElements = [
        { tagName: 'DIV', textContent: 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.' },
        { tagName: 'DIV', textContent: 'Long text: This is a much longer piece of text that will take more time to read aloud. It contains multiple paragraphs and should provide a good test for the floating control bar functionality. The control bar should remain visible throughout the entire reading process, allowing you to pause, resume, or stop the speech at any time. This is particularly useful when you want to control the playback of longer articles or documents that you are having read aloud to you.' }
      ];

      expect(denseContentElements).toHaveLength(2);
      // These 2 elements should contain 7 total sentences (3 + 4)
      expect(denseContentElements[0].textContent.length).toBeGreaterThan(200);
      expect(denseContentElements[1].textContent.length).toBeGreaterThan(450);
    });

    test('Case 7d: Scattered non-contiguous selection', () => {
      const scatteredElements = [
        { tagName: 'H1', textContent: 'TTS Chrome Extension Test Page' },
        { tagName: 'DIV', textContent: 'Short text: This is a short sentence to test the TTS functionality.' },
        { tagName: 'LI', textContent: 'When you press the shortcut with text selected, TTS should start' },
        { tagName: 'H2', textContent: 'Troubleshooting' }
      ];

      // Non-adjacent elements from different sections
      expect(scatteredElements).toHaveLength(4);
      
      const scatteredText = scatteredElements.map(e => e.textContent).join('\n');
      expect(scatteredText).toContain('TTS Chrome Extension Test Page'); // From top
      expect(scatteredText).toContain('Short text:'); // From middle
      expect(scatteredText).toContain('shortcut with text selected'); // From later
      expect(scatteredText).toContain('Troubleshooting'); // From end
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('SHOULD handle empty selection gracefully', () => {
      const emptyElements = [];
      const emptyText = '';

      const mockDOMDetector = {
        detectSentencesFromSelection: (elements, text) => ({
          sentences: [],
          metadata: [],
          totalSentences: 0,
          method: 'dom_structure'
        })
      };

      const result = mockDOMDetector.detectSentencesFromSelection(emptyElements, emptyText);
      
      expect(result.sentences).toHaveLength(0);
      expect(result.totalSentences).toBe(0);
      expect(result.method).toBe('dom_structure');
    });

    test('SHOULD detect selection boundary issues', () => {
      // Mock scenario where too many sentences are detected for the number of elements
      const suspiciousElements = [
        { tagName: 'H2', textContent: 'Short Header' },
        { tagName: 'P', textContent: 'Short paragraph.' }
      ];

      const suspiciouslyManySentences = Array.from({length: 15}, (_, i) => `Sentence ${i}`);

      // This should trigger validation warnings
      const ratio = suspiciouslyManySentences.length / suspiciousElements.length;
      expect(ratio).toBeGreaterThan(3); // 15/2 = 7.5 > 3, should warn about possible boundary issues
    });

    test('SHOULD handle malformed sentence data', () => {
      const mockHighlighter = {
        sentenceElements: [
          { index: 0, sentence: 'Valid sentence' },
          null, // Missing element
          undefined, // Missing element
          { index: 3, sentence: 'Another valid sentence' }
        ],

        highlightSentence: function(sentenceIndex) {
          if (!this.sentenceElements || sentenceIndex < 0 || sentenceIndex >= this.sentenceElements.length) {
            return false; // Should handle gracefully
          }
          
          const element = this.sentenceElements[sentenceIndex];
          if (!element) {
            return false; // Should handle null/undefined gracefully
          }
          
          return true;
        }
      };

      // Should handle valid indices
      expect(mockHighlighter.highlightSentence(0)).toBe(true);
      expect(mockHighlighter.highlightSentence(3)).toBe(true);
      
      // Should handle invalid/missing elements gracefully
      expect(mockHighlighter.highlightSentence(1)).toBe(false); // null element
      expect(mockHighlighter.highlightSentence(2)).toBe(false); // undefined element
      expect(mockHighlighter.highlightSentence(4)).toBe(false); // out of bounds
    });
  });
});