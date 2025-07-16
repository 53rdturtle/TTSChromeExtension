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