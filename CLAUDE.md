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

## Google Cloud Text-to-Speech Integration Plan

### Overview
Integrate Google Cloud Text-to-Speech API as a premium highlighting option to provide precise sentence and word-level highlighting with perfect timing synchronization using advanced neural voices.

### Why Google Cloud TTS?
- **Generous Free Tier**: 1 million characters/month (4x more than alternatives)
- **Superior Voice Quality**: Neural2, WaveNet, and Chirp 3: HD voices with human-like emphasis
- **SSML Support**: Advanced markup for precise timing marks and speech control
- **380+ Voices**: 50+ languages with multiple neural voice tiers
- **Proven Infrastructure**: Google's robust cloud platform with global availability
- **Advanced Features**: Real-time streaming, custom pronunciations, pace control

### Voice Technology Options

#### Neural2 Voices (Recommended)
- **Technology**: Custom Voice technology without training requirement
- **Quality**: High-fidelity, natural-sounding speech
- **Availability**: Preview tier with expanding language support
- **Use Case**: Primary option for premium TTS

#### WaveNet Voices
- **Technology**: Trained on raw audio samples of actual humans
- **Quality**: Warm, human-like emphasis and inflection
- **Features**: Superior pronunciation of syllables, phonemes, and words
- **Use Case**: Fallback option for languages not supported by Neural2

#### Chirp 3: HD Voices
- **Technology**: Captures nuances in human intonation
- **Features**: 30 distinct styles, real-time streaming support
- **Advanced Controls**: Pace control, pause control, custom pronunciations
- **Availability**: GA across 31 locales with 8 speakers

### Implementation Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chrome TTS    │    │ Google Cloud    │    │  TextHighlighter│
│   (Fallback)    │    │      TTS        │    │    (Content)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────┬───────────────────────────────┘
                         │
                ┌─────────────────┐
                │  Hybrid TTS     │
                │    Service      │
                └─────────────────┘
```

### Implementation Phases

#### Phase 1: MVP - Basic Google Cloud TTS Playback
**Goal**: Create minimal viable product to play selected text using Google Cloud TTS API

**Breakdown into smaller tasks:**

1. **Task 1.1: Basic Google Cloud Setup (1 hour)** ✅
   - Create Google Cloud project and enable Text-to-Speech API
   - Generate API key (simplest authentication method for MVP)
   - Document API key setup instructions

**Google Cloud Setup Instructions:**
1. **Create Project**: Visit [Google Cloud Console](https://console.cloud.google.com) → Create Project
2. **Enable Billing**: Link billing account (free tier: 1M chars/month, no charges unless exceeded)
3. **Enable API**: Search "Text-to-Speech API" → Enable
4. **Create API Key**: Navigation → APIs & Services → Credentials → Create Credentials → API Key
5. **Secure Key**: Copy and store API key securely (will be entered in extension settings)

2. **Task 1.2: Simple API Key Storage (30 minutes)**
   - Add basic API key storage in Chrome extension storage
   - Create simple settings input field for API key
   - No validation yet - just storage and retrieval

3. **Task 1.3: Offscreen Document for Audio (1-2 hours)**
   - Create `extension/offscreen.html` and `extension/offscreen.js`
   - Implement basic audio playback from base64 MP3 data
   - Add message passing between background script and offscreen
   - Handle audio events (play, end) and sync with TTS state

4. **Task 1.4: Basic GoogleTTSService (2 hours)**
   - Create minimal `extension/services/google-tts.js` file
   - Implement basic synthesize method using fetch API
   - Return MP3 audio data (no SSML marks for MVP)
   - Add basic error handling (console logs only)

5. **Task 1.5: Integrate into Existing TTS Flow (1 hour)** ✅
   - Add Google TTS as optional service in background.js
   - Create simple toggle in popup to choose between Chrome TTS and Google TTS
   - Use existing highlighting system (no timing improvements yet)
   - Test basic functionality with selected text

**MVP Implementation Details:**

**Simple GoogleTTSService**:
```javascript
class GoogleTTSService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  }

  async synthesize(text, options = {}) {
    const request = {
      input: { text: text },
      voice: { 
        languageCode: 'en-US', 
        name: 'en-US-Neural2-F'
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        speakingRate: options.rate || 1.0
      }
    };

    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    return data.audioContent; // Base64 encoded MP3
  }
}
```

**Simple Settings Toggle**:
```html
<div class="google-tts-mvp">
  <label>
    <input type="checkbox" id="useGoogleTTS"> 
    Use Google TTS (requires API key)
  </label>
  <input type="password" id="googleAPIKey" placeholder="Google Cloud API Key">
