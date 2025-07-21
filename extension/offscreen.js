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
          // Don't respond to messages we don't handle - let other listeners handle them
          return false;
      }
    });
  }

  async playAudio(base64Data) {
    try {
      // Stop any existing audio
      this.stopAudio();
      
      // Validate base64 data
      if (!base64Data || base64Data.trim() === '') {
        throw new Error('Invalid audio data provided');
      }
      
      // Create new audio element
      this.currentAudio = new Audio();
      
      // Set up event listeners
      this.currentAudio.onplay = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSStarted' }).catch(() => {});
      };
      
      this.currentAudio.onended = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSEnded' }).catch(() => {});
      };
      
      this.currentAudio.onerror = (event) => {
        console.error('Audio error event:', event);
        let errorMessage = 'Audio playback error';
        if (event.target && event.target.error) {
          errorMessage = `Audio error code: ${event.target.error.code}`;
        }
        chrome.runtime.sendMessage({ 
          type: 'googleTTSError', 
          error: errorMessage
        }).catch(() => {});
      };
      
      this.currentAudio.onpause = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSPaused' }).catch(() => {});
      };
      
      
      // Set audio source
      this.currentAudio.src = `data:audio/mp3;base64,${base64Data}`;
      
      // Wait for the audio to be ready before playing
      await new Promise((resolve, reject) => {
        this.currentAudio.oncanplaythrough = resolve;
        this.currentAudio.onerror = reject;
        this.currentAudio.load();
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Audio load timeout')), 5000);
      });
      
      // Play audio
      await this.currentAudio.play();
      
    } catch (error) {
      console.error('Error in playAudio:', error);
      chrome.runtime.sendMessage({ 
        type: 'googleTTSError', 
        error: error.message || 'Audio playback failed'
      }).catch(() => {});
      throw error;
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = '';
      this.currentAudio = null;
      
      // Send googleTTSEnded event to ensure highlighting is cleared when manually stopped
      chrome.runtime.sendMessage({ type: 'googleTTSEnded' }).catch(() => {});
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