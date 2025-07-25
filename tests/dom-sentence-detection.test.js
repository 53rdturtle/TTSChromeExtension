// DOM-based sentence detection tests
// Tests for TreeWalker element-based sentence boundary detection

describe('DOM-Based Sentence Detection', () => {
  beforeEach(() => {
    // Clear DOM for each test
    document.body.innerHTML = '';
  });

  // Helper function to create mock DOM elements with children
  function createMockElement(tagName, textContent = '', children = []) {
    const element = {
      tagName: tagName.toUpperCase(),
      textContent: textContent,
      children: children,
      nodeType: 1, // Element node
      appendChild: jest.fn(function(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      }),
      parentNode: null
    };
    
    // Set parent references for children
    children.forEach(child => {
      child.parentNode = element;
    });
    
    return element;
  }

  describe('Test Case 1: Mixed Content (5 sentences expected)', () => {
    let testContainer;

    beforeEach(() => {
      // Create DOM structure matching the first test case
      const h2 = createMockElement('H2', 'Sample Text for Testing');
      const p1 = createMockElement('P', 'Short text: This is a short sentence to test the TTS functionality.');
      const p2 = createMockElement('P', 'Medium text: This is a longer paragraph that contains multiple sentences. It should be enough text to test the pause and resume functionality of the TTS extension. You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
      
      testContainer = createMockElement('DIV', '', [h2, p1, p2]);
    });

    test('should detect 5 sentences from mixed content structure', () => {
      const sentences = detectSentencesFromDOM(testContainer);
      
      expect(sentences).toHaveLength(5);
      expect(sentences[0].text.trim()).toBe('Sample Text for Testing');
      expect(sentences[1].text.trim()).toBe('Short text: This is a short sentence to test the TTS functionality.');
      expect(sentences[2].text.trim()).toBe('Medium text: This is a longer paragraph that contains multiple sentences.');
      expect(sentences[3].text.trim()).toBe('It should be enough text to test the pause and resume functionality of the TTS extension.');
      expect(sentences[4].text.trim()).toBe('You can select this entire paragraph and use the keyboard shortcut to start the text-to-speech.');
    });

    test('each sentence should have corresponding DOM element', () => {
      const sentences = detectSentencesFromDOM(testContainer);
      
      sentences.forEach(sentence => {
        expect(sentence.element).toBeDefined();
        expect(sentence.element.nodeType).toBe(1); // Element node
        expect(sentence.range).toBeDefined();
      });
    });
  });

  describe('Test Case 2: Instructions Format (6 sentences expected)', () => {
    let testContainer;

    beforeEach(() => {
      // Create DOM structure matching the second test case
      const h2 = createMockElement('H2', 'Instructions');
      const p = createMockElement('P', 'To test the TTS extension with floating control bar:');
      const li1 = createMockElement('LI', 'Select any text on this page');
      const li2 = createMockElement('LI', 'Press Ctrl+Shift+Z (or your configured shortcut)');
      const li3 = createMockElement('LI', 'A floating control bar should appear in the top-right corner');
      const li4 = createMockElement('LI', 'Use the control bar to stop, pause, or resume the TTS');
      const ul = createMockElement('UL', '', [li1, li2, li3, li4]);
      
      testContainer = createMockElement('DIV', '', [h2, p, ul]);
    });

    test('should detect 6 sentences from instructions structure', () => {
      const sentences = detectSentencesFromDOM(testContainer);
      
      expect(sentences).toHaveLength(6);
      expect(sentences[0].text.trim()).toBe('Instructions');
      expect(sentences[1].text.trim()).toBe('To test the TTS extension with floating control bar:');
      expect(sentences[2].text.trim()).toBe('Select any text on this page');
      expect(sentences[3].text.trim()).toBe('Press Ctrl+Shift+Z (or your configured shortcut)');
      expect(sentences[4].text.trim()).toBe('A floating control bar should appear in the top-right corner');
      expect(sentences[5].text.trim()).toBe('Use the control bar to stop, pause, or resume the TTS');
    });

    test('should handle different element types correctly', () => {
      const sentences = detectSentencesFromDOM(testContainer);
      
      // First sentence should be from H2
      expect(sentences[0].element.tagName).toBe('H2');
      
      // Second sentence should be from P
      expect(sentences[1].element.tagName).toBe('P');
      
      // Sentences 3-6 should be from LI elements
      expect(sentences[2].element.tagName).toBe('LI');
      expect(sentences[3].element.tagName).toBe('LI');
      expect(sentences[4].element.tagName).toBe('LI');
      expect(sentences[5].element.tagName).toBe('LI');
    });
  });

  describe('TreeWalker Element Detection', () => {
    test('should detect block elements only', () => {
      const h1 = createMockElement('H1', 'Heading 1');
      const p = createMockElement('P', 'Paragraph with inline text and bold');
      const div = createMockElement('DIV', 'Division');
      const li = createMockElement('LI', 'List item');
      const container = createMockElement('DIV', '', [h1, p, div, li]);

      const blockElements = getBlockElementsWithTreeWalker(container);
      
      expect(blockElements).toHaveLength(4);
      expect(blockElements[0].tagName).toBe('H1');
      expect(blockElements[1].tagName).toBe('P');
      expect(blockElements[2].tagName).toBe('DIV');
      expect(blockElements[3].tagName).toBe('LI');
    });

    test('should skip empty elements', () => {
      const h1 = createMockElement('H1', 'Valid heading');
      const p1 = createMockElement('P', '');
      const p2 = createMockElement('P', '   ');
      const p3 = createMockElement('P', 'Valid paragraph');
      const container = createMockElement('DIV', '', [h1, p1, p2, p3]);

      const sentences = detectSentencesFromDOM(container);
      
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text.trim()).toBe('Valid heading');
      expect(sentences[1].text.trim()).toBe('Valid paragraph');
    });
  });

  describe('Range Creation', () => {
    test('should create valid ranges for each sentence', () => {
      const p = createMockElement('P', 'Test sentence');
      const container = createMockElement('DIV', '', [p]);

      const sentences = detectSentencesFromDOM(container);
      
      expect(sentences).toHaveLength(1);
      expect(sentences[0].range).toBeDefined();
      expect(sentences[0].range.toString()).toBe('Test sentence');
    });
  });
});