</div>
```

**Offscreen Audio Implementation:**
```javascript
// extension/offscreen.js
class OffscreenAudioPlayer {
  constructor() {
    this.currentAudio = null;
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async handleMessage(message, sender, sendResponse) {
    if (message.type === 'playGoogleTTS') {
      await this.playAudio(message.audioData);
      sendResponse({ status: 'playing' });
    } else if (message.type === 'stopGoogleTTS') {
      this.stopAudio();
      sendResponse({ status: 'stopped' });
    }
  }

  async playAudio(base64Data) {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    
    this.currentAudio = new Audio(`data:audio/mp3;base64,${base64Data}`);
    
    this.currentAudio.onended = () => {
      chrome.runtime.sendMessage({ type: 'googleTTSEnded' });
    };
    
    await this.currentAudio.play();
    chrome.runtime.sendMessage({ type: 'googleTTSStarted' });
  }
}

new OffscreenAudioPlayer();
```

**Files to create/modify:**
- `extension/services/google-tts.js` - New minimal Google TTS service
- `extension/offscreen.html` - New offscreen document for audio playback
- `extension/offscreen.js` - New offscreen audio player
- `extension/background.js` - Add Google TTS as optional service + offscreen management
- `extension/popup.html` - Add simple Google TTS toggle
- `extension/popup.js` - Add Google TTS selection logic
- `extension/manifest.json` - Add host permissions + offscreen permission

**MVP Success Criteria:**
- User can enter Google Cloud API key
- Selected text plays using Google TTS when enabled (via offscreen audio)
- Falls back to Chrome TTS when disabled or on error
- No advanced features (SSML, precise timing, quota management)
- Basic error handling (logs only, no user notifications)

#### Phase 2: Error Handling & Basic Features
**Goal**: Make Google TTS robust and add essential features

**Breakdown into smaller tasks:**

1. **Task 2.1: Add Error Handling & Fallback (2 hours)**
   - Implement automatic fallback to Chrome TTS on Google TTS failures
   - Add API key validation with user-friendly error messages
   - Handle network errors, quota exceeded, and invalid responses
   - Create error logging for debugging

2. **Task 2.2: Enhanced Audio Controls (2 hours)**
   - Add pause/resume functionality for Google TTS audio in offscreen
   - Implement stop functionality that properly cleans up audio
   - Sync audio state with existing control bar system
   - Handle audio interruption scenarios

3. **Task 2.3: Basic Quota Tracking (1-2 hours)**
   - Implement simple character count tracking for Google TTS usage
   - Store monthly usage in Chrome storage
   - Add basic quota warnings at 80% usage
   - Display usage in settings panel

4. **Task 2.4: Service Selection Logic (1 hour)**
   - Add user preference for default TTS service (Chrome vs Google)
   - Implement service switching based on user choice
   - Maintain existing Chrome TTS as primary with Google as option
   - Test service selection functionality

**Implementation Details:**

**Service Selector Logic**:
```javascript
class HybridTTSService {
  constructor() {
    this.chromeTTS = new TTSService();
    this.googleTTS = new GoogleTTSService();
    this.preferredService = 'chrome'; // User preference
  }
  
  async speak(text, options) {
    const useGoogle = this.shouldUseGoogleTTS(text, options);
    
    if (useGoogle && this.hasValidAPIKey() && this.hasQuota()) {
      return await this.speakWithGoogle(text, options);
    } else {
      return await this.speakWithChrome(text, options);
    }
  }
  
  shouldUseGoogleTTS(text, options) {
    return options.preciseHighlighting && 
           text.length > 50 && // Worth using for longer texts
           this.preferredService === 'google';
  }
}
```

**Quota Management**:
```javascript
class QuotaManager {
  async checkUsage() {
    const usage = await chrome.storage.local.get(['googleTTSUsage']);
    const monthlyUsage = usage.googleTTSUsage || 0;
    return {
      used: monthlyUsage,
      limit: 1000000, // 1M chars/month
      remaining: 1000000 - monthlyUsage,
      percentage: (monthlyUsage / 1000000) * 100
    };
  }
  
