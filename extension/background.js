// Background service worker for TTS Chrome Extension

// Import Google TTS service and dependencies
importScripts('utils/ssml-builder.js');
importScripts('utils/simple-sentence-detector.js');
importScripts('services/google-tts.js');

// Verify SSML Builder was loaded successfully
if (typeof SSMLBuilder === 'undefined') {
  console.error('❌ SSML Builder failed to load in service worker context');
}

if (typeof SimpleSentenceDetector === 'undefined') {
  console.error('❌ SimpleSentenceDetector failed to load in service worker context');
}

// Default highlighting settings - Enhanced per-mode configuration
const DEFAULT_HIGHLIGHTING_SETTINGS = {
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
    enabled: true,
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
};

// Global TTS state for cross-tab persistence
let globalTTSState = {
  isSpeaking: false,
  isPaused: false,
  showControlBar: false,
  controlBarPosition: { x: 20, y: null, bottom: 20 }, // Default position
  controlBarSize: { width: 200, height: 'auto' },
  originatingTabId: null // Track which tab started the TTS
};

// Function to broadcast control bar state to all tabs
async function broadcastControlBarState() {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          // Inject content script if not already injected
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          
          // Small delay to ensure content script is loaded
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Send message to show/hide control bar
          const message = {
            type: globalTTSState.showControlBar ? 'showControlBar' : 'hideControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          };
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Ignore tabs that don't support content scripts (silently)
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting control bar state:', error);
  }
}

// Shared utility to get selected text from active tab
// Extract selected text with paragraph boundary awareness
async function getSelectedTextWithStructure() {
  return new Promise((resolve) => {
    // Query for tabs in the current window, excluding popup windows
    chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      windowType: 'normal' // Only normal windows, not popups
    }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return null;
            
            const range = selection.getRangeAt(0);
            const walker = document.createTreeWalker(
              range.commonAncestorContainer,
              NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
              {
                acceptNode: function(node) {
                  if (node.nodeType === Node.TEXT_NODE) {
                    return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                  } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if this is a block-level element that should create paragraph boundaries
                    const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'];
                    return blockElements.includes(node.tagName) && range.intersectsNode(node) ? 
                      NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                  }
                  return NodeFilter.FILTER_SKIP;
                }
              }
            );

            let text = '';
            const paragraphBoundaries = [];
            let currentNode;
            let lastBlockElement = null;

            while (currentNode = walker.nextNode()) {
              if (currentNode.nodeType === Node.TEXT_NODE) {
                // Add the text content
                let nodeText = currentNode.textContent;
                
                // If this text node is at the start or end of the selection, we might need to trim it
                if (currentNode === range.startContainer) {
                  nodeText = nodeText.substring(range.startOffset);
                }
                if (currentNode === range.endContainer) {
                  nodeText = nodeText.substring(0, range.endOffset - (currentNode === range.startContainer ? range.startOffset : 0));
                }
                
                text += nodeText;
              } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                // This is a block element - mark paragraph boundary
                const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'];
                if (blockElements.includes(currentNode.tagName) && currentNode !== lastBlockElement) {
                  // Only add boundary if we have some text and this is a new block element
                  if (text.length > 0 && lastBlockElement !== null) {
                    paragraphBoundaries.push(text.length);
                  }
                  lastBlockElement = currentNode;
                }
              }
            }
            
            console.log('🔍 Paragraph boundary extraction result:', {
              textLength: text.length,
              textPreview: text.trim().substring(0, 100) + '...',
              paragraphBoundaries: paragraphBoundaries,
              boundaryCount: paragraphBoundaries.length
            });
            
            return text && text.trim() !== "" ? { text: text.trim(), paragraphBoundaries } : null;
          }
        }, (results) => {
          const result = results && results[0] && results[0].result;
          resolve(result);
        });
      } else {
        // Alternative: get the last active tab
        chrome.tabs.query({ 
          active: true, 
          windowType: 'normal'
        }, (allTabs) => {
          if (allTabs && allTabs.length > 0) {
            const tab = allTabs[0];
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const selection = window.getSelection();
                if (!selection.rangeCount) return null;
                
                const range = selection.getRangeAt(0);
                const walker = document.createTreeWalker(
                  range.commonAncestorContainer,
                  NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                  {
                    acceptNode: function(node) {
                      if (node.nodeType === Node.TEXT_NODE) {
                        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                      } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if this is a block-level element that should create paragraph boundaries
                        const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'];
                        return blockElements.includes(node.tagName) && range.intersectsNode(node) ? 
                          NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                      }
                      return NodeFilter.FILTER_SKIP;
                    }
                  }
                );

                let text = '';
                const paragraphBoundaries = [];
                let currentNode;
                let lastBlockElement = null;

                while (currentNode = walker.nextNode()) {
                  if (currentNode.nodeType === Node.TEXT_NODE) {
                    // Add the text content
                    let nodeText = currentNode.textContent;
                    
                    // If this text node is at the start or end of the selection, we might need to trim it
                    if (currentNode === range.startContainer) {
                      nodeText = nodeText.substring(range.startOffset);
                    }
                    if (currentNode === range.endContainer) {
                      nodeText = nodeText.substring(0, range.endOffset - (currentNode === range.startContainer ? range.startOffset : 0));
                    }
                    
                    text += nodeText;
                  } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    // This is a block element - mark paragraph boundary
                    const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'];
                    if (blockElements.includes(currentNode.tagName) && currentNode !== lastBlockElement) {
                      // Only add boundary if we have some text and this is a new block element
                      if (text.length > 0 && lastBlockElement !== null) {
                        paragraphBoundaries.push(text.length);
                      }
                      lastBlockElement = currentNode;
                    }
                  }
                }
                
                console.log('🔍 Paragraph boundary extraction result (fallback):', {
                  textLength: text.length,
                  textPreview: text.trim().substring(0, 100) + '...',
                  paragraphBoundaries: paragraphBoundaries,
                  boundaryCount: paragraphBoundaries.length
                });
                
                return text && text.trim() !== "" ? { text: text.trim(), paragraphBoundaries } : null;
              }
            }, (results) => {
              const result = results && results[0] && results[0].result;
              resolve(result);
            });
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

