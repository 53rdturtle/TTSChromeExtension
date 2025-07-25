// Tests for the DOMSentenceDetector production module
const DOMSentenceDetector = require('../extension/utils/dom-sentence-detector.js');

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
});