// SSML Builder utility for Google TTS API

class SSMLBuilder {
  constructor() {
    this.ssmlContent = '';
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