async function getSelectedTextFromActiveTab() {
  const result = await getSelectedTextWithStructure();
  return result ? result.text : null;
}

// Split sentences at paragraph boundaries for better highlighting
function splitSentencesAtParagraphBoundaries(sentences, text, paragraphBoundaries) {
  if (!paragraphBoundaries || !paragraphBoundaries.length) {
    return sentences;
  }

  console.log('🔄 Processing sentences with paragraph boundaries:', paragraphBoundaries);
  
  const result = [];
  
  sentences.forEach((sentence, sentenceIndex) => {
    // Find the position of this sentence in the original text
    const sentenceStart = text.indexOf(sentence);
    const sentenceEnd = sentenceStart + sentence.length;
    
    console.log(`📝 Sentence ${sentenceIndex}: "${sentence.substring(0, 30)}..." at position ${sentenceStart}-${sentenceEnd}`);
    
    // CRITICAL FIX: Only split sentences that were actually found in the text
    if (sentenceStart === -1) {
      console.log(`⚠️ Sentence ${sentenceIndex} not found in text - keeping intact`);
      result.push(sentence);
      return;
    }
    
    // Find paragraph boundaries that fall within this sentence
    const boundariesInSentence = paragraphBoundaries.filter(boundary => 
      boundary > sentenceStart && boundary < sentenceEnd
    );
    
    if (boundariesInSentence.length === 0) {
      // No paragraph boundaries in this sentence, keep it as is
      result.push(sentence);
      console.log(`✅ Keeping sentence ${sentenceIndex} intact (no paragraph boundaries)`);
    } else {
      // Split the sentence at paragraph boundaries
      console.log(`✂️ Splitting sentence ${sentenceIndex} at boundaries:`, boundariesInSentence);
      
      let currentPos = 0;
      const sentenceText = sentence;
      
      boundariesInSentence.forEach((boundary, boundaryIndex) => {
        const relativePos = boundary - sentenceStart;
        if (relativePos > currentPos && relativePos < sentenceText.length) {
          const part = sentenceText.substring(currentPos, relativePos).trim();
          if (part) {
            result.push(part);
            console.log(`  📄 Added part ${boundaryIndex + 1}: "${part.substring(0, 30)}..."`);
          }
          currentPos = relativePos;
        }
      });
      
      // Add the remaining part after the last boundary
      const remaining = sentenceText.substring(currentPos).trim();
      if (remaining) {
        result.push(remaining);
        console.log(`  📄 Added final part: "${remaining.substring(0, 30)}..."`);
      }
    }
  });
  
  console.log(`✂️ Split ${sentences.length} sentences into ${result.length} paragraph-aware sentences`);
  return result;
}

// TTS Service class to handle all text-to-speech operations
class TTSService {
  constructor() {
    this.isSpeaking = false;
    this.isPaused = false;
  }

  // Speak the given text with specified options
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      // Stop any existing TTS before starting new speech
      chrome.tts.stop();
      
      // Reset TTS service state
      this.isSpeaking = false;
      this.isPaused = false;
      
