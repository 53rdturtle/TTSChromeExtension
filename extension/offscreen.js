// Offscreen Audio Player for Google TTS

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
      
      // Track if audio has successfully started
      let audioStarted = false;
      
      // Set up event listeners
      this.currentAudio.onplay = () => {
        audioStarted = true;
        chrome.runtime.sendMessage({ type: 'googleTTSStarted' }).catch(() => {});
      };
      
      this.currentAudio.onended = () => {
        chrome.runtime.sendMessage({ type: 'googleTTSEnded' }).catch(() => {});
        // Clean up audio element after playback ends (without sending duplicate ended message)
        this.cleanupAudio();
      };
      
      this.currentAudio.onerror = (event) => {
        let errorMessage = 'Audio playback error';
        if (event.target && event.target.error) {
          errorMessage = `Audio error code: ${event.target.error.code}`;
        }
        
        // Only send googleTTSEnded if audio had actually started
        if (audioStarted) {
          chrome.runtime.sendMessage({ type: 'googleTTSEnded' }).catch(() => {});
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
        const originalOnError = this.currentAudio.onerror;
        
        // Temporarily add load handlers without overwriting existing handlers
        const loadResolve = () => {
          this.currentAudio.removeEventListener('canplaythrough', loadResolve);
          this.currentAudio.removeEventListener('error', loadReject);
          resolve();
        };
        
        const loadReject = (event) => {
          this.currentAudio.removeEventListener('canplaythrough', loadResolve);
          this.currentAudio.removeEventListener('error', loadReject);
          reject(event);
        };
        
        this.currentAudio.addEventListener('canplaythrough', loadResolve);
        this.currentAudio.addEventListener('error', loadReject);
        this.currentAudio.load();
        
        // Timeout after 5 seconds
        setTimeout(() => {
          this.currentAudio.removeEventListener('canplaythrough', loadResolve);
          this.currentAudio.removeEventListener('error', loadReject);
          reject(new Error('Audio load timeout'));
        }, 5000);
      });
      
      // Play audio
      await this.currentAudio.play();
      
    } catch (error) {
      chrome.runtime.sendMessage({ 
        type: 'googleTTSError', 
        error: error.message || 'Audio playback failed'
      }).catch(() => {});
      throw error;
    }
  }

  cleanupAudio() {
    if (this.currentAudio) {
      // Complete cleanup to prevent audio conflicts
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      
      // Remove all event listeners to prevent memory leaks
      this.currentAudio.onplay = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onpause = null;
      this.currentAudio.oncanplaythrough = null;
      
      // Clear source and remove audio element
      this.currentAudio.src = '';
      this.currentAudio.removeAttribute('src');
      this.currentAudio.load(); // Force browser to release resources
      this.currentAudio = null;
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      this.cleanupAudio();
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