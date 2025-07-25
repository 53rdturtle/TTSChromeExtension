// SSML Builder utility for Google TTS API

class SSMLBuilder {
  constructor() {
    this.ssmlContent = '';
    this.sentenceDetector = null;
  }

  // Initialize sentence detector if needed
  async initializeSentenceDetector() {
    if (!this.sentenceDetector) {
      // Try to use the more sophisticated SimpleSentenceDetector first
      if (typeof SimpleSentenceDetector !== 'undefined') {
        this.sentenceDetector = new SimpleSentenceDetector();
      } else if (typeof SentenceDetector !== 'undefined') {
        this.sentenceDetector = new SentenceDetector();
        await this.sentenceDetector.initialize();
      } else {
        // Fallback to basic detection
        this.sentenceDetector = {
          detectSentences: (text) => this.basicSentenceDetection(text)
        };
      }
    }
    return this.sentenceDetector;
  }

  // Create SSML for basic text highlighting (full selection)
  static createBasicSSML(text) {
    // Escape any existing SSML/XML characters in the text
    const escapedText = SSMLBuilder.escapeSSMLText(text);
    
    // Wrap the entire text with a mark for highlighting
    const ssml = `<speak>
      <mark name="start"/>
      ${escapedText}
      <mark name="end"/>
    </speak>`;

    return {
      ssml: ssml,
      marks: [
        { name: 'start', type: 'highlight_start', text: text },
        { name: 'end', type: 'highlight_end', text: text }
      ]
    };
  }

  // Create SSML with sentence-level marks for progressive highlighting
  async createSentenceSSML(text, language = 'en', domContainer = null) {
    // If DOM container is provided, use DOM-based detection
    if (domContainer && typeof DOMSentenceDetector !== 'undefined') {
      console.log('🏗️ Using DOM-based sentence detection');
      const domDetector = new DOMSentenceDetector();
      const sentenceData = domDetector.createSentenceData(domContainer);
      return this.buildSSMLFromSentenceData(sentenceData);
    }
    
    // Fallback to text-based detection
    await this.initializeSentenceDetector();
    
    // Get sentence metadata
    const sentenceData = this.sentenceDetector.getSentenceMetadata 
      ? this.sentenceDetector.getSentenceMetadata(text, language)
      : await this.getSentenceDataFallback(text, language);

    return this.buildSSMLFromSentenceData(sentenceData);
  }

  // Build SSML from sentence data (used by both text-based and DOM-based detection)
  buildSSMLFromSentenceData(sentenceData) {
    const sentences = sentenceData.sentences || sentenceData.metadata?.map(m => m.text) || [];
    const metadata = sentenceData.metadata || [];

    if (sentences.length === 0) {
      // Fallback to basic SSML if no sentences detected
      return SSMLBuilder.createBasicSSML('No sentences detected');
    }

    // Build SSML with sentence marks
    let ssml = '<speak>\n';
    const marks = [];
    
    // Add start mark
    ssml += '  <mark name="start"/>\n';
    marks.push({ name: 'start', type: 'speech_start', sentenceId: null });

    // Process each sentence
    sentences.forEach((sentence, index) => {
      const escapedSentence = SSMLBuilder.escapeSSMLText(sentence);
      const startMark = `s${index}`;
      const endMark = `s${index + 1}`;

      // Add sentence start mark
      ssml += `  <mark name="${startMark}"/>\n`;
      marks.push({ 
        name: startMark, 
        type: 'sentence_start', 
        sentenceId: index,
        sentence: sentence,
        metadata: metadata[index] || null
      });

      // Add sentence text
      ssml += `  ${escapedSentence}\n`;

      // Add sentence end mark (except for the last sentence)
      if (index < sentences.length - 1) {
        ssml += `  <mark name="${endMark}"/>\n`;
        marks.push({ 
          name: endMark, 
          type: 'sentence_end', 
          sentenceId: index,
          sentence: sentence
        });
      }
    });

    // Add final end mark
    ssml += '  <mark name="end"/>\n';
    ssml += '</speak>';
    
    marks.push({ name: 'end', type: 'speech_end', sentenceId: null });

    return {
      ssml: ssml,
      marks: marks,
      sentences: sentences,
      metadata: metadata,
      totalSentences: sentences.length,
      highlightingMode: sentenceData.highlightingMode || 'sentence',
      method: sentenceData.method
    };
  }

  // Basic sentence detection fallback
  basicSentenceDetection(text) {
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      sentences: sentences,
      totalSentences: sentences.length,
      method: 'basic_fallback'
    };
  }

  // Fallback sentence data when advanced detector isn't available
  async getSentenceDataFallback(text, language) {
    const result = this.sentenceDetector.detectSentences(text, language);
    
    // Create basic metadata
    const metadata = result.sentences.map((sentence, index) => ({
      id: index,
      text: sentence,
      startPosition: text.indexOf(sentence),
      endPosition: text.indexOf(sentence) + sentence.length,
      length: sentence.length,
      wordCount: sentence.split(/\s+/).length,
      startMark: `s${index}`,
      endMark: `s${index + 1}`
    }));

    return {
      ...result,
      metadata: metadata
    };
  }

  // Static method to create sentence SSML (for backward compatibility)
  static async createSentenceSSML(text, language = 'en') {
    const builder = new SSMLBuilder();
    return await builder.createSentenceSSML(text, language);
  }

  // Escape text content for use in SSML
  static escapeSSMLText(text) {
    return text
      .replace(/&/g, '&amp;')   // Must be first
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Extract plain text from SSML (for character counting, etc.)
  static extractTextFromSSML(ssml) {
    // Remove SSML tags but keep the text content
    return ssml
      .replace(/<speak[^>]*>/gi, '')
      .replace(/<\/speak>/gi, '')
      .replace(/<mark[^>]*\/>/gi, '')
      .replace(/<mark[^>]*>/gi, '')
      .replace(/<\/mark>/gi, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  // Validate SSML structure
  static validateSSML(ssml) {
    try {
      // Basic validation - check for properly formed XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(ssml, 'text/xml');
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return {
          valid: false,
          error: 'Invalid SSML structure: ' + parserError.textContent
        };
      }

      // Check for required speak tag
      const speakTag = doc.querySelector('speak');
      if (!speakTag) {
        return {
          valid: false,
          error: 'SSML must contain a <speak> root element'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'SSML validation failed: ' + error.message
      };
    }
  }

  // Get mark information from SSML
  static extractMarks(ssml) {
    const marks = [];
    const markRegex = /<mark\s+name="([^"]+)"[^>]*\/?>/gi;
    let match;

    while ((match = markRegex.exec(ssml)) !== null) {
      marks.push({
        name: match[1],
        position: match.index
      });
    }

    return marks;
  }

  // Test method to verify SSML functionality
  static createTestSSML() {
    const testText = "This is a test sentence for SSML highlighting.";
    return SSMLBuilder.createBasicSSML(testText);
  }

  // Test sentence SSML creation
  static async testSentenceSSML() {
    const testText = "Hello world! How are you today? This is a comprehensive test of sentence highlighting.";
    const result = await SSMLBuilder.createSentenceSSML(testText);
    
    
    return result;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SSMLBuilder;
} else if (typeof window !== 'undefined') {
  window.SSMLBuilder = SSMLBuilder;
} else {
  // Service worker context - make it globally available
  self.SSMLBuilder = SSMLBuilder;
}