      const ttsOptions = {
        rate: options.rate || 1.0,
        pitch: options.pitch || 1.0,
        volume: options.volume || 1.0,
        onEvent: (event) => {
            if (event.type === "start") {
            this.isSpeaking = true;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = true;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = true;
            
            // Send message to content script to highlight text
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                // Store the originating tab ID
                globalTTSState.originatingTabId = tabs[0].id;
                console.log('📤 Sending highlight message with boundaries:', globalThis.currentParagraphBoundaries || []);
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: 'highlightText',
                  text: text,
                  action: 'start',
                  paragraphBoundaries: globalThis.currentParagraphBoundaries || []
                });
              }
            });
            // Broadcast control bar to all tabs
            broadcastControlBarState();
          } else if (["end", "error", "interrupted", "cancelled"].includes(event.type)) {
            this.isSpeaking = false;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = false;
            globalTTSState.isPaused = false;
            globalTTSState.showControlBar = false;
            globalTTSState.originatingTabId = null;
            
            // Send message to ALL tabs to remove highlights
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:'))) {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'highlightText',
                    action: 'end'
                  }).catch(() => {
                    // Ignore errors for tabs without content scripts
                  });
                }
              });
            });
            // Broadcast control bar hide to all tabs
            broadcastControlBarState();
          } else if (event.type === "pause") {
            this.isSpeaking = false;
            this.isPaused = true;
            // Update global state
            globalTTSState.isSpeaking = false;
            globalTTSState.isPaused = true;
            
            // Broadcast updated state to all tabs
            broadcastControlBarState();
          } else if (event.type === "resume") {
            this.isSpeaking = true;
            this.isPaused = false;
            // Update global state
            globalTTSState.isSpeaking = true;
            globalTTSState.isPaused = false;
            
            // Broadcast updated state to all tabs
            broadcastControlBarState();
          }
        }
      };

      if (options.voiceName) {
        ttsOptions.voiceName = options.voiceName;
      }

      chrome.tts.speak(text, ttsOptions, () => {
        if (chrome.runtime.lastError) {
          console.error('TTS Speak Error:', chrome.runtime.lastError);
          this.isSpeaking = false;
          this.isPaused = false;
          reject(chrome.runtime.lastError.message);
        } else {
          this.isSpeaking = true;
          this.isPaused = false;
          // Show control bar now that TTS is actually speaking
          showFloatingControlBar();
          resolve({ status: 'speaking' });
        }
      });
    });
  }

  // Stop current TTS playback
  stop() {
    return new Promise((resolve) => {
      chrome.tts.stop();
      this.isSpeaking = false;
      this.isPaused = false;
      resolve({ status: 'stopped' });
    });
  }

  // Pause current TTS playback
  pause() {
    return new Promise((resolve) => {
      chrome.tts.pause();
      this.isSpeaking = false;
      this.isPaused = true;
      resolve({ status: 'paused' });
    });
  }

  // Resume paused TTS playback
  resume() {
    return new Promise((resolve) => {
      chrome.tts.resume();
      this.isSpeaking = true;
      this.isPaused = false;
      resolve({ status: 'resumed' });
    });
  }

  // Get available voices
  getVoices() {
    return new Promise((resolve, reject) => {
      chrome.tts.getVoices((voices) => {
        if (chrome.runtime.lastError) {
          console.error('TTS Get Voices Error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(voices);
        }
      });
    });
  }

  // Check if currently speaking
  getSpeakingStatus() {
    return this.isSpeaking;
  }

  // Get current TTS state
  getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused
    };
  }
}

// Message handler class to manage communication
class MessageHandler {
  constructor(ttsService) {
    this.ttsService = ttsService;
  }

