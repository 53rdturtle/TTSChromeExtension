# Word Highlighting Implementation Plan

## Overview
Implement word-by-word highlighting during TTS playback using Chrome TTS API word boundary events.

## Architecture Changes Required
1. **Background Script**: Add word event handling and communicate word positions to content script
2. **Content Script**: Add text highlighting, DOM manipulation, and highlight management
3. **Storage**: Track original text, DOM nodes, and highlighting state
4. **Fallback**: Handle unsupported voices/platforms

## Detailed Task Breakdown

### Phase 1: Minimal Viable Product (Tasks 1-4)
**Goal**: Get basic text highlighting working end-to-end

#### Task 1: Complete Text Highlighting MVP
**Deliverable**: Whole selected text is highlighted during TTS playback
**Files**: `extension/background.js`, `extension/controlbar.js`
**Testable**: Select text, press Ctrl+Q, see entire selected text highlighted while being spoken
**Details**:
- Add TTS start/end event detection to background.js TTS speak function
- Create basic TextHighlighter class in content script
- Add CSS highlighting styles
- Implement simple text highlighting for entire selected text
- Add message communication between background and content script
- Handle highlight cleanup when TTS stops
- Test with simple paragraph text on basic websites

#### Task 2: Handle Complex DOM Structures
**Deliverable**: Text highlighting works across multiple DOM elements and complex HTML
**Files**: `extension/controlbar.js`
**Testable**: Text highlighting works on news articles, Wikipedia, and complex websites
**Details**:
- Improve text selection mapping for text spanning multiple elements
- Handle nested tags, links, and formatting within selected text
- Ensure highlights don't break existing page layout
- Test on complex websites with varied HTML structures

#### Task 3: Current Sentence Highlighting
**Deliverable**: Only the current spoken sentence is highlighted during TTS playback
**Files**: `extension/background.js`, `extension/controlbar.js`
**Testable**: Select multi-sentence text, press Ctrl+Q, see only current sentence highlighted as TTS progresses
**Details**:
- Implement sentence boundary detection in selected text
- Track current sentence position during TTS playback
- Add message communication for sentence highlighting updates
- Highlight only the active sentence, removing previous highlights
- Handle sentence boundaries across DOM elements
- Test with various sentence structures and punctuation

#### Task 4: Voice Compatibility and Error Handling
**Deliverable**: Highlighting works reliably with different voices and handles errors gracefully
**Files**: `extension/background.js`, `extension/controlbar.js`  
**Testable**: Highlighting works with different system voices or falls back gracefully
**Details**:
- Add voice compatibility detection for sentence events
- Implement fallback behavior for unsupported voices
- Add error handling for DOM manipulation failures
- Test with different TTS voices and edge cases

### Phase 2: Core Functionality (Tasks 5-7)
**Goal**: Working text highlighting with enhanced features

#### Task 5: Advanced Text Highlighting
**Deliverable**: Enhanced highlighting with better visual feedback
**Files**: `extension/background.js`, `extension/controlbar.js`
**Testable**: Text highlighting has improved styling and visual effects
**Details**:
- Add message type `highlightText` for start/end events
- Send messages from background TTS start/end events to active tab
- Handle message receiving in content script
- Test message flow with console logging
- Add enhanced CSS styling for highlights

#### Task 6: Improved DOM Text Highlighting
**Deliverable**: Better text highlighting across complex DOM structures
**Files**: `extension/controlbar.js`
**Testable**: Text highlighting works reliably on complex websites
**Details**:
- Implement robust text selection to DOM node conversion
- Create and insert highlight spans around selected text
- Handle text boundaries across multiple DOM elements
- Ensure proper highlight rendering and cleanup
- Test with various text selections and DOM structures

#### Task 7: Enhanced Highlight Management
**Deliverable**: Highlights are properly managed during TTS lifecycle
**Files**: `extension/controlbar.js`
**Testable**: Highlights appear/disappear correctly with TTS state changes
**Details**:
- Add highlight spans on TTS start events
- Remove all highlight spans on TTS stop/end/error events
- Restore original DOM structure
- Handle pause/resume states (keep highlights on pause)
- Test cleanup with stop button, natural speech end, and errors

### Phase 3: Enhancement (Tasks 8-10)
**Goal**: Improved user experience and reliability

#### Task 8: Voice Compatibility Detection
**Deliverable**: Extension only enables highlighting for compatible voices
**Files**: `extension/background.js`, `extension/popup.js`
**Testable**: Voice selection shows which voices support highlighting
**Details**:
- Filter voices that support word events in voice selection
- Add UI indicator for highlighting-compatible voices
- Gracefully disable highlighting for incompatible voices
- Test with different system voices and add fallbacks

#### Task 9: Scroll-to-Sentence Feature
**Deliverable**: Page scrolls to keep highlighted sentence visible
**Files**: `extension/controlbar.js`
**Testable**: Page auto-scrolls during long text highlighting
**Details**:
- Detect when highlighted sentence is outside viewport
- Smooth scroll to bring highlighted sentence into view
- Add user preference to enable/disable auto-scroll
- Test with long articles and different page layouts

#### Task 10: Error Handling and Fallbacks
**Deliverable**: Robust highlighting that handles edge cases
**Files**: `extension/background.js`, `extension/controlbar.js`
**Testable**: Highlighting works reliably across different websites and scenarios
**Details**:
- Handle cases where DOM changes during highlighting
- Fallback to sentence-level highlighting for unsupported voices
- Handle text in iframes, shadow DOM, and dynamic content
- Add error recovery for failed highlighting attempts
- Test on complex websites (SPAs, dynamic content, iframes)

### Phase 4: Polish (Tasks 11-12)
**Goal**: Production-ready feature

#### Task 11: User Preferences
**Deliverable**: User can customize highlighting appearance and behavior
**Files**: `extension/popup.js`, `extension/popup.html`
**Testable**: Settings panel allows highlighting customization
**Details**:
- Add highlighting color picker to popup
- Toggle for enabling/disabling highlighting
- Auto-scroll preference setting
- Highlight style options (underline, background, border)
- Store preferences in chrome.storage

#### Task 12: Testing and Documentation
**Deliverable**: Comprehensive tests and usage documentation
**Files**: `tests/`, `README.md`
**Testable**: All highlighting features pass automated tests
**Details**:
- Add unit tests for TextHighlighter class
- Integration tests for word event handling
- Cross-browser compatibility testing
- Performance testing with long texts
- Update README with highlighting feature documentation

## Testing Strategy
- **Unit Tests**: Individual functions and classes
- **Integration Tests**: Background ↔ Content script communication
- **Manual Tests**: Real-world usage on various websites
- **Performance Tests**: Memory usage and highlighting speed
- **Compatibility Tests**: Different voices, platforms, and browsers

## Success Criteria
1. Selected text highlights during TTS playback
2. Highlighting works on 90%+ of websites
3. No memory leaks or performance degradation
4. Graceful fallbacks for unsupported scenarios
5. User-friendly controls and preferences

## Risk Mitigation
- **Android limitation**: Implement sentence-level fallback
- **DOM complexity**: Extensive testing on varied websites
- **Performance**: Optimize highlighting algorithms and cleanup
- **Voice compatibility**: Clear UI indicators and automatic detection