# TTS Chrome Extension

A comprehensive TTS (Text-to-Speech) Chrome extension with full testing suite.

## Project Structure

```
TTSChromeExtension/
├── extension/           # Chrome extension files
│   ├── manifest.json    # Extension manifest
│   ├── background.js    # Service worker
│   ├── popup.html       # Extension popup
│   ├── popup.js         # Popup logic
│   ├── controlbar.js    # Content script
│   ├── test.html        # Test page
│   └── icons/           # Extension icons
├── tests/               # Test suite
│   ├── background.test.js
│   ├── popup.test.js
│   ├── controlbar.test.js
│   ├── integration.test.js
│   ├── e2e.test.js
│   └── setup.js
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Test Structure

### Unit Tests
- **`tests/background.test.js`** - Tests for TTSService and MessageHandler classes
- **`tests/popup.test.js`** - Tests for TTSController class and popup functionality
- **`tests/controlbar.test.js`** - Tests for FloatingControlBar class and content script

### Integration Tests
- **`tests/integration.test.js`** - End-to-end message passing and workflow tests

### E2E Tests
- **`tests/e2e.test.js`** - Browser-based tests using Puppeteer

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### E2E Tests Only
```bash
npm run test:e2e
```

## Test Coverage

The test suite covers:

### TTSService Class (`extension/background.js:56-146`)
- ✅ Constructor initialization
- ✅ `speak()` method with various options
- ✅ `stop()`, `pause()`, `resume()` functionality
- ✅ `getVoices()` API integration
- ✅ Error handling for TTS failures
- ✅ State management

### MessageHandler Class (`extension/background.js:149-281`)
- ✅ Message routing for all message types
- ✅ Async response handling
- ✅ Error propagation
- ✅ Parameter validation

### TTSController Class (`extension/popup.js:4-339`)
- ✅ DOM element initialization
- ✅ Voice population and selection
- ✅ Rate control and persistence
- ✅ Text input handling
- ✅ Button state management
- ✅ Storage operations

### FloatingControlBar Class (`extension/controlbar.js:4-357`)
- ✅ Show/hide functionality
- ✅ Drag behavior and positioning
- ✅ Button interactions
- ✅ State updates and UI synchronization

### Integration Tests
- ✅ End-to-end TTS workflow
- ✅ Message passing between components
- ✅ Storage integration
- ✅ Tab interaction
- ✅ Error handling
- ✅ Keyboard shortcuts

### E2E Tests
- ✅ Extension loading
- ✅ Popup functionality
- ✅ Test page interactions
- ✅ Content script injection
- ✅ Performance tests
- ✅ Responsive design

## Test Cases by Use Case

### Basic TTS Functionality
- Speaking text with default settings
- Speaking text with custom voice and rate
- Stopping TTS playback
- Pausing and resuming TTS

### Voice Management
- Loading available voices
- Selecting and saving voice preferences
- Handling voice API errors

### User Interface
- Popup interface interactions
- Button state management during TTS
- Error message display
- Rate slider functionality

### Storage & Persistence
- Saving and loading user preferences
- Text persistence between sessions
- Voice and rate settings

### Content Script Integration
- Floating control bar display
- Drag functionality
- Button interactions
- Status updates

### Error Scenarios
- TTS API failures
- Empty text input
- No available voices
- Tab access errors
- Storage errors

### Performance
- Quick popup loading
- Responsive UI updates
- Memory usage during long TTS sessions

## Mocking Strategy

### Chrome APIs
- `chrome.tts.*` - TTS functionality
- `chrome.storage.*` - Data persistence
- `chrome.tabs.*` - Tab management
- `chrome.runtime.*` - Message passing
- `chrome.scripting.*` - Content script injection

### DOM APIs
- Document methods and properties
- Element creation and manipulation
- Event handling
- Window properties

## Continuous Integration

The test suite is designed to work in CI/CD environments:
- All tests use mocked Chrome APIs
- E2E tests can run in headless mode
- Coverage reports are generated
- Tests are isolated and independent

## Contributing

When adding new functionality:

1. **Write unit tests** for individual functions/classes
2. **Add integration tests** for component interactions
3. **Update E2E tests** for user-facing features
4. **Maintain test coverage** above 80%
5. **Mock external dependencies** appropriately

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Run E2E tests only |

## Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All critical workflows
- **E2E Tests**: All user interactions
- **Overall**: 85%+ code coverage