  // Handle incoming messages
  async handleMessage(message, sender, sendResponse) {
    try {
      if (message.type === 'speak') {
        await this.handleSpeak(message, sendResponse);
      } else if (message.type === 'stop') {
        await this.handleStop(sendResponse);
      } else if (message.type === 'pause') {
        await this.handlePause(sendResponse);
      } else if (message.type === 'resume') {
        await this.handleResume(sendResponse);
      } else if (message.type === 'getVoices') {
        await this.handleGetVoices(sendResponse);
      } else if (message.type === 'getStatus') {
        await this.handleGetStatus(sendResponse);
      } else if (message.type === 'getSelectedText') {
        await this.handleGetSelectedText(sendResponse);
      } else if (message.type === 'updateSpeed') {
        await this.handleUpdateSpeed(message, sendResponse);
      } else if (message.type === 'getHighlightingSettings') {
        await this.handleGetHighlightingSettings(sendResponse);
      } else if (message.type === 'saveHighlightingSettings') {
        await this.handleSaveHighlightingSettings(message, sendResponse);
      } else if (message.type === 'getSpeechStatus') {
        await this.handleGetSpeechStatus(sendResponse);
      } else if (message.type === 'testGoogleTTS') {
        await this.handleTestGoogleTTS(message, sendResponse);
      } else if (message.type === 'getQuotaUsage') {
        await this.handleGetQuotaUsage(sendResponse);
      } else if (message.type === 'previewVoice') {
        await this.handlePreviewVoice(message, sendResponse);
      } else if (message.type === 'testGoogleTTSEnabled') {
        await this.handleTestGoogleTTSEnabled(sendResponse);
      } else if (message.type === 'getParagraphBoundaries') {
        sendResponse({ 
          status: 'success', 
          paragraphBoundaries: globalThis.currentParagraphBoundaries || [] 
        });
      } else {
        console.log('Unknown message type:', message.type);
        sendResponse({ status: 'error', error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle speak message
  async handleSpeak(message, sendResponse) {
    if (!message.text || message.text.trim() === '') {
      sendResponse({ status: 'error', error: 'No text provided' });
      return;
    }

    const options = {
      rate: message.rate,
      voiceName: message.voiceName
    };

    try {
      // Use paragraph boundaries from message if provided, otherwise extract them
      let paragraphBoundaries = message.paragraphBoundaries || [];
      
      if (!paragraphBoundaries.length) {
        // Get text with paragraph structure for enhanced sentence highlighting
        const textWithStructure = await getSelectedTextWithStructure();
        paragraphBoundaries = textWithStructure ? textWithStructure.paragraphBoundaries : [];
        
        console.log('📄 Text structure analysis (fallback extraction):', {
          hasStructure: !!textWithStructure,
          textFromStructure: textWithStructure ? textWithStructure.text.substring(0, 100) + '...' : 'null',
          paragraphBoundaries: paragraphBoundaries,
          textLength: message.text.length,
          messageText: message.text.substring(0, 100) + '...'
        });
      } else {
        console.log('📄 Using paragraph boundaries from message:', {
          paragraphBoundaries: paragraphBoundaries,
          textLength: message.text.length,
          messageText: message.text.substring(0, 100) + '...'
        });
      }

      // Store paragraph boundaries globally for both TTS paths
      globalThis.currentParagraphBoundaries = paragraphBoundaries;
      console.log('💾 Stored paragraph boundaries globally:', paragraphBoundaries);

      // Determine if this is a Google TTS voice or Chrome TTS voice
      const isGoogleTTSVoice = await this.isGoogleTTSVoice(message.voiceName);
      const googleTTSEnabled = await googleTTSService.isEnabled();
      
      console.log('🔍 Voice routing decision:', {
        voiceName: message.voiceName,
        isGoogleTTSVoice,
        googleTTSEnabled,
        willUseGoogleTTS: isGoogleTTSVoice && googleTTSEnabled
      });
      
      if (isGoogleTTSVoice && googleTTSEnabled) {
        console.log('🎵 Using Google TTS API with SSML highlighting');
        // Use SSML highlighting for Google TTS voices with paragraph awareness
        const result = await googleTTSService.speakWithHighlighting(message.text, options, paragraphBoundaries);
        sendResponse(result);
        
      } else {
        console.log('🎤 Using Chrome TTS API with paragraph-aware highlighting');
        const result = await this.ttsService.speak(message.text, options);
        sendResponse(result);
      }
      
    } catch (error) {
      // If we were trying to use Google TTS but failed, try fallback to Chrome TTS
      const isGoogleTTSVoice = await this.isGoogleTTSVoice(message.voiceName);
      const googleTTSEnabled = await googleTTSService.isEnabled();
      
      if (isGoogleTTSVoice && googleTTSEnabled) {
        try {
          const result = await this.ttsService.speak(message.text, options);
          sendResponse(result);
        } catch (fallbackError) {
          sendResponse({ status: 'error', error: fallbackError.message || fallbackError });
        }
      } else {
        sendResponse({ status: 'error', error: error.message || error });
      }
    }
  }

  // Check if a voice is a Google TTS voice or Chrome TTS voice
  async isGoogleTTSVoice(voiceName) {
    if (!voiceName) return false;

    // Google TTS voice names follow pattern: language-region-type-variant (e.g. "en-US-Neural2-F")
    const googleVoicePattern = /^[a-z]{2}-[A-Z]{2}-.+/;
    
    if (googleVoicePattern.test(voiceName)) {
      return true;
    }

    // Get the unified voice list to check isGoogle flag
    try {
      const voiceResponse = await new Promise((resolve) => {
        this.handleGetVoices(resolve);
      });
      const voice = voiceResponse.voices?.find(v => v.name === voiceName);
      return voice ? voice.isGoogle : false;
    } catch (error) {
      console.warn('Could not determine voice type for:', voiceName, error);
      return false;
    }
  }

  // Handle stop message
  async handleStop(sendResponse) {
    try {
      // Stop both Chrome TTS and Google TTS
      const chromeResult = await this.ttsService.stop();
      await googleTTSService.stopAudio();
      
      // Update global state
      globalTTSState.isSpeaking = false;
      globalTTSState.isPaused = false;
      globalTTSState.showControlBar = false;
      globalTTSState.originatingTabId = null;
      
      // Explicitly clear highlighting on all tabs immediately
      // This ensures highlights are cleared even if TTS events don't fire properly
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:'))) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'highlightText',
              action: 'end'
            }).catch(() => {
              // Ignore errors for tabs without content scripts
            });
          }
        });
      });
      
