// Integration tests for SSML Builder with DOM-based sentence detection
const DOMSentenceDetector = require('../extension/utils/dom-sentence-detector.js');

// Import SSML Builder - need to mock the global environment first
beforeAll(() => {
  // Mock the SimpleSentenceDetector that SSML Builder uses
  global.SimpleSentenceDetector = class {
    constructor() {}
    getSentenceMetadata(text, language) {
      return {
        sentences: text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 0),
        metadata: [],
        totalSentences: 0,
        method: 'simple'
      };
    }
  };

  // Mock sentencex import
  global.sentencex = {
    segment: (text, lang) => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 0)
  };
  
  // Make DOMSentenceDetector globally available
  global.DOMSentenceDetector = DOMSentenceDetector;
  
  // Mock DOM APIs for DOMSentenceDetector
  global.document = {
    createTreeWalker: jest.fn((root, whatToShow, filter) => {
      const elements = [];
      
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
      
      let index = -1;
      return {
        nextNode: () => {
          index++;
          return index < elements.length ? elements[index] : null;
        }
      };
    }),
    createRange: jest.fn(() => ({
      selectNodeContents: jest.fn(),
      toString: jest.fn(() => 'mock range text')
    }))
  };

  global.NodeFilter = {
    SHOW_ELEMENT: 1,
    FILTER_ACCEPT: 1,
    FILTER_SKIP: 3
  };
});

// Now import SSML Builder
const SSMLBuilderPath = '../extension/utils/ssml-builder.js';
delete require.cache[require.resolve(SSMLBuilderPath)];
const SSMLBuilderModule = require(SSMLBuilderPath);

// Extract SSMLBuilder class (it might be in different formats)
const SSMLBuilder = SSMLBuilderModule.SSMLBuilder || SSMLBuilderModule.default || SSMLBuilderModule;

