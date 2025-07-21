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
   - **Auto-speak feature**: Automatically speaks selected text when popup opens
   - Handles user input, voice persistence, and TTS controls

3. **Content Script** (`extension/controlbar.js`)
   - `FloatingControlBar` class (lines 4-357): Provides floating controls on web pages
   - Draggable interface with pause/play, stop, and speed controls

4. **Extension Configuration** (`extension/manifest.json`)
   - Manifest v3 with permissions for storage, activeTab, tts, scripting
   - **Keyboard shortcut: Ctrl+Q** - Toggle TTS (start speaking selected text / stop current speech)
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
- Always ask before start writing code.

## Implementation Plan

### Overview
- **Full Selection**: Highlights entire selected text (✅ Already implemented)
- **Sentence Mode**: Highlights current sentence being spoken
- **Document Support**: PDFs and Google Docs text extraction and highlighting
- Individual toggle controls and style customization

### Phases

#### Phase 1: Settings Infrastructure ✅ COMPLETED
Foundation for configurable highlighting with settings storage and UI.

#### Phase 2: Enhanced Voice Selection & Management ✅ COMPLETED
Unified Chrome/Google TTS voice list with quality indicators and preview functionality.

#### Phase 3: Full-Page Options Interface
Migrate settings to dedicated options page with tabbed interface (General, Highlighting, Google TTS, Advanced).

#### Phase 4: Enhanced Settings Infrastructure
Individual toggle controls, independent styling, voice compatibility matrix in options page.

#### Phase 5: Voice Compatibility Detection
Detect highlighting mode support per voice with graceful fallback.

#### Phase 6: Sentence Highlighting
Sentence-by-sentence highlighting with boundary detection and event handling.

#### Phase 7: PDF Support
Extract and highlight text from PDF documents in browser with cross-page navigation.

#### Phase 8: Google Docs Support  
Extract and highlight text from Google Docs with live document editing compatibility.

#### Phase 9: Advanced Features
Auto-scroll, animations, layered highlighting, and polish.

### Settings UI Design

#### Main Popup (simplified)
- Voice selection dropdown  
- Text input area
- Speed slider
- Speak/Stop buttons
- **"Advanced Settings" button** - Opens full options page

#### Options Page (full-page interface)
**Navigation Tabs:**
- **General** - Basic TTS preferences
- **Highlighting** - All highlighting modes and styles  
- **Google TTS** - API configuration and preferences
- **Advanced** - Power user features

**General Tab:**
- Default voice selection
- Default speech rate
- Keyboard shortcuts configuration
- Basic accessibility options

**Highlighting Tab:**
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
- **Live Preview Area**: Demo text showing current highlighting styles
- **Global Highlighting Options**:
  - Auto-scroll toggle
  - Animation effects toggle
  - Layer ordering preferences

**Google TTS Tab:**
- API key configuration with validation
- Service enablement toggle
- Voice preference mapping (Chrome → Google voice)
- Usage quota display and monitoring
- Quality vs. usage preferences
- Error handling and fallback settings

**Advanced Tab:**
- **Document Support**:
  - PDF text extraction settings
  - Google Docs integration preferences
  - Cross-page navigation controls
- Per-site TTS preferences
- Advanced highlighting options
- Performance tuning
- Debug information
- Import/export settings
- Reset to defaults

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
  global: {
    autoScroll: true,
    animationEffects: true
  }
}
```

## Google TTS Integration

✅ **Google TTS MVP completed** with unified voice selection, API integration, and comprehensive test coverage.

## Git Workflow

**IMPORTANT**: Do not commit or push to origin unless explicitly instructed by the user. Only make code changes, run tests, and update documentation. Wait for explicit instructions before running git commands.

## Product Feature Considerations

- Product should auto-speak when opening the popup