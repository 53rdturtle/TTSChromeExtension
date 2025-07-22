// Sentence boundary detection utility for Chrome Extension
// Wraps sentencex-js library for browser compatibility

// Import the sentencex library content (will be loaded via importScripts)
// The actual sentencex code will be loaded separately

class SentenceDetector {
  constructor() {
    this.isInitialized = false;
    this.segment = null;
  }

  // Initialize the detector (for service worker context)
  async initialize() {
    if (this.isInitialized) return;

    try {
      // For service worker context, we need to ensure sentencex is available
      if (typeof segment !== 'undefined') {
        this.segment = segment;
        this.isInitialized = true;
        console.log('✅ SentenceDetector initialized with sentencex');
        return;
      }

      // Fallback initialization
      console.warn('⚠️ sentencex not available, using fallback sentence detection');
      this.segment = this.fallbackSegment;
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize SentenceDetector:', error);
      this.segment = this.fallbackSegment;
      this.isInitialized = true;
    }
  }

  // Main sentence detection method
  async detectSentences(text, language = 'en') {
    await this.initialize();
    
    try {
      // Use sentencex-js for accurate detection
      const sentences = this.segment(language, text);
      
      // Clean and validate sentences
      const cleanSentences = sentences
        .map(s => s.trim())
        .filter(s => s.length > 0);

      return {
        sentences: cleanSentences,
        totalSentences: cleanSentences.length,
        method: 'sentencex',
        language: language
      };
    } catch (error) {
      console.warn('⚠️ sentencex failed, using fallback:', error);
      return this.fallbackDetection(text);
    }
  }

  // Fallback sentence detection using regex (backup method)
  fallbackDetection(text) {
    // Simple but effective regex-based sentence detection
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      sentences: sentences,
      totalSentences: sentences.length,
      method: 'fallback',
      language: 'unknown'
    };
  }

  // Fallback segment function for when sentencex is not available
  fallbackSegment(language, text) {
    // Basic sentence splitting with regex
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // Test the detector with sample text
  async test() {
    const testTexts = [
      "Hello world! How are you today? This is a test.",
      "Dr. Smith went to the U.S.A. on Jan. 1st. He met Prof. Johnson there.",
      "What?! Really... I can't believe it. \"Amazing,\" she said."
    ];

    console.log('🧪 Testing SentenceDetector:');
    
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      const result = await this.detectSentences(text);
      
      console.log(`\nTest ${i + 1}: "${text}"`);
      console.log(`Method: ${result.method}, Language: ${result.language}`);
      console.log(`Sentences (${result.totalSentences}):`);
      result.sentences.forEach((sentence, idx) => {
        console.log(`  ${idx + 1}: "${sentence}"`);
      });
    }
  }

  // Get sentence metadata for SSML generation
  async getSentenceMetadata(text, language = 'en') {
    const result = await this.detectSentences(text, language);
    
    const metadata = result.sentences.map((sentence, index) => {
      // Calculate approximate position in original text
      const startPos = text.indexOf(sentence);
      const endPos = startPos + sentence.length;
      
      return {
        id: index,
        text: sentence,
        startPosition: startPos,
        endPosition: endPos,
        length: sentence.length,
        wordCount: sentence.split(/\s+/).length,
        startMark: `s${index}`,
        endMark: `s${index + 1}`
      };
    });

    return {
      ...result,
      metadata: metadata
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = SentenceDetector;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.SentenceDetector = SentenceDetector;
} else {
  // Service worker environment
  self.SentenceDetector = SentenceDetector;
}