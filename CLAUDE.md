# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension that provides text-to-speech functionality with a comprehensive testing suite. The extension includes a popup interface, floating control bar, and background service worker.

## Development Commands

### Testing
- `npm test` - Run all unit and integration tests
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run end-to-end tests using Puppeteer

### Installation
- `npm install` - Install all dependencies

## Architecture

### Core Components

1. **Background Service Worker** (`extension/background.js`)
   - `TTSService` class (lines 56-146): Handles TTS API calls, speech synthesis
   - `MessageHandler` class (lines 149-281): Routes messages between components
   - `getSelectedTextFromActiveTab()`: Extracts selected text from active tabs

2. **Popup Interface** (`extension/popup.js`)
   - `TTSController` class (lines 4-339): Manages popup UI, voice selection, rate control
   - Handles user input, voice persistence, and TTS controls

3. **Content Script** (`extension/controlbar.js`)
   - `FloatingControlBar` class (lines 4-357): Provides floating controls on web pages
   - Draggable interface with pause/play, stop, and speed controls

4. **Extension Configuration** (`extension/manifest.json`)
   - Manifest v3 with permissions for storage, activeTab, tts, scripting
   - Keyboard shortcut: Ctrl+Shift+Z to open popup
   - Content script injection on all URLs

### Message Passing Architecture

Components communicate via Chrome extension messaging:
- Popup ↔ Background: TTS commands, voice data, status updates
- Content Script ↔ Background: Control bar actions, speech state
- Background manages all TTS API interactions

### Testing Strategy

- **Unit Tests**: Individual class methods with mocked Chrome APIs
- **Integration Tests**: Component interaction workflows
- **E2E Tests**: Full browser automation with Puppeteer
- **Mocking**: Comprehensive Chrome API mocks in `tests/setup.js`

### Key Classes and Methods

- `TTSService.speak(text, options)`: Main TTS functionality
- `TTSController.populateVoices()`: Load and display available voices
- `FloatingControlBar.show()`: Display control bar on pages
- `MessageHandler.handleMessage()`: Route inter-component messages

### State Management

- Chrome storage API for voice preferences and settings
- Local state in each component for UI updates
- Background service worker maintains TTS state across tabs

## Testing Notes

- All Chrome APIs are mocked in tests
- Test files mirror the structure of source files
- Coverage target: 85%+ overall, 90%+ unit tests
- E2E tests can run in headless mode for CI/CD

## Git Workflow

**IMPORTANT**: Do not commit or push to origin unless explicitly instructed by the user. Only make code changes, run tests, and update documentation. Wait for explicit instructions before running git commands.

## Implementation Notes

**IMPORTANT**: Do not start implementation of new features until the design and plan are approved by the user. Wait for explicit approval before making code changes.

## Configurable Highlighting Implementation Plan

### Overview
Implement three configurable highlighting modes during TTS playback with individual toggle controls and style customization:
- **Full Selection**: Highlights entire selected text (✅ Already implemented)
- **Sentence Mode**: Highlights current sentence being spoken
- **Word Mode**: Highlights currently spoken word

Each highlighting mode can be:
- **Individually toggled** on/off
- **Styled independently** with custom colors, opacity, and effects
- **Combined together** for layered highlighting (e.g., word + sentence + full selection)

### Implementation Phases

#### Phase 1: Settings Infrastructure ✅ COMPLETED
**Goal**: Create foundation for configurable highlighting

**What we built:**
- Settings storage system with highlighting preferences
- Settings button in popup UI (gear icon next to existing controls)
- Settings panel within popup containing mode selector and style options
- Default configuration (Full Selection mode)

**Files modified:**
- `extension/popup.html` - Added settings button and panel
- `extension/popup.js` - Added settings UI logic
- `extension/background.js` - Added settings management

#### Phase 2: Enhanced Settings Infrastructure
**Goal**: Revamp settings for individual toggle controls and independent styling

**What we'll build:**
- **Individual Toggle Controls**: Each mode (Full/Sentence/Word) can be enabled/disabled independently
- **Independent Style Configuration**: Each mode has its own color, opacity, and style settings
- **Layered Highlighting Support**: Multiple modes can be active simultaneously
- **Enhanced Settings Schema**: Support for per-mode configuration
- **Improved Settings UI**: Expandable sections for each highlighting mode

