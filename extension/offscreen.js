// Offscreen Audio Player for Google TTS
console.log('Offscreen document loaded');

class OffscreenAudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      
      switch (message.type) {
        case 'playGoogleTTS':
          this.playAudio(message.audioData)
            .then(() => {
              sendResponse({ status: 'playing' });
            })
            .catch((error) => {
              console.error('Audio playback failed:', error);
              sendResponse({ status: 'error', error: error.message });
            });
          return true; // Keep the message channel open for async response
          
        case 'stopGoogleTTS':
          this.stopAudio();
          sendResponse({ status: 'stopped' });
          break;
          
        case 'pauseGoogleTTS':
          this.pauseAudio();
          sendResponse({ status: 'paused' });
          break;
          
        case 'resumeGoogleTTS':
          this.resumeAudio();
          sendResponse({ status: 'resumed' });
          break;
          
        default:
          sendResponse({ status: 'error', error: 'Unknown message type' });
      }
    });
  }

  async playAudio(base64Data) {
    try {
      // Stop any existing audio
      this.stopAudio();
      
      // Create new audio element
      this.currentAudio = new Audio();
      
      // Set up event listeners
      this.currentAudio.onplay = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSStarted' });
      };
      
      this.currentAudio.onended = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSEnded' });
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('Audio error:', error);
        chrome.runtime.sendMessage({ 
          type: 'googleTTSError', 
          error: error.message || 'Audio playback error' 
        }).catch(() => {
          // Ignore if background script isn't ready
        });
      };
      
      this.currentAudio.onpause = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSPaused' });
      };
      
      // Validate base64 data
      if (!base64Data || base64Data.trim() === '') {
        throw new Error('Invalid audio data provided');
      }
      
      // Set audio source
      this.currentAudio.src = `data:audio/mp3;base64,${base64Data}`;
      
      // Play audio
      try {
        await this.currentAudio.play();
      } catch (playError) {
        console.error('Failed to play audio:', playError);
        throw new Error(`Audio playback failed: ${playError.message}`);
      }
      
    } catch (error) {
      console.error('Error in playAudio:', error);
      throw error;
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
  }

  pauseAudio() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
  }

  resumeAudio() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch((error) => {
        console.error('Error resuming audio:', error);
        chrome.runtime.sendMessage({ 
          type: 'googleTTSError', 
          error: 'Failed to resume audio' 
        });
      });
    }
  }
}

// Initialize the audio player
const audioPlayer = new OffscreenAudioPlayer();