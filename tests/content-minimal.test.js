// Minimal test to isolate memory issue
const { FloatingControlBar, TextHighlighter } = require('../extension/content.js');

// Test with incrementally complex scenarios
describe('Content Memory Debugging Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should import classes without memory issues', () => {
    expect(typeof FloatingControlBar).toBe('function');
    expect(typeof TextHighlighter).toBe('function');
  });

  test('should create single TextHighlighter instance', () => {
    const textHighlighter = new TextHighlighter();
    expect(textHighlighter).toBeDefined();
    expect(textHighlighter.highlightedElements).toEqual([]);
  });

  test('should create multiple TextHighlighter instances', () => {
    for (let i = 0; i < 10; i++) {
      const textHighlighter = new TextHighlighter();
      expect(textHighlighter.highlightedElements).toEqual([]);
    }
  });

  test('should create single FloatingControlBar instance', () => {
    const controlBar = new FloatingControlBar();
    expect(controlBar).toBeDefined();
    expect(controlBar.isVisible).toBe(false);
  });

  test('should create multiple FloatingControlBar instances', () => {
    for (let i = 0; i < 10; i++) {
      const controlBar = new FloatingControlBar();
      expect(controlBar.isVisible).toBe(false);
    }
  });
});