      broadcastControlBarState();
      
      sendResponse(chromeResult);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle pause message
  async handlePause(sendResponse) {
    try {
      const result = await this.ttsService.pause();
      // Control bar will be updated by TTS event listener
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle resume message
  async handleResume(sendResponse) {
    try {
      const result = await this.ttsService.resume();
      // Control bar will be updated by TTS event listener
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', error: error });
    }
  }

  // Handle get voices message
  async handleGetVoices(sendResponse) {
    try {
      // Get Chrome TTS voices
      const chromeVoices = await this.ttsService.getVoices();
      
      // Transform Chrome voices to our unified format
      const formattedChromeVoices = chromeVoices.map(voice => ({
        name: voice.voiceName || voice.name,
        lang: voice.lang,
        gender: this.extractGender(voice.voiceName || voice.name),
        quality: 'Standard',
        isGoogle: false,
        eventTypes: voice.eventTypes || []
      }));

      // Get Google TTS voices if enabled
      let googleVoices = [];
      const googleEnabled = await googleTTSService.isEnabled();
      if (googleEnabled) {
        try {
          googleVoices = await googleTTSService.getVoices();
        } catch (googleError) {
          console.warn('Failed to get Google TTS voices:', googleError);
          // Continue with Chrome voices only
        }
      }

      // Combine all voices
      const allVoices = [...formattedChromeVoices, ...googleVoices];
      
      // Sort voices by language, then quality, then name
      allVoices.sort((a, b) => {
        if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
        if (a.quality !== b.quality) {
          const qualityOrder = ['Chirp3', 'Neural2', 'Studio', 'WaveNet', 'Standard'];
          return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        }
        return a.name.localeCompare(b.name);
      });

      sendResponse({ status: 'success', voices: allVoices });
    } catch (error) {
      console.error('Error getting voices:', error);
      sendResponse({ status: 'error', error: error });
    }
  }

  // Helper method to extract gender from Chrome voice name
  extractGender(voiceName) {
    const name = voiceName.toLowerCase();
    if (name.includes('female') || name.includes('woman')) return 'female';
    if (name.includes('male') || name.includes('man')) return 'male';
    // Common male names
    if (name.includes('david') || name.includes('mark') || name.includes('alex')) return 'male';
    // Common female names  
    if (name.includes('zira') || name.includes('hazel') || name.includes('samantha')) return 'female';
    return 'unknown';
  }

  // Handle get status message
  async handleGetStatus(sendResponse) {
    chrome.tts.isSpeaking((speaking) => {
      sendResponse({ status: 'success', isSpeaking: speaking });
    });
  }

  // Handle get selected text message
  async handleGetSelectedText(sendResponse) {
    try {
      const selectedText = await getSelectedTextFromActiveTab();
      sendResponse({ status: 'success', selectedText: selectedText });
    } catch (error) {
      console.error('Error getting selected text:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle update speed message
  async handleUpdateSpeed(message, sendResponse) {
    try {
      if (!message.rate || isNaN(message.rate)) {
        sendResponse({ status: 'error', error: 'Invalid rate provided' });
        return;
      }

      const rate = parseFloat(message.rate);
      
      // Validate rate bounds
      if (rate < 0.1 || rate > 3.0) {
        sendResponse({ status: 'error', error: 'Rate must be between 0.1 and 3.0' });
        return;
      }

      // If TTS is currently speaking, we need to restart it with the new rate
      if (this.ttsService.isSpeaking || this.ttsService.isPaused) {
        // For now, just acknowledge the speed change
        // In a full implementation, we might need to restart current speech with new rate
        sendResponse({ status: 'success', message: 'Speed updated for future speech' });
      } else {
        sendResponse({ status: 'success', message: 'Speed updated' });
      }
    } catch (error) {
      console.error('Error updating speed:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle get highlighting settings message
  async handleGetHighlightingSettings(sendResponse) {
    try {
      const settings = await getHighlightingSettings();
      sendResponse({ status: 'success', settings: settings });
    } catch (error) {
      console.error('Error getting highlighting settings:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle save highlighting settings message
  async handleSaveHighlightingSettings(message, sendResponse) {
    try {
      await saveHighlightingSettings(message.settings);
      sendResponse({ status: 'success', message: 'Settings saved' });
    } catch (error) {
      console.error('Error saving highlighting settings:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle get speech status message
  async handleGetSpeechStatus(sendResponse) {
    const status = this.ttsService.getSpeakingStatus() ? 'speaking' : 'ended';
    sendResponse({ status: 'success', status: status });
  }

  // Handle test Google TTS connection
  async handleTestGoogleTTS(message, sendResponse) {
    try {
      // Basic test of Google TTS API with the provided key
      const testUrl = `https://texttospeech.googleapis.com/v1/voices?key=${message.apiKey}`;
      
      const response = await fetch(testUrl);
      if (response.ok) {
        sendResponse({ status: 'success', success: true });
      } else {
        const errorText = await response.text();
        sendResponse({ status: 'error', success: false, error: `API Error: ${response.status}` });
      }
    } catch (error) {
      sendResponse({ status: 'error', success: false, error: error.message });
    }
  }

  // Handle get quota usage message
  async handleGetQuotaUsage(sendResponse) {
    try {
      const quotaStatus = await googleTTSService.checkQuotaStatus();
      sendResponse({ 
        status: 'success', 
        quota: quotaStatus 
      });
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle preview voice message
  async handlePreviewVoice(message, sendResponse) {
    try {
      const options = {
        rate: message.rate,
        voiceName: message.voiceName
      };

      await this.ttsService.speak(message.text, options);
      sendResponse({ status: 'success' });
    } catch (error) {
      console.error('Error previewing voice:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }

  // Handle test Google TTS enabled message (for debugging)
  async handleTestGoogleTTSEnabled(sendResponse) {
    try {
      const isEnabled = await googleTTSService.isEnabled();
      const apiKey = await googleTTSService.getApiKey();
      
      sendResponse({ 
        status: 'success', 
        enabled: isEnabled,
        hasApiKey: !!apiKey,
        ssmlBuilderAvailable: typeof SSMLBuilder !== 'undefined'
      });
    } catch (error) {
      console.error('Error testing Google TTS enabled:', error);
      sendResponse({ status: 'error', error: error.message });
    }
  }
}

// Initialize services
const ttsService = new TTSService();
const googleTTSService = new GoogleTTSService();
const messageHandler = new MessageHandler(ttsService);

// Store Google TTS text, sentence data, and timing events for highlighting (global scope)
var googleTTSCurrentText = null;
var googleTTSSentenceData = null;
var googleTTSTimepoints = null;

// Function to set Google TTS text (called directly by Google TTS service)
function setGoogleTTSCurrentText(text) {
  googleTTSCurrentText = text;
  console.log('📝 Stored Google TTS text for highlighting:', text ? text.substring(0, 50) + '...' : 'null');
}

// Function to set Google TTS sentence data (called directly by Google TTS service)
function setGoogleTTSSentenceData(sentenceData) {
  googleTTSSentenceData = sentenceData;
  console.log('📝 Stored Google TTS sentence data:', sentenceData ? `${sentenceData.totalSentences} sentences` : 'null');
}

// Function to set Google TTS timepoints (called directly by Google TTS service)
function setGoogleTTSTimepoints(timepoints) {
  googleTTSTimepoints = timepoints;
  console.log('⏰ Stored Google TTS timepoints:', timepoints ? `${timepoints.length} timing events` : 'null');
}

// Make functions globally accessible
globalThis.setGoogleTTSCurrentText = setGoogleTTSCurrentText;
globalThis.setGoogleTTSSentenceData = setGoogleTTSSentenceData;
globalThis.setGoogleTTSTimepoints = setGoogleTTSTimepoints;
globalThis.googleTTSCurrentText = googleTTSCurrentText;
globalThis.googleTTSSentenceData = googleTTSSentenceData;
globalThis.googleTTSTimepoints = googleTTSTimepoints;


// Retry function for highlighting message delivery
async function sendHighlightingMessageWithRetry(tabId, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Failed to send highlighting message after', maxRetries, 'attempts');
        return;
      }
      
      // Wait before retrying, with exponential backoff
      const delay = attempt * 50; // 50ms, 100ms, 150ms
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle control bar position updates
  if (message.type === 'updateControlBarPosition') {
    globalTTSState.controlBarPosition = message.position;
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Handle Google TTS events from offscreen document
  if (message.type === 'googleTTSStarted') {
    globalTTSState.isSpeaking = true;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = true;
    
    // Trigger highlighting if we have stored text (with sentence support)
    if (googleTTSCurrentText) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          globalTTSState.originatingTabId = tabs[0].id;
          
          const highlightMessage = {
            type: 'highlightText',
            text: googleTTSCurrentText,
            action: 'start'
          };
          
          // Add sentence data and timepoints if available
          if (googleTTSSentenceData) {
            highlightMessage.sentenceData = googleTTSSentenceData;
            highlightMessage.mode = 'sentence';
            
            // Add timing events if available
            if (googleTTSTimepoints && googleTTSTimepoints.length > 0) {
              highlightMessage.timepoints = googleTTSTimepoints;
            }
          } else {
            highlightMessage.mode = 'fullSelection';
          }
          
          // Send highlighting message with retry for race condition handling
          sendHighlightingMessageWithRetry(tabs[0].id, highlightMessage, 3);
        }
      });
    }
    
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSEnded') {
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = false;
    globalTTSState.originatingTabId = null;
    
    // Clear highlighting (same as Chrome TTS)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'highlightText',
            action: 'end'
          }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        }
      });
    });
    
    // Clear stored text, sentence data, and timepoints
    googleTTSCurrentText = null;
    googleTTSSentenceData = null;
    googleTTSTimepoints = null;
    
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSPaused') {
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = true;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  if (message.type === 'googleTTSError') {
    console.error('Google TTS error:', message.error);
    globalTTSState.isSpeaking = false;
    globalTTSState.isPaused = false;
    globalTTSState.showControlBar = false;
    broadcastControlBarState();
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Handle quota warning messages
  if (message.type === 'quotaWarning') {
    sendQuotaWarningNotification(message.quotaData);
    sendResponse({ status: 'received' });
    return true;
  }
  
  
  // Handle offscreen document messages (playGoogleTTS, stopGoogleTTS, etc.)
  if (message.type === 'playGoogleTTS' || message.type === 'stopGoogleTTS' || 
      message.type === 'pauseGoogleTTS' || message.type === 'resumeGoogleTTS') {
    // These are handled by the offscreen document, but we need to acknowledge them
    sendResponse({ status: 'received' });
    return true;
  }
  
  // All other messages go to MessageHandler
  messageHandler.handleMessage(message, sender, sendResponse);
  return true;
});

// TTS events are now handled directly in the onEvent callback of each speak() call

// Listen for the open_popup command - toggle between speak and stop
chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open_popup") {
    // Check if TTS is currently speaking
    if (globalTTSState.isSpeaking || globalTTSState.isPaused) {
      // Stop the current TTS
      await messageHandler.handleStop((response) => {});
    } else {
      // Start speaking selected text with structure information
      console.log('🎯 Ctrl+Q: Starting text extraction');
      const textWithStructure = await getSelectedTextWithStructure();
      console.log('🎯 Ctrl+Q: Text structure extracted:', {
        hasText: !!textWithStructure,
        textLength: textWithStructure?.text?.length || 0,
        boundaryCount: textWithStructure?.paragraphBoundaries?.length || 0
      });
      
      if (textWithStructure) {
        // Get last used voice and rate from storage (same keys as popup)
        chrome.storage.sync.get(['savedVoice', 'savedRate'], async (prefs) => {
          const message = {
            type: 'speak',
            text: textWithStructure.text,
            rate: prefs.savedRate ? parseFloat(prefs.savedRate) : 1.0,
            voiceName: prefs.savedVoice,
            paragraphBoundaries: textWithStructure.paragraphBoundaries // Include structure info
          };
          
          console.log('🎯 Ctrl+Q: Calling handleSpeak with message:', {
            textLength: message.text.length,
            boundaryCount: message.paragraphBoundaries?.length || 0,
            voiceName: message.voiceName
          });
          
          // Use the integrated handleSpeak method that includes Google TTS
          await messageHandler.handleSpeak(message, (response) => {
            console.log('🎯 Ctrl+Q: handleSpeak response:', response);
          });
        });
      } else {
        console.log('🎯 Ctrl+Q: No text structure extracted');
      }
    }
  }
});

// Function to show floating control bar on active tab
async function showFloatingControlBar() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      // Inject content script if not already injected
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });
      
      // Send message to show control bar with current state
      const state = ttsService.getState();
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'showControlBar',
        isSpeaking: state.isSpeaking,
        isPaused: state.isPaused
      });
    }
  } catch (error) {
    console.error('Error showing floating control bar:', error);
  }
}

