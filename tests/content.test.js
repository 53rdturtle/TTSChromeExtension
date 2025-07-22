// Memory-efficient tests for content.js - FloatingControlBar and TextHighlighter classes
const { FloatingControlBar, TextHighlighter } = require('../extension/content.js');

describe('Content Script Classes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (global.gc) global.gc();
  });

  afterEach(() => {
    if (global.gc) global.gc();
  });

  test('should import classes successfully', () => {
    expect(typeof FloatingControlBar).toBe('function');
    expect(typeof TextHighlighter).toBe('function');
  });

  test('should create TextHighlighter with correct initial state', () => {
    const highlighter = new TextHighlighter();
    expect(highlighter).toBeDefined();
    expect(highlighter.highlightedElements).toEqual([]);
    expect(highlighter.originalSelection).toBeNull();
  });

  test('should create FloatingControlBar with correct initial state', () => {
    const controlBar = new FloatingControlBar();
    expect(controlBar).toBeDefined();
    expect(controlBar.isVisible).toBe(false);
    expect(controlBar.isDragging).toBe(false);
    expect(typeof controlBar.dragOffset).toBe('object');
  });

  test('should handle TextHighlighter clearHighlights without errors', () => {
    const highlighter = new TextHighlighter();
    expect(() => highlighter.clearHighlights()).not.toThrow();
    expect(highlighter.highlightedElements).toEqual([]);
  });

  test('should handle TextHighlighter highlightText with no selection', () => {
    const highlighter = new TextHighlighter();
    global.window.getSelection = jest.fn(() => ({ rangeCount: 0 }));
    
    expect(() => highlighter.highlightText('test')).not.toThrow();
    expect(highlighter.highlightedElements).toEqual([]);
  });

  test('should handle FloatingControlBar show/hide state changes', () => {
    jest.useFakeTimers();
    const controlBar = new FloatingControlBar();
    
    // Test show
    expect(controlBar.isVisible).toBe(false);
    controlBar.show();
    expect(controlBar.isVisible).toBe(true);
    
    // Test hide (requires timer advancement due to animation)
    controlBar.hide();
    jest.advanceTimersByTime(300); // Animation timeout
    expect(controlBar.isVisible).toBe(false);
    
    jest.useRealTimers();
  });
});

describe('Chrome Extension Message Handler', () => {
  test('should have chrome.runtime.onMessage available', () => {
    expect(chrome.runtime.onMessage).toBeDefined();
    expect(chrome.runtime.onMessage.addListener).toBeDefined();
    expect(typeof chrome.runtime.onMessage.addListener).toBe('function');
  });
});