**Files to modify:**
- `extension/background.js` - Update settings schema and storage
- `extension/popup.html` - Redesign settings panel with individual controls
- `extension/popup.js` - Add per-mode settings logic
- `extension/controlbar.js` - Prepare for layered highlighting

#### Phase 3: Voice Compatibility Detection
**Goal**: Detect which highlighting modes work with current voice

**What we'll build:**
- Voice capability detection system
- Compatibility indicators in settings panel
- Graceful fallback to supported modes
- Per-mode compatibility status

**Files to modify:**
- `extension/background.js` - Add voice analysis
- `extension/popup.js` - Add compatibility UI

#### Phase 4: Sentence Highlighting
**Goal**: Implement sentence-by-sentence highlighting

**What we'll build:**
- Sentence boundary detection
- Sentence event handling from TTS API
- Sentence-level DOM manipulation in TextHighlighter
- Independent sentence highlighting styling

**Files to modify:**
- `extension/controlbar.js` - Extend TextHighlighter class
- `extension/background.js` - Add sentence event handling

#### Phase 5: Word-by-Word Highlighting
**Goal**: Implement word-by-word highlighting

**What we'll build:**
- Word boundary detection
- Word event handling from TTS API
- Word-level DOM manipulation with transitions
- Independent word highlighting styling

**Files to modify:**
- `extension/controlbar.js` - Add word highlighting methods
- `extension/background.js` - Add word event handling

#### Phase 6: Advanced Features
**Goal**: Add polish and layered highlighting

**What we'll build:**
- Layered highlighting rendering (multiple modes simultaneously)
- Auto-scroll to keep highlights visible
- Smooth transitions and animations
- Advanced styling options per mode

**Files to modify:**
- `extension/controlbar.js` - Add layered highlighting and auto-scroll
- `extension/popup.html` - Add advanced style controls

### Settings UI Design

#### Main Popup (unchanged)
- Voice selection dropdown
- Text input area
- Speed slider
- Speak/Stop buttons
- **Settings button (⚙️ icon)**

#### Settings Panel (redesigned)
- **Header**: "Highlighting Settings" with close button
- **Full Selection Highlighting Section**:
  - Toggle switch to enable/disable
  - Color picker for background color
  - Opacity slider
  - Style options (border, underline, etc.)
- **Sentence Highlighting Section**:
  - Toggle switch to enable/disable
  - Color picker for background color
  - Opacity slider
  - Style options
  - Compatibility indicator
- **Word Highlighting Section**:
  - Toggle switch to enable/disable
  - Color picker for background color
  - Opacity slider
  - Style options
  - Compatibility indicator
- **Global Options**:
  - Auto-scroll toggle
  - Animation effects toggle
- **Close button**: Return to main interface

### Implementation Priority

#### High Priority (MVP)
1. ✅ Full Selection Highlighting (done)
2. ✅ Settings Infrastructure (done)
3. Enhanced Settings Infrastructure (individual toggles + independent styling)
4. Voice Compatibility Detection
5. Sentence Highlighting

#### Medium Priority
6. Word-by-Word Highlighting
7. Layered Highlighting Support

#### Low Priority (Polish)
8. Auto-scroll Feature
9. Advanced Animations and Effects

### Enhanced Settings Schema
```javascript
{
  fullSelection: {
    enabled: true,
    style: {
      backgroundColor: '#ffeb3b',
      textColor: '#000000',
      opacity: 0.8,
      borderStyle: 'none'
    }
  },
  sentence: {
    enabled: false,
    style: {
      backgroundColor: '#4caf50',
      textColor: '#ffffff',
      opacity: 0.7,
      borderStyle: 'solid'
    }
  },
  word: {
    enabled: false,
    style: {
      backgroundColor: '#2196f3',
      textColor: '#ffffff',
      opacity: 0.9,
      borderStyle: 'dashed'
    }
  },
  global: {
    autoScroll: true,
    animationEffects: true
  }
}
```

### Success Criteria
- Settings accessible via button in popup
- Each highlighting mode can be toggled independently
- Each mode has its own style configuration
- Multiple modes can work simultaneously (layered highlighting)
- Voice compatibility properly detected per mode
- Settings persist across sessions
- Backwards compatibility maintained