// Function to hide floating control bar
async function hideFloatingControlBar() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'hideControlBar' });
    }
  } catch (error) {
    console.error('Error hiding floating control bar:', error);
  }
}

// Function to update control bar status
async function updateControlBarStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const state = ttsService.getState();
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'updateStatus',
        isSpeaking: state.isSpeaking,
        isPaused: state.isPaused
      });
    }
  } catch (error) {
    console.error('Error updating control bar status:', error);
  }
}

// Listen for tab activation to show control bar on newly activated tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (globalTTSState.showControlBar) {
    try {
      // Get tab info
      const tab = await chrome.tabs.get(activeInfo.tabId);
      
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // Inject content script and show control bar on activated tab
        await chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          files: ['content.js']
        });
        
        // Small delay to ensure content script is loaded
        setTimeout(() => {
          chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'showControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        }, 100);
      }
    } catch (error) {
      // Ignore errors silently
    }
  }
});

// Listen for tab updates (page navigation) to show control bar on new pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && globalTTSState.showControlBar) {
    if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file:')) && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      try {
        // Inject content script and show control bar on updated tab
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'showControlBar',
            isSpeaking: globalTTSState.isSpeaking,
            isPaused: globalTTSState.isPaused,
            position: globalTTSState.controlBarPosition,
            size: globalTTSState.controlBarSize
          }).catch(() => {
            // Ignore errors for tabs that don't support content scripts
          });
        }, 100);
      } catch (error) {
        console.log(`Could not show control bar on updated tab: ${error.message}`);
      }
    }
  }
});

