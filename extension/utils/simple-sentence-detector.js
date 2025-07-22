// Simple sentence boundary detection for Chrome Extension
// Provides both library-based and fallback detection methods

class SimpleSentenceDetector {
  constructor() {
    this.isLibraryAvailable = false;
    this.segmentFunction = null;
  }

  // Initialize with external library if available (optional)
  initialize() {
    // Check if sentencex is available (from external library)
    if (typeof segment !== 'undefined') {
      this.segmentFunction = segment;
      this.isLibraryAvailable = true;
      console.log('✅ SimpleSentenceDetector: Using sentencex library');
    } else {
      console.log('📝 SimpleSentenceDetector: Using built-in fallback detection');
    }
  }

  // Main sentence detection method
  detectSentences(text, language = 'en') {
    this.initialize();

    if (this.isLibraryAvailable) {
      try {
        const sentences = this.segmentFunction(language, text);
        return this.processResults(sentences, 'sentencex', language);
      } catch (error) {
        console.warn('⚠️ Library detection failed, using fallback:', error);
        return this.fallbackDetection(text);
      }
    } else {
      return this.fallbackDetection(text);
    }
  }

  // Fallback sentence detection using regex (reliable for most cases)
  fallbackDetection(text) {
    // Enhanced regex that handles many common cases
    const sentences = text
      // Split on sentence endings followed by whitespace and capital letter
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      // Handle abbreviations like "Dr. Smith" by rejoining incorrectly split parts
      .reduce((acc, sentence, index, array) => {
        if (index === 0) {
          acc.push(sentence);
          return acc;
        }

        const prevSentence = acc[acc.length - 1];
        const endsWithAbbrev = this.endsWithAbbreviation(prevSentence);
        
        if (endsWithAbbrev) {
          // Rejoin with the previous sentence
          acc[acc.length - 1] = prevSentence + ' ' + sentence;
        } else {
          acc.push(sentence);
        }
        
        return acc;
      }, [])
      // Clean up and filter
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return this.processResults(sentences, 'fallback', 'unknown');
  }

  // Check if text ends with a common abbreviation
  endsWithAbbreviation(text) {
    const commonAbbreviations = [
      'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
      'Inc', 'Ltd', 'Corp', 'Co', 'LLC',
      'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
      'St', 'Ave', 'Blvd', 'Rd', 'Ln',
      'U.S', 'U.K', 'U.N', 'E.U',
      'vs', 'etc', 'i.e', 'e.g', 'cf',
      'No', 'p', 'pp', 'vol', 'ch', 'sec'
    ];

    const words = text.trim().split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (!lastWord) return false;
    
    // Remove trailing punctuation for comparison
    const cleanWord = lastWord.replace(/[.!?]+$/, '');
    
    return commonAbbreviations.some(abbrev => 
      cleanWord.toLowerCase() === abbrev.toLowerCase()
    );
  }

  // Process detection results into standard format
  processResults(sentences, method, language) {
    const cleanSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      sentences: cleanSentences,
      totalSentences: cleanSentences.length,
      method: method,
      language: language
    };
  }

  // Get sentence metadata for SSML generation
  getSentenceMetadata(text, language = 'en') {
    const result = this.detectSentences(text, language);
    
    let textPosition = 0;
    const metadata = result.sentences.map((sentence, index) => {
      // Find the sentence position in the original text
      const sentenceStart = text.indexOf(sentence, textPosition);
      const sentenceEnd = sentenceStart + sentence.length;
      
      // Update position for next search
      textPosition = sentenceEnd;
      
      // Calculate word count
      const wordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;
      
      return {
        id: index,
        text: sentence,
        startPosition: sentenceStart >= 0 ? sentenceStart : textPosition,
        endPosition: sentenceStart >= 0 ? sentenceEnd : textPosition + sentence.length,
        length: sentence.length,
        wordCount: wordCount,
        startMark: `s${index}`,
        endMark: `s${index + 1}`,
        // Estimate reading time (average 200 words per minute)
        estimatedDuration: Math.max(1, Math.round((wordCount / 200) * 60 * 1000)) // in milliseconds
      };
    });

    return {
      ...result,
      metadata: metadata,
      totalWords: metadata.reduce((sum, m) => sum + m.wordCount, 0),
      estimatedTotalDuration: metadata.reduce((sum, m) => sum + m.estimatedDuration, 0)
    };
  }

  // Test the detector
  test() {
    const testTexts = [
      "Hello world! How are you today? This is a test.",
      "Dr. Smith went to the U.S.A. on Jan. 1st. He met Prof. Johnson there.",
      "What?! Really... I can't believe it. \"Amazing,\" she said.",
      "Visit https://example.com. Contact us at info@example.com.",
      "The temperature was 98.6°F today. We left at 3:30 p.m."
    ];

    console.log('🧪 Testing SimpleSentenceDetector:');
    
    testTexts.forEach((text, i) => {
      const result = this.detectSentences(text);
      console.log(`\nTest ${i + 1}: "${text}"`);
      console.log(`Method: ${result.method}, Sentences: ${result.totalSentences}`);
      result.sentences.forEach((sentence, idx) => {
        console.log(`  ${idx + 1}: "${sentence}"`);
      });
    });
  }

  // Performance test
  performanceTest() {
    const longText = "This is a performance test sentence. ".repeat(100) + 
                    "It tests how quickly we can process many sentences. " +
                    "The detector should handle this efficiently.";
    
    const startTime = performance.now();
    const result = this.detectSentences(longText);
    const endTime = performance.now();
    
    console.log('⚡ Performance Test Results:');
    console.log(`- Text length: ${longText.length} characters`);
    console.log(`- Sentences detected: ${result.totalSentences}`);
    console.log(`- Processing time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`- Method used: ${result.method}`);
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = SimpleSentenceDetector;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.SimpleSentenceDetector = SimpleSentenceDetector;
} else {
  // Service worker environment
  self.SimpleSentenceDetector = SimpleSentenceDetector;
}