  async trackUsage(characterCount) {
    const current = await chrome.storage.local.get(['googleTTSUsage']);
    const newUsage = (current.googleTTSUsage || 0) + characterCount;
    await chrome.storage.local.set({ googleTTSUsage: newUsage });
  }
}
```

**Files to modify:**
- `extension/background.js` - Replace TTSService with HybridTTSService
- `extension/services/quota-manager.js` - New quota tracking system
- `extension/popup.js` - Add service preference toggle and quota display

#### Phase 3: SSML Implementation & Precise Timing
**Goal**: Add SSML support to Google TTS for precise sentence timing

**Breakdown into smaller tasks:**

1. **Task 3.1: SSML Text Preprocessing (2 hours)**
   - Create sentence parsing utility function
   - Implement SSML generation with sentence timing marks
   - Add `<mark>` tags for sentence boundaries
   - Test SSML output with various text inputs

2. **Task 3.2: Update GoogleTTSService for SSML (1-2 hours)**
   - Modify GoogleTTSService to use SSML input instead of plain text
   - Add timepoint extraction from Google TTS response
   - Handle SSML mark timing data
   - Maintain backward compatibility with plain text

3. **Task 3.3: Basic Timing-Based Highlighting (2-3 hours)**
   - Extend existing TextHighlighter to use timing data
   - Implement sentence highlighting based on SSML marks
   - Schedule highlight events using setTimeout with timing data
   - Test timing accuracy with different text lengths

4. **Task 3.4: Sync Control Bar with Timing (1 hour)**
   - Update control bar to work with timing-based playback
   - Add progress indication based on sentence timing
   - Handle pause/resume with timing preservation
   - Test control bar functionality with Google TTS timing

**Implementation Details:**

**Audio Playback with Timing**:
```javascript
class PreciseAudioPlayer {
  async playWithHighlighting(audioData, timepoints, text) {
    const audio = new Audio();
    audio.src = `data:audio/mp3;base64,${audioData}`;
    
    // Schedule highlights based on SSML marks
    timepoints.forEach(point => {
      setTimeout(() => {
        if (point.markName.includes('sentence_') && point.markName.includes('_start')) {
          this.highlightSentence(point.markName);
        } else if (point.markName.includes('_end')) {
          this.clearSentenceHighlight(point.markName);
        }
      }, point.timeSeconds * 1000);
    });
    
    return audio.play();
  }
}
```

**Enhanced TextHighlighter**:
```javascript
class TextHighlighter {
  highlightWithPreciseTimings(text, timepoints) {
    this.sentences = this.parseSentences(text);
    this.timepoints = timepoints;
    
    // Create mapping between SSML marks and DOM elements
    this.sentenceElements = this.mapSentencesToDOM();
    this.scheduleHighlightingFromTimepoints();
  }
  
  scheduleHighlightingFromTimepoints() {
    this.timepoints.forEach(timing => {
      if (timing.markName.includes('_start')) {
        setTimeout(() => {
          this.highlightSentenceByMark(timing.markName);
        }, timing.timeSeconds * 1000);
      }
    });
  }
}
```

**Files to modify:**
- `extension/controlbar.js` - Enhance TextHighlighter with precise timing
- `extension/services/audio-player.js` - New precise audio playback class
- `extension/background.js` - Integrate precise highlighting
- `extension/offscreen.html` - New offscreen document for audio
- `extension/offscreen.js` - New offscreen script for audio handling

#### Phase 4: Enhanced Settings & Voice Options
**Goal**: Improve Google TTS settings and add voice selection

**Breakdown into smaller tasks:**

1. **Task 4.1: Enhanced Settings Panel (1-2 hours)**
   - Improve Google TTS settings section in popup
   - Add API key validation with visual feedback
   - Include connection testing with status indicators
   - Add help links for API key setup

2. **Task 4.2: Voice Selection & Quality Options (2 hours)**
   - Add Google voice selection dropdown (Neural2, WaveNet, Standard)
   - Implement voice preview functionality
   - Add language selection for international users
   - Test voice options with different text samples

3. **Task 4.3: Quota Monitoring Dashboard (1-2 hours)**
   - Create quota usage display with progress bar
   - Add usage warnings at 80% and 95% thresholds
   - Include estimated remaining characters
   - Add monthly reset countdown

4. **Task 4.4: Advanced Settings Options (1 hour)**
   - Add speed/rate controls specifically for Google TTS
   - Include audio quality selection (MP3 bitrate)
   - Add default service preference setting
   - Test all settings combinations

**Implementation Details:**

**Settings Panel Additions:**
```html
<div class="google-tts-section">
  <h3>🚀 Premium Highlighting (Google TTS)</h3>
  
