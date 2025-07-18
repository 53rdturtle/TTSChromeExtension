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
Implement three configurable highlighting modes during TTS playback:
- **Full Selection**: Highlights entire selected text (✅ Already implemented)
- **Sentence Mode**: Highlights current sentence being spoken
- **Word Mode**: Highlights currently spoken word

### Implementation Phases

#### Phase 1: Settings Infrastructure
**Goal**: Create foundation for configurable highlighting

**What we'll build:**
- Settings storage system with highlighting preferences
- Settings button in popup UI (gear icon next to existing controls)
- Settings panel within popup containing mode selector and style options
- Default configuration (Full Selection mode)

**Files to modify:**
- `extension/popup.html` - Add settings button and panel
- `extension/popup.js` - Add settings UI logic
- `extension/background.js` - Add settings management

#### Phase 2: Voice Compatibility Detection
**Goal**: Detect which highlighting modes work with current voice

**What we'll build:**
- Voice capability detection system
- Compatibility indicators in settings panel
- Graceful fallback to supported modes

**Files to modify:**
- `extension/background.js` - Add voice analysis
- `extension/popup.js` - Add compatibility UI

#### Phase 3: Sentence Highlighting
**Goal**: Implement sentence-by-sentence highlighting

**What we'll build:**
- Sentence boundary detection
- Sentence event handling from TTS API
- Sentence-level DOM manipulation in TextHighlighter

**Files to modify:**
- `extension/controlbar.js` - Extend TextHighlighter class
- `extension/background.js` - Add sentence event handling

#### Phase 4: Word-by-Word Highlighting
**Goal**: Implement word-by-word highlighting

**What we'll build:**
- Word boundary detection
- Word event handling from TTS API
- Word-level DOM manipulation with transitions

**Files to modify:**
- `extension/controlbar.js` - Add word highlighting methods
- `extension/background.js` - Add word event handling

#### Phase 5: Advanced Features
**Goal**: Add polish and customization

**What we'll build:**
- Style customization (color picker, opacity controls)
- Auto-scroll to keep highlights visible
- Smooth transitions and animations

**Files to modify:**
- `extension/popup.html` - Add style controls
- `extension/controlbar.js` - Add auto-scroll logic

### Settings UI Design

#### Main Popup (unchanged)
- Voice selection dropdown
- Text input area
- Speed slider
- Speak/Stop buttons
- **NEW: Settings button (⚙️ icon)**

#### Settings Panel (toggleable)
- **Highlighting Mode**: Radio buttons (Full Selection, Sentence, Word-by-Word)
- **Style Options**: Color picker, opacity slider
- **Auto-scroll**: Toggle switch
- **Voice Compatibility**: Status indicators
- **Close button**: Return to main interface

### Implementation Priority

#### High Priority (MVP)
1. ✅ Full Selection Highlighting (done)
2. Settings Infrastructure
3. Sentence Highlighting
4. Voice Compatibility Detection

#### Medium Priority
5. Word-by-Word Highlighting
6. Style Customization

#### Low Priority (Polish)
7. Auto-scroll Feature
8. Advanced Animations

### Success Criteria
- Settings accessible via button in popup
- Three highlighting modes work correctly
- Voice compatibility properly detected
- Settings persist across sessions
- Backwards compatibility maintained