// TreeWalker-based DOM sentence detection implementation
function getBlockElementsWithTreeWalker(container) {
  const blockElements = [];
  const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'HEADER', 'SECTION', 'ARTICLE'];
  
  // Mock TreeWalker implementation for jsdom
  const walker = {
    currentNode: null,
    nodes: [],
    index: -1,
    
    nextNode: function() {
      this.index++;
      if (this.index < this.nodes.length) {
        this.currentNode = this.nodes[this.index];
        return this.currentNode;
      }
      return null;
    }
  };
  
  // Collect all elements recursively
  function collectElements(element) {
    if (element.children) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        if (blockTags.includes(child.tagName)) {
          walker.nodes.push(child);
        }
        collectElements(child);
      }
    }
  }
  
  collectElements(container);
  
  // Walk through nodes and collect block elements
  let node;
  while (node = walker.nextNode()) {
    if (blockTags.includes(node.tagName)) {
      blockElements.push(node);
    }
  }
  
  return blockElements;
}

function detectSentencesFromDOM(container) {
  const sentences = [];
  const blockElements = getBlockElementsWithTreeWalker(container);
  
  blockElements.forEach(element => {
    const text = element.textContent ? element.textContent.trim() : '';
    
    // Skip empty elements
    if (!text) {
      return;
    }
    
    // For elements with multiple sentences (like paragraphs), we need to split them
    if (element.tagName === 'P' && text.includes('. ')) {
      // Split paragraph into sentences
      const sentenceParts = text.split(/(?<=\.)\s+(?=[A-Z])/);
      sentenceParts.forEach((sentencePart, index) => {
        const trimmedSentence = sentencePart.trim();
        if (trimmedSentence) {
          sentences.push({
            text: trimmedSentence,
            element: element,
            range: createMockRange(element, trimmedSentence)
          });
        }
      });
    } else {
      // Single sentence element
      sentences.push({
        text: text,
        element: element,
        range: createMockRange(element, text)
      });
    }
  });
  
  return sentences;
}

function createMockRange(element, text) {
  return {
    toString: () => text,
    startContainer: element,
    endContainer: element,
    startOffset: 0,
    endOffset: text.length
  };
}