  <div class="setting-item">
    <label>
      <input type="checkbox" id="enableGoogleTTS"> 
      Enable Google TTS for precise highlighting
    </label>
  </div>
  
  <div class="quota-display">
    <div class="quota-bar">
      <div class="quota-used" style="width: 25%"></div>
    </div>
    <span class="quota-text">Usage: 250K / 1M chars this month (25%)</span>
  </div>
  
  <div class="setting-item">
    <label>Voice Quality:</label>
    <select id="googleVoiceQuality">
      <option value="neural2">Neural2 (Highest Quality)</option>
      <option value="wavenet">WaveNet (High Quality)</option>
      <option value="standard">Standard (Faster)</option>
    </select>
  </div>
  
  <div class="setting-item">
    <label>Auto-upgrade to Google TTS for:</label>
    <select id="googleTTSThreshold">
      <option value="precise">Precise highlighting only</option>
      <option value="long">Long texts (200+ chars)</option>
      <option value="always">All text</option>
    </select>
  </div>
  
  <div class="api-key-section">
    <label>Google Cloud API Key:</label>
    <input type="password" id="googleAPIKey" placeholder="Enter API key...">
    <button id="testConnection">Test Connection</button>
    <a href="#" id="helpLink">How to get API key</a>
  </div>
</div>
```

**Files to modify:**
- `extension/popup.html` - Add Google TTS settings section
- `extension/popup.js` - Add Google TTS settings logic and quota display
- `extension/popup.css` - Style new settings section

#### Phase 5: Advanced Features & Polish
**Goal**: Add advanced features and polish the Google TTS integration

**Breakdown into smaller tasks:**

1. **Task 5.1: Word-Level Highlighting (2-3 hours)**
   - Extend SSML to include word-level marks
   - Implement word-by-word highlighting with timing
   - Add word highlighting as an optional feature
   - Test word highlighting accuracy with different voices

2. **Task 5.2: Advanced Audio Controls (1-2 hours)**
   - Add pause/resume functionality for Google TTS audio
   - Implement seek functionality using timing data
   - Add audio progress visualization
   - Handle audio state synchronization across tabs

3. **Task 5.3: Performance Optimization (1-2 hours)**
   - Implement audio caching for repeated text
   - Add background synthesis for better responsiveness
   - Optimize SSML generation for large texts
   - Add text preprocessing (remove excessive whitespace, etc.)

4. **Task 5.4: User Experience Polish (1 hour)**
   - Add loading indicators during synthesis
   - Improve error messages with actionable guidance
   - Add keyboard shortcuts for Google TTS
   - Include usage analytics and feedback collection

**Implementation Details:**

**Graceful Degradation**:
```javascript
async speakWithFallback(text, options) {
  try {
    if (this.shouldUseGoogleTTS(text, options)) {
      const result = await this.googleTTS.speak(text, options);
      await this.quotaManager.trackUsage(text.length);
      return result;
    }
  } catch (error) {
    console.warn('Google TTS failed, falling back to Chrome TTS:', error);
    this.logGoogleTTSFailure(error);
    
    // Show user-friendly notification
    this.showFallbackNotification(error);
  }
  
  // Always fallback to Chrome TTS
  return await this.chromeTTS.speak(text, options);
}
```

**Error Scenarios & Handling**:
- **API quota exceeded** → Fallback to Chrome TTS + show quota warning
- **Network issues** → Fallback to Chrome TTS + retry option
- **Invalid API key** → Show setup dialog with instructions
- **Unsupported language** → Use Chrome TTS for that language
- **CORS/permissions** → Guide user through browser settings

**User Notifications**:
```javascript
showFallbackNotification(error) {
  const notification = {
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'TTS Fallback',
    message: this.getFriendlyErrorMessage(error)
  };
  
  chrome.notifications.create(notification);
}
```

**Files to modify:**
- `extension/background.js` - Add comprehensive error handling
- `extension/services/error-handler.js` - New error management system
- `extension/manifest.json` - Add notifications permission

### Security & Privacy Considerations

1. **API Key Storage**: 
   - Store securely in Chrome extension storage (encrypted)
   - Never log or expose API keys in console
   - Provide clear instructions for key management

2. **Data Privacy**: 
   - Text processing done by Google Cloud (standard cloud TTS privacy)
   - No permanent storage of user text on our servers
   - Clear privacy policy about Google Cloud integration

3. **Quota Protection**: 
   - Client-side limits to prevent accidental overuse
   - User-configurable daily/monthly limits
   - Warning notifications at 80% and 95% usage

4. **Fallback Security**: 
   - Chrome TTS as offline/secure backup
   - No degradation in core functionality if Google TTS unavailable

### Benefits of Implementation

#### For Users:
- **4x more free usage** than other cloud TTS services (1M vs 250K chars/month)
- **Perfect sentence highlighting** with exact timing from SSML marks
- **Superior voice quality** (Neural2, WaveNet, Chirp 3: HD voices)
- **Seamless experience** with automatic fallback to Chrome TTS
- **No interruptions** in TTS workflow
- **Advanced voice controls** (pace, pitch, emphasis)

#### For Development:
- **Future-proof architecture** for other cloud TTS services
- **Modular design** with clear separation of concerns
- **Backward compatibility** maintained with Chrome TTS
- **Easy testing** with comprehensive mock services
- **Scalable quota management** for different user tiers

### Revised Timeline & Effort Estimation

#### Phase 1 (MVP - Basic Google TTS): ~6-7 hours
- Google Cloud project setup and API key generation
- **Offscreen document for audio playback** (required for MVP)
- Basic GoogleTTSService with simple audio playback
- Simple settings toggle and integration
- Basic functionality testing

#### Phase 2 (Error Handling & Basic Features): ~6-7 hours  
- Error handling and fallback to Chrome TTS
- Enhanced audio controls (pause/resume/stop)
- Basic quota tracking and warnings
- Service selection logic

#### Phase 3 (SSML & Precise Timing): ~6-8 hours
- SSML implementation with sentence marks
- Timing-based sentence highlighting
- Control bar synchronization with timing
- Testing timing accuracy

#### Phase 4 (Enhanced Settings): ~5-6 hours
- Improved settings panel with validation
- Voice selection and quality options
- Quota monitoring dashboard
- Advanced settings and preferences

#### Phase 5 (Advanced Features): ~5-7 hours
- Word-level highlighting with SSML
- Advanced audio controls (pause/seek)
- Performance optimization and caching
- User experience polish and feedback

**Total Estimated Effort**: 27-35 hours

### MVP-First Approach Benefits

#### Immediate Value (Phase 1):
- Users get Google TTS functionality immediately
- Simple setup process with clear value proposition
- Basic functionality to validate user interest
- Foundation for advanced features

#### Incremental Improvement:
- Each phase adds concrete value
- Users see continuous improvement
- Easier testing and debugging
- Lower risk of complex integration issues

### Success Metrics

- **Timing Accuracy**: <50ms variance from actual speech using SSML marks
- **Fallback Reliability**: 100% fallback success rate to Chrome TTS
- **User Adoption**: Track Google TTS usage vs Chrome TTS preference
- **Quota Efficiency**: Monitor usage patterns and optimization opportunities
- **Voice Quality**: User satisfaction with Neural2/WaveNet vs Chrome voices

### API Integration Example

```javascript
// Google Cloud TTS API call structure
const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    input: { ssml: ssmlText },
    voice: { 
      languageCode: 'en-US',
      name: 'en-US-Neural2-F'
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      effectsProfileId: ['headphone-class-device'],
      pitch: 0,
      speakingRate: 1.0
    },
    enableTimePointing: ['SSML_MARK']
  })
});
```