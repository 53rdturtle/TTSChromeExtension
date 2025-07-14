# TTS Chrome Extension

A Chrome extension that provides text-to-speech functionality with a floating control bar for easy playback control.

## Features

- **Text-to-Speech**: Convert selected text to speech using Chrome's built-in TTS engine
- **Keyboard Shortcut**: Use `Ctrl+Shift+Z` (configurable) to start TTS for selected text
- **Floating Control Bar**: A modern, animated control bar that appears when TTS is active
- **Playback Controls**: Stop, pause, and resume TTS playback
- **Voice Selection**: Choose from available system voices
- **Speech Rate Control**: Adjust the speed of speech playback

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `TTSChromeExtension` folder
5. The extension should now be installed and active

## Usage

### Basic Usage

1. Select any text on a webpage
2. Press `Ctrl+Shift+Z` (or your configured shortcut)
3. The selected text will be read aloud using text-to-speech
4. A floating control bar will appear in the top-right corner

### Floating Control Bar

The floating control bar provides the following controls:

- **Stop (⏹)**: Immediately stop the current TTS playback
- **Pause (⏸)**: Pause the current TTS playback
- **Resume (▶)**: Resume paused TTS playback
- **Close (×)**: Manually close the control bar

The control bar automatically:
- Appears when TTS starts
- Updates button states based on playback status
- Disappears when TTS ends or is stopped
- Features smooth animations for better UX

### Advanced Settings

Open the extension popup to:
- Select your preferred voice
- Adjust speech rate
- Configure other TTS options

## File Structure

```
TTSChromeExtension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── controlbar.js         # Content script (floating control bar)
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── test.html             # Test page for functionality
└── README.md             # This file
```

## Technical Details

### Background Script (`background.js`)
- Handles TTS operations using Chrome's TTS API
- Manages keyboard shortcuts
- Communicates with content scripts
- Tracks TTS state (speaking, paused, stopped)

### Content Script (`controlbar.js`)
- Injects floating control bar into web pages
- Handles user interactions with control buttons
- Manages control bar visibility and animations
- Communicates with background script for TTS control

### Permissions Used
- `storage`: Save user preferences
- `activeTab`: Access selected text from current tab
- `tts`: Use Chrome's text-to-speech API
- `scripting`: Inject content scripts dynamically

## Testing

Use the included `test.html` file to test the extension:
1. Open `test.html` in Chrome
2. Select text from the sample content
3. Press `Ctrl+Shift+Z`
4. Verify the floating control bar appears and functions correctly

## Browser Compatibility

This extension requires Chrome 88+ or any Chromium-based browser that supports Manifest V3.

## Troubleshooting

### Control Bar Not Appearing
- Ensure text is selected before pressing the shortcut
- Check that the extension is enabled
- Verify the keyboard shortcut is working
- Check browser console for error messages

### TTS Not Working
- Ensure the page allows content scripts
- Check that Chrome's TTS API is available
- Verify system voices are installed

### Permission Issues
- Make sure all required permissions are granted
- Try reinstalling the extension if needed

## Development

To modify the extension:

1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test your changes

## License

This project is open source and available under the MIT License. 