describe('SSML Builder DOM Integration', () => {
  let ssmlBuilder;

  beforeEach(() => {
    // Create new instance for each test
    if (typeof SSMLBuilder === 'function') {
      ssmlBuilder = new SSMLBuilder();
    } else {
      // If it's a static class, use it directly
      ssmlBuilder = SSMLBuilder;
    }
  });

  // Helper function to create mock DOM elements
  function createMockElement(tagName, textContent = '', children = []) {
    const element = {
      tagName: tagName.toUpperCase(),
      textContent: textContent,
      children: children,
      nodeType: 1
    };
    
    children.forEach(child => {
      child.parentNode = element;
    });
    
    return element;
  }

  describe('createSentenceSSML with DOM container', () => {
    test('should use DOM-based detection when container provided', async () => {
      // Create test DOM structure
      const h2 = createMockElement('H2', 'Test Heading');
      const p = createMockElement('P', 'Test paragraph.');
      const container = createMockElement('DIV', '', [h2, p]);

      // Call with DOM container
      const result = await ssmlBuilder.createSentenceSSML('fallback text', 'en', container);
      
      // Verify DOM-based detection was used
      expect(result.sentences).toHaveLength(2);
      expect(result.sentences[0]).toBe('Test Heading');
      expect(result.sentences[1]).toBe('Test paragraph.');
      expect(result.method).toBe('dom_structure');
      expect(result.highlightingMode).toBe('sentence');
      expect(result.ssml).toContain('<speak>');
      expect(result.ssml).toContain('<mark name="start"/>');
      expect(result.ssml).toContain('<mark name="s0"/>');
      expect(result.ssml).toContain('Test Heading');
      expect(result.ssml).toContain('Test paragraph.');
    });

    test('should fallback to text-based detection when no DOM container', async () => {
      const text = 'First sentence. Second sentence.';
      
      // Call without DOM container
      const result = await ssmlBuilder.createSentenceSSML(text, 'en');
      
      // Verify text-based detection was used
      expect(result.sentences).toHaveLength(2);
      expect(result.sentences[0]).toBe('First sentence.');
      expect(result.sentences[1]).toBe('Second sentence.');
      expect(result.ssml).toContain('First sentence.');
      expect(result.ssml).toContain('Second sentence.');
    });

    test('should handle mixed content structure correctly', async () => {
      // Create test case 1 structure
      const h2 = createMockElement('H2', 'Sample Text for Testing');
      const p1 = createMockElement('P', 'Short text: This is a short sentence to test the TTS functionality.');
      const p2 = createMockElement('P', 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
      const container = createMockElement('DIV', '', [h2, p1, p2]);

      const result = await ssmlBuilder.createSentenceSSML('fallback', 'en', container);
      
      // Should detect 5 sentences as per test case 1
      expect(result.sentences).toHaveLength(5);
      expect(result.sentences[0]).toBe('Sample Text for Testing');
      expect(result.sentences[1]).toBe('Short text: This is a short sentence to test the TTS functionality.');
      expect(result.sentences[2]).toBe('Medium text: This is a longer paragraph that contains multiple sentences.');
      expect(result.sentences[3]).toBe('It should be enough text to test the pause and resume functionality of the TTS extension.');
      expect(result.sentences[4]).toBe('You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
    });

    test('should handle instructions structure correctly', async () => {
      // Create test case 2 structure  
      const h2 = createMockElement('H2', 'Instructions');
      const p = createMockElement('P', 'To test the TTS extension with floating control bar:');
      const li1 = createMockElement('LI', 'Select any text on this page');
      const li2 = createMockElement('LI', 'Press Ctrl+Shift+Z (or your configured shortcut)');
      const li3 = createMockElement('LI', 'A floating control bar should appear in the top-right corner');
      const li4 = createMockElement('LI', 'Use the control bar to stop, pause, or resume the TTS');
      const ul = createMockElement('UL', '', [li1, li2, li3, li4]);
      const container = createMockElement('DIV', '', [h2, p, ul]);

      const result = await ssmlBuilder.createSentenceSSML('fallback', 'en', container);
      
      // Should detect 6 sentences as per test case 2
      expect(result.sentences).toHaveLength(6);
      expect(result.sentences[0]).toBe('Instructions');
      expect(result.sentences[1]).toBe('To test the TTS extension with floating control bar:');
      expect(result.sentences[2]).toBe('Select any text on this page');
      expect(result.sentences[3]).toBe('Press Ctrl+Shift+Z (or your configured shortcut)');
      expect(result.sentences[4]).toBe('A floating control bar should appear in the top-right corner');
      expect(result.sentences[5]).toBe('Use the control bar to stop, pause, or resume the TTS');
    });
  });

  describe('buildSSMLFromSentenceData', () => {
    test('should build valid SSML from sentence data', () => {
      const sentenceData = {
        sentences: ['First sentence', 'Second sentence'],
        metadata: [
          { id: 0, text: 'First sentence' },
          { id: 1, text: 'Second sentence' }
        ],
        totalSentences: 2,
        method: 'dom_structure'
      };

      const result = ssmlBuilder.buildSSMLFromSentenceData(sentenceData);
      
      expect(result.ssml).toContain('<speak>');
      expect(result.ssml).toContain('<mark name="start"/>');
      expect(result.ssml).toContain('<mark name="s0"/>');
      expect(result.ssml).toContain('First sentence');
      expect(result.ssml).toContain('<mark name="s1"/>');
      expect(result.ssml).toContain('Second sentence');
      expect(result.ssml).toContain('<mark name="end"/>');
      expect(result.ssml).toContain('</speak>');
      
      expect(result.sentences).toEqual(['First sentence', 'Second sentence']);
      expect(result.totalSentences).toBe(2);
      expect(result.highlightingMode).toBe('sentence');
    });
  });

  describe('Real-world Bug Reproduction', () => {
    test('should handle exact failing case from test.html', async () => {
      // Exact reproduction of the failing case: "Short text: This is a short sentence to test the TTS functionality."
      const container = createMockElement('DIV', 'Short text: This is a short sentence to test the TTS functionality.');
      const result = await ssmlBuilder.createSentenceSSML('fallback', 'en', container);
      
      expect(result.sentences).toHaveLength(1);
      expect(result.sentences[0]).toBe('Short text: This is a short sentence to test the TTS functionality.');
      expect(result.method).toBe('dom_structure');
      expect(result.ssml).toContain('Short text: This is a short sentence to test the TTS functionality.');
      expect(result.ssml).toContain('<mark name="s0"/>');
    });

    test('should handle mixed content with inline elements', async () => {
      // Mixed content with inline formatting like in test.html
      const strong = createMockElement('STRONG', 'Medium text:');
      const container = createMockElement('DIV', 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.', [strong]);
      
      const result = await ssmlBuilder.createSentenceSSML('fallback', 'en', container);
      
      expect(result.sentences).toHaveLength(3);
      expect(result.sentences[0]).toBe('Medium text: This is a longer paragraph that contains multiple sentences.');
      expect(result.sentences[1]).toBe('It should be enough text to test the pause and resume functionality of the TTS extension.');
      expect(result.sentences[2]).toBe('You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
      expect(result.method).toBe('dom_structure');
    });
  });
});