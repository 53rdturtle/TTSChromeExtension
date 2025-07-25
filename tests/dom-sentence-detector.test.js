// Tests for the DOMSentenceDetector production module
const DOMSentenceDetector = require('../extension/utils/dom-sentence-detector.js');

// Import SimpleSentenceDetector to make sentencex available
const SimpleSentenceDetector = require('../extension/utils/simple-sentence-detector.js');

// Make SimpleSentenceDetector globally available for DOM detector
global.SimpleSentenceDetector = SimpleSentenceDetector;

describe('DOMSentenceDetector Module', () => {
  let detector;

  beforeEach(() => {
    detector = new DOMSentenceDetector();
    
    // Mock document.createTreeWalker for production module
    global.document.createTreeWalker = jest.fn((root, whatToShow, filter) => {
      const elements = [];
      
      // Recursively collect elements
      function collect(element) {
        if (element.children) {
          element.children.forEach(child => {
            if (filter.acceptNode(child) === NodeFilter.FILTER_ACCEPT) {
              elements.push(child);
            }
            collect(child);
          });
        }
      }
      
      collect(root);
      
      // Mock TreeWalker
      let index = -1;
      return {
        nextNode: () => {
          index++;
          return index < elements.length ? elements[index] : null;
        }
      };
    });

    // Mock document.createRange
    global.document.createRange = jest.fn(() => ({
      selectNodeContents: jest.fn(),
      toString: jest.fn(() => 'mock range text')
    }));

    // Mock NodeFilter constants
    global.NodeFilter = {
      SHOW_ELEMENT: 1,
      FILTER_ACCEPT: 1,
      FILTER_SKIP: 3
    };
  });

  // Helper function to create mock DOM elements
  function createMockElement(tagName, textContent = '', children = []) {
    const element = {
      tagName: tagName.toUpperCase(),
      textContent: textContent,
      children: children,
      nodeType: 1, // Element node
    };
    
    children.forEach(child => {
      child.parentNode = element;
    });
    
    return element;
  }

  describe('detectSentencesFromDOM', () => {
    test('should detect sentences from mixed content structure', () => {
      const h2 = createMockElement('H2', 'Sample Text for Testing');
      const p1 = createMockElement('P', 'Short text: This is a short sentence to test the TTS functionality.');
      const p2 = createMockElement('P', 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
      
      const container = createMockElement('DIV', '', [h2, p1, p2]);
      
      const sentences = detector.detectSentencesFromDOM(container);
      
      expect(sentences).toHaveLength(5);
      expect(sentences[0].text).toBe('Sample Text for Testing');
      expect(sentences[1].text).toBe('Short text: This is a short sentence to test the TTS functionality.');
      expect(sentences[2].text).toBe('Medium text: This is a longer paragraph that contains multiple sentences.');
      expect(sentences[3].text).toBe('It should be enough text to test the pause and resume functionality of the TTS extension.');
      expect(sentences[4].text).toBe('You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
    });

    test('should detect sentences from instructions structure', () => {
      const h2 = createMockElement('H2', 'Instructions');
      const p = createMockElement('P', 'To test the TTS extension with floating control bar:');
      const li1 = createMockElement('LI', 'Select any text on this page');
      const li2 = createMockElement('LI', 'Press Ctrl+Shift+Z (or your configured shortcut)');
      const li3 = createMockElement('LI', 'A floating control bar should appear in the top-right corner');
      const li4 = createMockElement('LI', 'Use the control bar to stop, pause, or resume the TTS');
      const ul = createMockElement('UL', '', [li1, li2, li3, li4]);
      
      const container = createMockElement('DIV', '', [h2, p, ul]);
      
      const sentences = detector.detectSentencesFromDOM(container);
      
      expect(sentences).toHaveLength(6);
      expect(sentences[0].text).toBe('Instructions');
      expect(sentences[1].text).toBe('To test the TTS extension with floating control bar:');
      expect(sentences[2].text).toBe('Select any text on this page');
      expect(sentences[3].text).toBe('Press Ctrl+Shift+Z (or your configured shortcut)');
      expect(sentences[4].text).toBe('A floating control bar should appear in the top-right corner');
      expect(sentences[5].text).toBe('Use the control bar to stop, pause, or resume the TTS');
    });

    test('should skip empty elements', () => {
      const h1 = createMockElement('H1', 'Valid heading');
      const p1 = createMockElement('P', '');
      const p2 = createMockElement('P', '   ');
      const p3 = createMockElement('P', 'Valid paragraph');
      const container = createMockElement('DIV', '', [h1, p1, p2, p3]);

      const sentences = detector.detectSentencesFromDOM(container);
      
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Valid heading');
      expect(sentences[1].text).toBe('Valid paragraph');
    });
  });

  describe('getBlockElementsWithTreeWalker', () => {
    test('should detect block elements only', () => {
      const h1 = createMockElement('H1', 'Heading 1');
      const p = createMockElement('P', 'Paragraph');
      const div = createMockElement('DIV', 'Division');
      const li = createMockElement('LI', 'List item');
      const container = createMockElement('DIV', '', [h1, p, div, li]);

      const blockElements = detector.getBlockElementsWithTreeWalker(container);
      
      expect(blockElements).toHaveLength(4);
      expect(blockElements[0].tagName).toBe('H1');
      expect(blockElements[1].tagName).toBe('P');
      expect(blockElements[2].tagName).toBe('DIV');
      expect(blockElements[3].tagName).toBe('LI');
    });
  });

  describe('createSentenceData', () => {
    test('should create SSML-compatible sentence data', () => {
      const h2 = createMockElement('H2', 'Test Heading');
      const p = createMockElement('P', 'Test paragraph.');
      const container = createMockElement('DIV', '', [h2, p]);

      const sentenceData = detector.createSentenceData(container);
      
      expect(sentenceData.sentences).toHaveLength(2);
      expect(sentenceData.sentences[0]).toBe('Test Heading');
      expect(sentenceData.sentences[1]).toBe('Test paragraph.');
      expect(sentenceData.totalSentences).toBe(2);
      expect(sentenceData.method).toBe('dom_structure');
      expect(sentenceData.highlightingMode).toBe('sentence');
      
      // Check metadata
      expect(sentenceData.metadata).toHaveLength(2);
      expect(sentenceData.metadata[0].text).toBe('Test Heading');
      expect(sentenceData.metadata[1].text).toBe('Test paragraph.');
    });
  });

  describe('calculateTextPosition', () => {
    test('should calculate correct text positions', () => {
      const sentences = [
        { text: 'First sentence.' },
        { text: 'Second sentence.' },
        { text: 'Third sentence.' }
      ];

      expect(detector.calculateTextPosition(sentences, 0)).toBe(0);
      expect(detector.calculateTextPosition(sentences, 1)).toBe(16); // "First sentence." (15) + space (1)
      expect(detector.calculateTextPosition(sentences, 2)).toBe(33); // Previous + "Second sentence." (16) + space (1)
    });
  });

  describe('Sentencex Integration - Critical Bug Fix', () => {
    
    // CRITICAL BUG: The exact failing case from test.html
    test('should detect sentence from inline elements without period-space', () => {
      const div = createMockElement('DIV', 'Short text: This is a short sentence to test the TTS functionality.');
      const sentences = detector.detectSentencesFromDOM(div);
      
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('Short text: This is a short sentence to test the TTS functionality.');
    });

    test('should handle sentences with abbreviations', () => {
      const p = createMockElement('P', 'Dr. Smith visited the U.S. office. He met with Ms. Johnson.');
      const sentences = detector.detectSentencesFromDOM(p);
      
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Dr. Smith visited the U.S. office.');
      expect(sentences[1].text).toBe('He met with Ms. Johnson.');
    });

    test('should handle sentences with numbers and decimals', () => {
      const p = createMockElement('P', 'The price is $19.99 per item. The total comes to $59.97 for three items.');
      const sentences = detector.detectSentencesFromDOM(p);
      
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('The price is $19.99 per item.');
      expect(sentences[1].text).toBe('The total comes to $59.97 for three items.');
    });

    test('should handle questions and exclamations', () => {
      const p = createMockElement('P', 'How are you today? I am doing great! Thanks for asking.');
      const sentences = detector.detectSentencesFromDOM(p);
      
      expect(sentences).toHaveLength(3);
      expect(sentences[0].text).toBe('How are you today?');
      expect(sentences[1].text).toBe('I am doing great!');
      expect(sentences[2].text).toBe('Thanks for asking.');
    });
  });

  describe('Mixed Content Comprehensive Tests', () => {
    
    test('should handle mixed content with inline formatting', () => {
      // <div><strong>Short text:</strong> This is a short sentence to test the TTS functionality.</div>
      const strong = createMockElement('STRONG', 'Short text:');
      const div = createMockElement('DIV', 'Short text: This is a short sentence to test the TTS functionality.', [strong]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('Short text: This is a short sentence to test the TTS functionality.');
    });

    test('should handle complex mixed content from test.html structure', () => {
      // Simulate: <div class="highlight"><strong>Medium text:</strong> This is a longer paragraph...</div>
      const strong = createMockElement('STRONG', 'Medium text:');
      const div = createMockElement('DIV', 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.', [strong]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(3);
      expect(sentences[0].text).toBe('Medium text: This is a longer paragraph that contains multiple sentences.');
      expect(sentences[1].text).toBe('It should be enough text to test the pause and resume functionality of the TTS extension.');
      expect(sentences[2].text).toBe('You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
    });

    test('should handle nested mixed content with multiple inline elements', () => {
      // <p>This is <em>very <strong>important</strong> information</em> to remember. Please take note.</p>
      const strong = createMockElement('STRONG', 'important');
      const em = createMockElement('EM', 'very important information', [strong]);
      const p = createMockElement('P', 'This is very important information to remember. Please take note.', [em]);
      
      const sentences = detector.detectSentencesFromDOM(p);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is very important information to remember.');
      expect(sentences[1].text).toBe('Please take note.');
    });

    test('should handle mixed content with links and formatting', () => {
      // <div>Visit <a href="#">our website</a> for more <strong>important</strong> details.</div>
      const a = createMockElement('A', 'our website');
      const strong = createMockElement('STRONG', 'important');
      const div = createMockElement('DIV', 'Visit our website for more important details.', [a, strong]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('Visit our website for more important details.');
    });

    test('should handle mixed content with code and technical elements', () => {
      // <p>Use the <code>console.log()</code> function. It helps with debugging.</p>
      const code = createMockElement('CODE', 'console.log()');
      const p = createMockElement('P', 'Use the console.log() function. It helps with debugging.', [code]);
      
      const sentences = detector.detectSentencesFromDOM(p);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Use the console.log() function.');
      expect(sentences[1].text).toBe('It helps with debugging.');
    });

    test('should handle mixed content with quotes and spans', () => {
      // <div>He said <span class="quote">"Hello world"</span>. Then he left quietly.</div>
      const span = createMockElement('SPAN', '"Hello world"');
      const div = createMockElement('DIV', 'He said "Hello world". Then he left quietly.', [span]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('He said "Hello world".');
      expect(sentences[1].text).toBe('Then he left quietly.');
    });
  });

  describe('Complex Mixed Content Scenarios', () => {
    
    test('should handle multiple block elements with mixed inline content', () => {
      // Complex structure like a real webpage
      const titleStrong = createMockElement('STRONG', 'Important:');
      const h2 = createMockElement('H2', 'Important: Please Read This', [titleStrong]);
      
      const linkSpan = createMockElement('SPAN', 'this link');
      const p1 = createMockElement('P', 'Click this link for more information. It contains valuable resources.', [linkSpan]);
      
      const codeElem = createMockElement('CODE', 'npm install');
      const emphasisElem = createMockElement('EM', 'very important');
      const p2 = createMockElement('P', 'Run npm install command carefully. This step is very important for setup.', [codeElem, emphasisElem]);
      
      const container = createMockElement('DIV', '', [h2, p1, p2]);
      
      const sentences = detector.detectSentencesFromDOM(container);
      expect(sentences).toHaveLength(5);
      expect(sentences[0].text).toBe('Important: Please Read This');
      expect(sentences[1].text).toBe('Click this link for more information.');
      expect(sentences[2].text).toBe('It contains valuable resources.');
      expect(sentences[3].text).toBe('Run npm install command carefully.');
      expect(sentences[4].text).toBe('This step is very important for setup.');
    });

    test('should handle mixed content with special characters and formatting', () => {
      // Technical content with symbols
      const code1 = createMockElement('CODE', 'const x = 5;');
      const code2 = createMockElement('CODE', 'console.log(x);');
      const pre = createMockElement('PRE', 'const x = 5; console.log(x); // Output: 5', [code1, code2]);
      
      const sentences = detector.detectSentencesFromDOM(pre);
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('const x = 5; console.log(x); // Output: 5');
    });

    test('should handle deeply nested mixed content', () => {
      // <div><p>This is <strong>very <em>deeply <span>nested</span> content</em> text</strong>. Amazing stuff!</p></div>
      const span = createMockElement('SPAN', 'nested');
      const em = createMockElement('EM', 'deeply nested content', [span]);
      const strong = createMockElement('STRONG', 'very deeply nested content text', [em]);
      const p = createMockElement('P', 'This is very deeply nested content text. Amazing stuff!', [strong]);
      const div = createMockElement('DIV', '', [p]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is very deeply nested content text.');
      expect(sentences[1].text).toBe('Amazing stuff!');
    });
  });

  describe('Edge Cases in Mixed Content', () => {
    
    test('should handle mixed content with only inline elements (no block)', () => {
      // Selection spans only inline elements within a container
      const strong = createMockElement('STRONG', 'Important');
      const em = createMockElement('EM', 'note');
      const span = createMockElement('SPAN', 'Important note: Please read this carefully!', [strong, em]);
      
      const sentences = detector.detectSentencesFromDOM(span);
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('Important note: Please read this carefully!');
    });

    test('should handle mixed content with empty inline elements', () => {
      // Some inline elements might be empty or whitespace
      const emptyStrong = createMockElement('STRONG', '');
      const validEm = createMockElement('EM', 'important');
      const p = createMockElement('P', 'This is important information. Please remember it.', [emptyStrong, validEm]);
      
      const sentences = detector.detectSentencesFromDOM(p);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is important information.');
      expect(sentences[1].text).toBe('Please remember it.');
    });

    test('should handle mixed content with line breaks and whitespace', () => {
      // Real HTML often has whitespace and line breaks
      const strong = createMockElement('STRONG', 'Note:');
      const div = createMockElement('DIV', '  Note:   This is a   sentence with   extra spacing.  ', [strong]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('Note: This is a sentence with extra spacing.');
    });
  });

  describe('Mixed Content with Sentencex Edge Cases', () => {
    
    test('should handle mixed content with abbreviations', () => {
      const abbr = createMockElement('ABBR', 'Dr.');
      const p = createMockElement('P', 'Dr. Smith is here. He will see you now.', [abbr]);
      
      const sentences = detector.detectSentencesFromDOM(p);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Dr. Smith is here.');
      expect(sentences[1].text).toBe('He will see you now.');
    });

    test('should handle mixed content with numbers and currencies', () => {
      const strong = createMockElement('STRONG', '$19.99');
      const div = createMockElement('DIV', 'The price is $19.99 each. Buy now for savings!', [strong]);
      
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('The price is $19.99 each.');
      expect(sentences[1].text).toBe('Buy now for savings!');
    });

    test('should handle mixed content with questions and exclamations', () => {
      const em = createMockElement('EM', 'really');
      const p = createMockElement('P', 'Are you really sure? Yes, I am! Great choice.', [em]);
      
      const sentences = detector.detectSentencesFromDOM(p);
      expect(sentences).toHaveLength(3);
      expect(sentences[0].text).toBe('Are you really sure?');
      expect(sentences[1].text).toBe('Yes, I am!');
      expect(sentences[2].text).toBe('Great choice.');
    });
  });

  describe('Fallback and Error Handling', () => {
    
    test('should handle empty container gracefully', () => {
      const div = createMockElement('DIV', '');
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(0);
    });

    test('should handle whitespace-only container', () => {
      const div = createMockElement('DIV', '   \n\t   ');
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(0);
    });

    test('should handle container with only punctuation', () => {
      const div = createMockElement('DIV', '...');
      const sentences = detector.detectSentencesFromDOM(div);
      expect(sentences).toHaveLength(0);
    });
  });
});