// Settings storage functions
async function getHighlightingSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['highlightingSettings'], (result) => {
      if (result.highlightingSettings) {
        // Merge with defaults to ensure all properties exist
        const settings = { ...DEFAULT_HIGHLIGHTING_SETTINGS, ...result.highlightingSettings };
        resolve(settings);
      } else {
        resolve(DEFAULT_HIGHLIGHTING_SETTINGS);
      }
    });
  });
}

async function saveHighlightingSettings(settings) {
  return new Promise((resolve, reject) => {
    // Validate settings structure
    if (!settings || typeof settings !== 'object') {
      reject(new Error('Invalid settings object'));
      return;
    }

    // Validate per-mode settings structure
    const validModes = ['fullSelection', 'sentence', 'word'];
    for (const mode of validModes) {
      if (settings[mode] && typeof settings[mode] !== 'object') {
        reject(new Error(`Invalid ${mode} settings object`));
        return;
      }
      if (settings[mode] && settings[mode].style && typeof settings[mode].style !== 'object') {
        reject(new Error(`Invalid ${mode} style settings object`));
        return;
      }
    }

    // Validate global settings
    if (settings.global && typeof settings.global !== 'object') {
      reject(new Error('Invalid global settings object'));
      return;
    }

    // Deep merge with existing settings and defaults
    const mergedSettings = deepMerge(DEFAULT_HIGHLIGHTING_SETTINGS, settings);

    chrome.storage.sync.set({ highlightingSettings: mergedSettings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Helper function for deep merging objects
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Initialize default settings on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await getHighlightingSettings();
  } catch (error) {
    console.error('Error loading highlighting settings:', error);
  }
});

// Initialize default settings on extension installation
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await getHighlightingSettings();
  } catch (error) {
    console.error('Error initializing highlighting settings:', error);
  }
});

// Send quota warning notifications
async function sendQuotaWarningNotification(quotaData) {
  // Check if notifications are enabled
  chrome.storage.sync.get(['quotaWarnings'], (settings) => {
    if (settings.quotaWarnings === false) return;

    let message = '';
    let type = 'basic';
    
    if (quotaData.percentage >= 100) {
      message = `Google TTS quota exceeded! ${quotaData.used.toLocaleString()} characters used this month.`;
      type = 'basic';
    } else if (quotaData.percentage >= 95) {
      message = `Google TTS quota at ${quotaData.percentage.toFixed(1)}%! Consider upgrading your plan.`;
      type = 'basic';
    } else if (quotaData.percentage >= 80) {
      message = `Google TTS quota at ${quotaData.percentage.toFixed(1)}%. Monitor usage carefully.`;
      type = 'basic';
    }

    if (message) {
      chrome.notifications.create({
        type: type,
        iconUrl: 'icon48.png',
        title: 'TTS Extension - Quota Warning',
        message: message
      });
    }
  });
}

// Offscreen document management
let offscreenDocumentCreated = false;

async function createOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    
    if (existingContexts.length > 0) {
      offscreenDocumentCreated = true;
      return;
    }
    
    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play Google TTS audio in service worker context'
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    offscreenDocumentCreated = false;
  }
}

async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) {
    return;
  }
  
  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
  } catch (error) {
    console.error('Failed to close offscreen document:', error);
  }
}

// Create offscreen document on startup
createOffscreenDocument();

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSService, MessageHandler, getHighlightingSettings, saveHighlightingSettings };
} 