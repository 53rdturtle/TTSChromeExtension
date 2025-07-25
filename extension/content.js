// Content script for TTS Chrome Extension
// Handles floating control bar display and text highlighting

// Prevent multiple injections of the same script
if (typeof window.TTSContentScriptLoaded !== 'undefined') {
  console.log('🔄 TTS Content script already loaded, skipping re-initialization');
} else {
  window.TTSContentScriptLoaded = true;
  console.log('🚀 Initializing TTS Content script');

// TextHighlighter class to handle text highlighting during TTS
class TextHighlighter {
  constructor() {
    this.highlightedElements = [];
    this.originalSelection = null;
    
    // Sentence highlighting support
    this.currentSentenceIndex = -1;
    this.sentenceElements = [];
    this.sentenceData = null;
    this.sentenceTimer = null;
    this.speechStartTime = null;
    this.timepoints = null;
    
    // Layered highlighting support for different modes
    this.highlightLayers = {
      fullSelection: [],
      sentence: [],
      word: []
    };
    this.currentMode = 'fullSelection';
  }

  // Highlight the selected text
  highlightText(text) {
    this.clearHighlights();
    
    // Store current selection
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    this.originalSelection = selection.getRangeAt(0).cloneRange();
    
    // Create highlight spans for the selected text
    const range = selection.getRangeAt(0);
    this.highlightRange(range);
    
    // Clear the selection to avoid blue highlight conflicting with yellow highlight
    selection.removeAllRanges();
  }

  // Apply highlighting to a range
  highlightRange(range, isSentence = false) {
    if (range.collapsed) return;
    
    try {
      // Try simple surroundContents first for single-element ranges
      try {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = isSentence ? 'tts-sentence-highlight' : 'tts-highlight';
        
        if (isSentence) {
          highlightSpan.style.cssText = `
            background-color: #4caf50 !important;
            color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 2px !important;
            box-shadow: 0 0 3px rgba(76, 175, 80, 0.5) !important;
            display: inline !important;
            position: static !important;
            transition: all 0.3s ease !important;
          `;
        } else {
          highlightSpan.style.cssText = `
            background-color: #ffeb3b !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            display: inline !important;
            position: static !important;
            transition: all 0.2s ease !important;
          `;
        }
        
        range.surroundContents(highlightSpan);
        this.highlightedElements.push(highlightSpan);
      } catch (e) {
        // If surroundContents fails, use a more robust approach
        // that preserves the original DOM structure
        this.highlightComplexRange(range, isSentence);
      }
    } catch (error) {
    }
  }

  // Handle complex ranges that span multiple elements
  highlightComplexRange(range, isSentence = false) {
    // Create a TreeWalker to traverse text nodes in the range
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Check if this text node intersects with our range
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          
          // Check if the node is within the selection range
          if (range.intersectsNode && range.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          // Fallback for older browsers
          try {
            return (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
                    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0) 
                    ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch (e) {
            return NodeFilter.FILTER_REJECT;
          }
        }
      }
    );

    const textNodes = [];
    let node;
    
    // Collect all text nodes in the range
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Highlight each text node separately
    textNodes.forEach(textNode => {
      try {
        // Create a range for this text node
        const textRange = document.createRange();
        textRange.selectNodeContents(textNode);
        
        // Adjust range boundaries if needed
        if (textNode === range.startContainer) {
          textRange.setStart(textNode, range.startOffset);
        }
        if (textNode === range.endContainer) {
          textRange.setEnd(textNode, range.endOffset);
        }
        
        // Only highlight if there's actual content
        if (!textRange.collapsed && textRange.toString().trim()) {
          const highlightSpan = document.createElement('span');
          highlightSpan.className = isSentence ? 'tts-sentence-highlight' : 'tts-highlight';
          
          if (isSentence) {
            highlightSpan.style.cssText = `
              background-color: #4caf50 !important;
              color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              border-radius: 2px !important;
              box-shadow: 0 0 3px rgba(76, 175, 80, 0.5) !important;
              display: inline !important;
              position: static !important;
              transition: all 0.3s ease !important;
            `;
          } else {
            highlightSpan.style.cssText = `
              background-color: #ffeb3b !important;
              color: #000 !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              display: inline !important;
              position: static !important;
              transition: all 0.2s ease !important;
            `;
          }
          
          textRange.surroundContents(highlightSpan);
          this.highlightedElements.push(highlightSpan);
        }
      } catch (e) {
      }
    });
  }

  // Clear all highlights
  clearHighlights() {
    this.highlightedElements.forEach(element => {
      if (element.parentNode) {
        // Move the contents back to the parent and remove the highlight span
        const parent = element.parentNode;
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        
        // Normalize the parent to merge adjacent text nodes
        parent.normalize();
      }
    });
    
    this.highlightedElements = [];
    
    // Clear sentence highlighting data
    this.clearSentenceHighlights();
  }

  // Initialize sentence highlighting mode
  initializeSentenceHighlighting(text, sentenceData, timepoints = null) {
    this.currentMode = 'sentence';
    this.sentenceData = sentenceData;
    this.currentSentenceIndex = -1;
    this.sentenceElements = [];
    this.timepoints = timepoints;
    
    
    // Store the original selection for sentence-based highlighting
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      this.originalSelection = selection.getRangeAt(0).cloneRange();
    }
    
    // Clear the selection to avoid blue highlight conflicting with sentence highlighting
    selection.removeAllRanges();
    
    // Pre-process sentences for faster highlighting
    this.preprocessSentences();
  }

  // Pre-process sentences to identify their positions in the DOM
  preprocessSentences() {
    if (!this.originalSelection || !this.sentenceData) {
      console.warn('Missing originalSelection or sentenceData for preprocessing');
      return;
    }
    
    // Defensive check for sentence data structure
    if (!this.sentenceData.sentences || this.sentenceData.sentences.length === 0) {
      console.warn('No sentences detected, falling back to basic highlighting');
      // Fallback to basic text highlighting instead of crashing
      return;
    }
    
    const originalText = this.originalSelection.toString();
    this.sentenceElements = [];
    
    // Get all text nodes in the original selection before any modifications
    const allTextNodes = this.getTextNodesInRange(this.originalSelection);
    
    let searchFromPos = 0;
    this.sentenceData.sentences.forEach((sentence, index) => {
      // Find sentence position in original text, starting from where we left off
      const sentenceStart = originalText.indexOf(sentence, searchFromPos);
      
      if (sentenceStart >= 0) {
        const sentenceEnd = sentenceStart + sentence.length;
        
        // Find which text nodes contain this sentence
        const sentenceNodeData = this.findSentenceInTextNodes(allTextNodes, sentenceStart, sentenceEnd);
        
        this.sentenceElements.push({
          index: index,
          sentence: sentence,
          startPosition: sentenceStart,
          endPosition: sentenceEnd,
          sentenceData: {
            textNodes: allTextNodes,
            startNodeIndex: sentenceNodeData.startNodeIndex,
            startOffset: sentenceNodeData.startOffset,
            endNodeIndex: sentenceNodeData.endNodeIndex,
            endOffset: sentenceNodeData.endOffset
          },
          highlighted: false,
          elements: []
        });
        
        // Move search position forward to avoid finding the same sentence again
        searchFromPos = sentenceEnd;
      }
    });
  }

  // Create a range for a specific sentence within the original selection
  createSentenceRange(sentence, startOffset) {
    if (!this.originalSelection) {
      return null;
    }
    
    try {
      // Use a different approach: find the sentence text within the selection
      const originalRange = this.originalSelection.cloneRange();
      const originalText = this.originalSelection.toString();
      
      // Find the actual position of the sentence in the original text
      const sentenceStart = originalText.indexOf(sentence, startOffset);
      if (sentenceStart === -1) {
        return null;
      }
      
      // Create a range by walking through text nodes to find the correct position
      const result = this.createRangeFromTextPosition(originalRange, sentenceStart, sentence.length);
      return result;
      
    } catch (error) {
      return null;
    }
  }

  // Helper method to get all text nodes within a range
  getTextNodesInRange(range) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      // Check if this text node intersects with our range
      if (range.intersectsNode(node)) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  // Helper method to find which text nodes contain a sentence
  findSentenceInTextNodes(textNodes, sentenceStart, sentenceEnd) {
    let currentPos = 0;
    let startNodeIndex = -1;
    let startOffset = 0;
    let endNodeIndex = -1;
    let endOffset = 0;
    
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const nodeLength = node.textContent.length;
      
      // Check if this node contains the sentence start
      if (startNodeIndex === -1 && currentPos + nodeLength > sentenceStart) {
        startNodeIndex = i;
        startOffset = sentenceStart - currentPos;
      }
      
      // Check if this node contains the sentence end
      if (currentPos + nodeLength >= sentenceEnd) {
        endNodeIndex = i;
        endOffset = sentenceEnd - currentPos;
        break;
      }
      
      currentPos += nodeLength;
    }
    
    return { startNodeIndex, startOffset, endNodeIndex, endOffset };
  }

  // Highlight text using preprocessed text node data
  highlightFromTextNodes(textNodes, startNodeIndex, startOffset, endNodeIndex, endOffset, sentenceElement) {
    console.log('🔍 Highlighting from text nodes:', startNodeIndex, startOffset, endNodeIndex, endOffset);
    
    try {
      const highlightElements = [];
      
      // Handle highlighting across the node range
      for (let i = startNodeIndex; i <= endNodeIndex; i++) {
        const node = textNodes[i];
        if (!node || !node.parentNode) {
          console.warn(`⚠️ Text node ${i} is no longer valid, skipping`);
          continue;
        }
        
        let nodeStartOffset = 0;
        let nodeEndOffset = node.textContent.length;
        
        // Adjust offsets for first and last nodes
        if (i === startNodeIndex) {
          nodeStartOffset = startOffset;
        }
        if (i === endNodeIndex) {
          nodeEndOffset = endOffset;
        }
        
        // Extract the text to highlight from this node
        const textToHighlight = node.textContent.substring(nodeStartOffset, nodeEndOffset);
        
        if (textToHighlight.trim()) {
          // Create highlight span
          const span = document.createElement('span');
          span.className = 'tts-sentence-highlight';
          span.style.cssText = `
            background-color: rgba(255, 235, 59, 0.8) !important;
            color: inherit !important;
            border-radius: 3px !important;
            padding: 1px 2px !important;
          `;
          span.textContent = textToHighlight;
          
          // Replace or split the text node
          if (nodeStartOffset === 0 && nodeEndOffset === node.textContent.length) {
            // Replace entire node
            node.parentNode.replaceChild(span, node);
          } else {
            // Split the text node
            const beforeText = node.textContent.substring(0, nodeStartOffset);
            const afterText = node.textContent.substring(nodeEndOffset);
            
            node.textContent = beforeText;
            
            if (afterText) {
              const afterNode = document.createTextNode(afterText);
              node.parentNode.insertBefore(afterNode, node.nextSibling);
              node.parentNode.insertBefore(span, afterNode);
            } else {
              node.parentNode.insertBefore(span, node.nextSibling);
            }
          }
          
          highlightElements.push(span);
        }
      }
      
      // Store elements for cleanup
      sentenceElement.elements = highlightElements;
      sentenceElement.highlighted = true;
      
      console.log('✅ Successfully highlighted', highlightElements.length, 'elements using text nodes');
      
    } catch (error) {
      console.error('❌ Text node highlighting failed:', error);
    }
  }

  // Helper method to create a range from text positions within a selection
  createRangeFromTextPosition(baseRange, startPos, length) {
    try {
      // Get all text nodes within the base range using a simpler approach
      const textNodes = this.getTextNodesInRange(baseRange);
      
      let currentPos = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;
      const endPos = startPos + length;

      // Walk through text nodes to find start and end positions
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const nodeText = node.textContent;
        const nodeLength = nodeText.length;

        // Check if this node contains our start position
        if (startNode === null && currentPos + nodeLength > startPos) {
          startNode = node;
          startOffset = startPos - currentPos;
        }

        // Check if this node contains our end position
        if (currentPos + nodeLength >= endPos) {
          endNode = node;
          endOffset = endPos - currentPos;
          break;
        }

        currentPos += nodeLength;
      }

      // Create the range if we found valid positions
      if (startNode && endNode) {
        const sentenceRange = document.createRange();
        sentenceRange.setStart(startNode, Math.max(0, startOffset));
        sentenceRange.setEnd(endNode, Math.min(endNode.textContent.length, endOffset));
        return sentenceRange;
      }

      return null;
    } catch (error) {
      console.error('Error creating range from text position:', error);
      return null;
    }
  }

  // Create a simple fallback range for a sentence by searching in the original selection
  createFallbackSentenceRange(sentence) {
    if (!this.originalSelection) return null;

    try {
      // Simple approach: search for the sentence text within the current selection
      const originalText = this.originalSelection.toString();
      const sentenceStart = originalText.indexOf(sentence);
      
      if (sentenceStart === -1) {
        console.warn('Sentence not found in selection:', sentence);
        return null;
      }

      // For now, just return the entire selection as fallback
      // This ensures something gets highlighted even if precise positioning fails
      console.log('📝 Using full selection as fallback for sentence highlighting');
      return this.originalSelection.cloneRange();
      
    } catch (error) {
      console.error('Error creating fallback sentence range:', error);
      return null;
    }
  }

  // Highlight a specific sentence
  highlightSentence(sentenceIndex) {
    if (!this.sentenceElements || sentenceIndex >= this.sentenceElements.length) {
      console.warn('Invalid sentence index:', sentenceIndex);
      return;
    }

    // Clear previous sentence highlighting
    this.clearCurrentSentence();
    
    const sentenceElement = this.sentenceElements[sentenceIndex];
    if (!sentenceElement) {
      console.warn('No sentence element available for index:', sentenceIndex);
      return;
    }


    this.currentSentenceIndex = sentenceIndex;
    
    // Check if we have preprocessed sentence data
    if (sentenceElement.sentenceData) {
      console.log('🎯 Using preprocessed sentence data for highlighting');
      this.highlightPreprocessedRange(sentenceElement);
    } else {
      console.warn('⚠️ No preprocessed data available, using fallback highlighting');
      // Fallback: Use text-based highlighting for this sentence
      this.highlightSentenceByText(sentenceElement);
    }
  }

  // Use the preprocessed range for highlighting  
  highlightPreprocessedRange(sentenceElement) {
    console.log('🔍 Using progressive sentence highlighting');
    
    // Clear only the previous sentence's highlighting, keep the text structure intact
    this.clearPreviousSentenceOnly();
    
    // Use a text search approach that works even with modified DOM
    this.highlightSentenceByTextSearch(sentenceElement);
  }
  
  // Clear only the previous sentence highlighting, not all
  clearPreviousSentenceOnly() {
    if (this.currentSentenceIndex >= 0 && this.sentenceElements[this.currentSentenceIndex]) {
      const prevSentence = this.sentenceElements[this.currentSentenceIndex];
      if (prevSentence.elements && prevSentence.elements.length > 0) {
        console.log('🔄 Clearing previous sentence highlighting');
        prevSentence.elements.forEach(element => {
          if (element.parentNode) {
            // Replace highlight span with its text content
            const textNode = document.createTextNode(element.textContent);
            element.parentNode.replaceChild(textNode, element);
          }
        });
        prevSentence.elements = [];
        prevSentence.highlighted = false;
      }
    }
  }
  
  // Highlight sentence using text search that works with modified DOM
  highlightSentenceByTextSearch(sentenceElement) {
    console.log('🔍 Highlighting sentence using text search approach');
    
    try {
      const sentenceText = sentenceElement.sentence;
      
      // First try: Look for complete sentence in a single text node
      if (this.highlightSentenceInSingleNode(sentenceText, sentenceElement)) {
        return;
      }
      
      // Second try: Handle sentence spanning multiple text nodes
      console.log('🔍 Sentence not found in single node, trying multi-node approach');
      this.highlightSentenceAcrossNodes(sentenceText, sentenceElement);
      
    } catch (error) {
      console.error('❌ Text search highlighting failed:', error);
    }
  }
  
  // Try to find and highlight sentence in a single text node
  highlightSentenceInSingleNode(sentenceText, sentenceElement) {
    const walker = document.createTreeWalker(
      this.originalSelection.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent;
      const sentenceIndex = nodeText.indexOf(sentenceText);
      
      if (sentenceIndex >= 0) {
        console.log('🔍 Found complete sentence in single text node:', nodeText.substring(0, 30));
        this.insertHighlightSpan(node, sentenceIndex, sentenceText, sentenceElement);
        return true;
      }
    }
    
    return false;
  }
  
  // Handle sentence that spans multiple text nodes
  highlightSentenceAcrossNodes(sentenceText, sentenceElement) {
    // Get all text content from the selection area and find the sentence
    const walker = document.createTreeWalker(
      this.originalSelection.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes = [];
    let allText = '';
    let node;
    
    while (node = walker.nextNode()) {
      textNodes.push({
        node: node,
        text: node.textContent,
        startPos: allText.length
      });
      allText += node.textContent;
    }
    
    // Find the sentence in the combined text
    const sentenceIndex = allText.indexOf(sentenceText);
    if (sentenceIndex === -1) {
      console.warn('⚠️ Could not find sentence in combined text content');
      return;
    }
    
    console.log('🔍 Found sentence spanning nodes at position', sentenceIndex);
    
    // Find which nodes contain the sentence start and end
    const sentenceEnd = sentenceIndex + sentenceText.length;
    const highlightElements = [];
    
    for (let i = 0; i < textNodes.length; i++) {
      const nodeData = textNodes[i];
      const nodeStart = nodeData.startPos;
      const nodeEnd = nodeStart + nodeData.text.length;
      
      // Check if this node overlaps with the sentence
      if (nodeEnd > sentenceIndex && nodeStart < sentenceEnd) {
        const overlapStart = Math.max(sentenceIndex, nodeStart) - nodeStart;
        const overlapEnd = Math.min(sentenceEnd, nodeEnd) - nodeStart;
        const overlapText = nodeData.text.substring(overlapStart, overlapEnd);
        
        if (overlapText.trim()) {
          console.log(`🔍 Highlighting part "${overlapText}" in node ${i}`);
          const span = this.createHighlightSpan(overlapText);
          
          // Split and replace the text node
          this.replaceTextInNode(nodeData.node, overlapStart, overlapEnd, span);
          highlightElements.push(span);
        }
      }
    }
    
    // Store all highlight elements
    sentenceElement.elements = highlightElements;
    sentenceElement.highlighted = true;
    
    console.log('✅ Successfully highlighted sentence across', highlightElements.length, 'nodes');
  }
  
  // Insert highlight span in a single text node
  insertHighlightSpan(node, sentenceIndex, sentenceText, sentenceElement) {
    const span = this.createHighlightSpan(sentenceText);
    this.replaceTextInNode(node, sentenceIndex, sentenceIndex + sentenceText.length, span);
    
    sentenceElement.elements = [span];
    sentenceElement.highlighted = true;
    
    console.log('✅ Successfully highlighted sentence using single node');
  }
  
  // Create a highlight span element
  createHighlightSpan(text) {
    const span = document.createElement('span');
    span.className = 'tts-sentence-highlight';
    span.style.cssText = `
      background-color: rgba(255, 235, 59, 0.8) !important;
      color: inherit !important;
      border-radius: 3px !important;
      padding: 1px 2px !important;
    `;
    span.textContent = text;
    return span;
  }
  
  // Replace part of a text node with a highlight span
  replaceTextInNode(node, startOffset, endOffset, span) {
    const nodeText = node.textContent;
    const beforeText = nodeText.substring(0, startOffset);
    const afterText = nodeText.substring(endOffset);
    
    if (beforeText) {
      node.textContent = beforeText;
      if (afterText) {
        const afterNode = document.createTextNode(afterText);
        node.parentNode.insertBefore(span, node.nextSibling);
        node.parentNode.insertBefore(afterNode, span.nextSibling);
      } else {
        node.parentNode.insertBefore(span, node.nextSibling);
      }
    } else {
      if (afterText) {
        node.textContent = afterText;
        node.parentNode.insertBefore(span, node);
      } else {
        node.parentNode.replaceChild(span, node);
      }
    }
  }

  // Complex highlighting method that handles cross-element ranges
  highlightRangeComplex(range, sentenceElement) {
    console.log('🔍 Using complex highlighting for cross-element range');
    
    try {
      // Extract all text nodes within the range
      const textNodes = [];
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (range.intersectsNode(node)) {
          textNodes.push(node);
        }
      }
      
      console.log('🔍 Found', textNodes.length, 'text nodes in range');
      
      // Create highlight spans for each text node segment
      const highlightElements = [];
      
      textNodes.forEach((textNode, index) => {
        try {
          // Determine the portion of this text node that's within our range
          let startOffset = 0;
          let endOffset = textNode.textContent.length;
          
          // Adjust offsets for first and last nodes
          if (index === 0 && textNode === range.startContainer) {
            startOffset = range.startOffset;
          }
          if (index === textNodes.length - 1 && textNode === range.endContainer) {
            endOffset = range.endOffset;
          }
          
          // Extract the text to highlight
          const textToHighlight = textNode.textContent.substring(startOffset, endOffset);
          
          if (textToHighlight.trim()) {
            // Create highlight span
            const span = document.createElement('span');
            span.className = 'tts-sentence-highlight';
            span.style.cssText = `
              background-color: rgba(255, 235, 59, 0.8) !important;
              color: inherit !important;
              border-radius: 3px !important;
              padding: 1px 2px !important;
            `;
            span.textContent = textToHighlight;
            
            // Replace the text node content
            if (startOffset === 0 && endOffset === textNode.textContent.length) {
              // Replace entire node
              textNode.parentNode.replaceChild(span, textNode);
            } else {
              // Split the text node and insert highlight
              const beforeText = textNode.textContent.substring(0, startOffset);
              const afterText = textNode.textContent.substring(endOffset);
              
              textNode.textContent = beforeText;
              
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                textNode.parentNode.insertBefore(afterNode, textNode.nextSibling);
                textNode.parentNode.insertBefore(span, afterNode);
              } else {
                textNode.parentNode.insertBefore(span, textNode.nextSibling);
              }
            }
            
            highlightElements.push(span);
          }
        } catch (nodeError) {
          console.warn('⚠️ Failed to highlight text node:', nodeError);
        }
      });
      
      // Store elements for cleanup
      sentenceElement.elements = highlightElements;
      sentenceElement.highlighted = true;
      
      console.log('✅ Successfully highlighted', highlightElements.length, 'elements with complex method');
      
    } catch (error) {
      console.error('❌ Complex highlighting failed:', error);
    }
  }

  // Simple text-based highlighting fallback for when ranges fail
  highlightSentenceByText(sentenceElement) {
    if (!this.originalSelection) return;
    
    console.log('📝 Using text-based highlighting fallback for:', sentenceElement.sentence.substring(0, 30));
    
    // Try to use the more robust highlighting approach that works with complex DOM structures
    try {
      // Create a fresh range for this sentence
      const range = this.createRangeFromTextPosition(
        this.originalSelection, 
        sentenceElement.startPosition, 
        sentenceElement.endPosition - sentenceElement.startPosition
      );
      
      if (range) {
        // Use the complex highlighting method that handles cross-element ranges
        this.highlightRangeComplex(range, sentenceElement);
      } else {
        console.warn('⚠️ Could not create range for text-based fallback');
      }
    } catch (error) {
      console.error('❌ Text-based highlighting failed:', error);
    }
  }

  // Handle complex sentence highlighting using position-based approach
  highlightSentenceComplex(sentenceElement) {
    console.log('🔍 Using position-based highlighting approach');
    
    // Use the stored position data from preprocessing
    const sentenceStart = sentenceElement.startPosition;
    const sentenceEnd = sentenceElement.endPosition;
    const sentenceText = sentenceElement.sentence;
    
    if (sentenceStart === undefined || sentenceEnd === undefined) {
      console.error('❌ No position data available for sentence');
      return;
    }
    
    console.log(`🔍 Using stored sentence position ${sentenceStart}-${sentenceEnd} in original text`);
    
    // Create a fresh range for this sentence from the original selection
    try {
      const sentenceRange = document.createRange();
      const originalRange = this.originalSelection.cloneRange();
      
      // Walk through the original selection to find the correct start and end positions
      let currentPos = 0;
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      
      const walker = document.createTreeWalker(
        originalRange.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        const nodeText = node.textContent;
        const nodeLength = nodeText.length;
        
        // Check if this node contains our sentence start
        if (!startNode && currentPos + nodeLength > sentenceStart) {
          startNode = node;
          startOffset = sentenceStart - currentPos;
        }
        
        // Check if this node contains our sentence end
        if (!endNode && currentPos + nodeLength >= sentenceEnd) {
          endNode = node;
          endOffset = sentenceEnd - currentPos;
          break;
        }
        
        currentPos += nodeLength;
      }
      
      if (startNode && endNode) {
        sentenceRange.setStart(startNode, startOffset);
        sentenceRange.setEnd(endNode, endOffset);
        
        
        // Now highlight this range
        this.highlightFreshRange(sentenceRange, sentenceElement);
      } else {
        console.error('❌ Could not create range nodes for sentence');
      }
      
    } catch (error) {
      console.error('❌ Error creating fresh sentence range:', error);
    }
  }
  
  // Highlight a fresh range without complex logic
  highlightFreshRange(range, sentenceElement) {
    try {
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'tts-sentence-highlight';
      highlightSpan.style.cssText = `
        background-color: #4caf50 !important;
        color: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        border-radius: 2px !important;
        box-shadow: 0 0 3px rgba(76, 175, 80, 0.5) !important;
        display: inline !important;
        position: static !important;
        transition: all 0.3s ease !important;
      `;
      
      range.surroundContents(highlightSpan);
      sentenceElement.elements.push(highlightSpan);
      this.highlightLayers.sentence.push(highlightSpan);
      sentenceElement.highlighted = true;
      console.log('✅ Successfully highlighted sentence range:', range.toString().substring(0, 40));
      
    } catch (surroundError) {
      console.warn('❌ surroundContents failed, using text-based fallback:', surroundError);
      // If surroundContents fails, fall back to full selection highlighting
      this.highlightSentenceByText(sentenceElement);
    }
  }

  // Clear current sentence highlighting
  clearCurrentSentence() {
    // Clear all sentence highlighting, not just current
    this.sentenceElements.forEach(sentenceElement => {
      if (sentenceElement.elements && sentenceElement.elements.length > 0) {
        sentenceElement.elements.forEach(element => {
          if (element.parentNode) {
            const parent = element.parentNode;
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            parent.normalize();
          }
        });
        sentenceElement.elements = [];
        sentenceElement.highlighted = false;
      }
    });
    
    // Clear sentence layer
    this.highlightLayers.sentence = [];
  }

  // Clear all sentence highlighting
  clearSentenceHighlights() {
    this.clearCurrentSentence();
    this.currentSentenceIndex = -1;
    this.sentenceElements = [];
    this.sentenceData = null;
    this.currentMode = 'fullSelection';
  }

  // Move to next sentence
  highlightNextSentence() {
    if (this.currentMode !== 'sentence' || !this.sentenceElements) return;
    
    const nextIndex = this.currentSentenceIndex + 1;
    if (nextIndex < this.sentenceElements.length) {
      this.highlightSentence(nextIndex);
      return true;
    }
    return false;
  }

  // Get current sentence info
  getCurrentSentenceInfo() {
    if (this.currentSentenceIndex < 0 || !this.sentenceElements) return null;
    
    const currentElement = this.sentenceElements[this.currentSentenceIndex];
    return {
      index: this.currentSentenceIndex,
      sentence: currentElement?.sentence,
      totalSentences: this.sentenceElements.length,
      progress: ((this.currentSentenceIndex + 1) / this.sentenceElements.length) * 100
    };
  }

  // Start real-time highlighting based on timing events
  startTimingBasedHighlighting() {
    if (!this.timepoints || this.timepoints.length === 0) {
      console.log('📝 No timing events available, highlighting first sentence only');
      return;
    }

    this.speechStartTime = Date.now();
    
    // Schedule highlighting for each sentence based on timing events
    this.timepoints.forEach(timepoint => {
      const delayMs = timepoint.timeSeconds * 1000;
      
      setTimeout(() => {
        // Extract sentence index from mark name (e.g., "s0" -> 0)
        const match = timepoint.markName.match(/^s(\d+)$/);
        if (match) {
          const sentenceIndex = parseInt(match[1]);
          this.highlightSentence(sentenceIndex);
        }
      }, delayMs);
    });
  }

  // Clear timing-based highlighting
  clearTimingBasedHighlighting() {
    if (this.sentenceTimer) {
      clearTimeout(this.sentenceTimer);
      this.sentenceTimer = null;
    }
    this.speechStartTime = null;
  }
}

// Make TextHighlighter available globally
if (typeof window !== 'undefined') {
  window.TextHighlighter = TextHighlighter;
}

class FloatingControlBar {
  constructor() {
    this.controlBar = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.init();
  }

  init() {
    // Create the floating control bar
    this.controlBar = document.createElement('div');
    this.controlBar.id = 'tts-floating-control-bar';
    this.controlBar.innerHTML = `
      <div class="tts-control-container">
        <div class="tts-control-header" id="tts-drag-handle">
          <span class="tts-title">TTS Controls</span>
          <button class="tts-close-btn" id="tts-close-btn">×</button>
        </div>
        <div class="tts-control-content">
          <div class="tts-control-item">
            <button class="tts-btn tts-stop-btn" id="tts-stop-btn">
              <span class="tts-icon">⏹</span>
              Stop
            </button>
          </div>
          <div class="tts-control-item">
            <button class="tts-btn tts-toggle-btn" id="tts-toggle-btn">
              <span class="tts-icon" id="tts-toggle-icon">⏸</span>
              <span class="tts-toggle-text" id="tts-toggle-text">Pause</span>
            </button>
          </div>
          <div class="tts-control-item tts-speed-controls">
            <button class="tts-btn tts-speed-btn tts-speed-down-btn" id="tts-speed-down-btn">
              <span class="tts-icon">🐌</span>
              Slower
            </button>
            <span class="tts-speed-display" id="tts-speed-display">1.0x</span>
            <button class="tts-btn tts-speed-btn tts-speed-up-btn" id="tts-speed-up-btn">
              <span class="tts-icon">🐰</span>
              Faster
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Add event listeners
    this.addEventListeners();

    // Initially hide the control bar
    this.hide();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #tts-floating-control-bar {
        position: fixed;
        top: auto;
        right: auto;
        bottom: 20px;
        left: 20px;
        z-index: 10000;
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        min-width: 200px;
        height: auto;
        max-height: 220px;
        overflow: auto;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      #tts-floating-control-bar.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .tts-control-container {
        padding: 12px;
      }

      .tts-control-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
        cursor: move;
        user-select: none;
      }

      .tts-control-header.dragging {
        cursor: grabbing;
        background-color: #f8f9fa;
      }

      .tts-title {
        font-weight: 600;
        color: #333;
      }

      .tts-close-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .tts-close-btn:hover {
        background-color: #f0f0f0;
        color: #333;
      }

      .tts-control-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tts-control-item {
        display: flex;
      }

      .tts-btn {
        flex: 1;
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.2s ease;
      }

      .tts-btn:hover {
        background: #0056b3;
      }

      .tts-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .tts-stop-btn {
        background: #dc3545;
      }

      .tts-stop-btn:hover {
        background: #c82333;
      }

      .tts-toggle-btn {
        background: #ffc107;
        color: #212529;
      }

      .tts-toggle-btn:hover {
        background: #e0a800;
      }

      .tts-toggle-btn.resume-state {
        background: #28a745;
        color: white;
      }

      .tts-toggle-btn.resume-state:hover {
        background: #218838;
      }

      .tts-speed-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tts-speed-btn {
        background: #6c757d;
        color: white;
        flex: 0 0 auto;
        min-width: 70px;
        padding: 6px 10px;
        font-size: 11px;
      }

      .tts-speed-btn:hover {
        background: #5a6268;
      }

      .tts-speed-down-btn {
        background: #fd7e14;
      }

      .tts-speed-down-btn:hover {
        background: #e8690b;
      }

      .tts-speed-up-btn {
        background: #20c997;
      }

      .tts-speed-up-btn:hover {
        background: #1aa085;
      }

      .tts-speed-display {
        font-size: 11px;
        font-weight: bold;
        color: #333;
        min-width: 35px;
        text-align: center;
        padding: 0 4px;
      }

      .tts-icon {
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  addEventListeners() {
    // Close button
    this.controlBar.querySelector('#tts-close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Stop button
    this.controlBar.querySelector('#tts-stop-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'stop' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Error stopping from control bar:', chrome.runtime.lastError);
        } else if (response && response.status === 'stopped') {
          this.updateStatus(false);
        }
      });
    });

    // Toggle button (pause/resume)
    this.controlBar.querySelector('#tts-toggle-btn').addEventListener('click', () => {
      const toggleBtn = this.controlBar.querySelector('#tts-toggle-btn');
      const isResumeState = toggleBtn.classList.contains('resume-state');
      
      if (isResumeState) {
        // Currently showing resume, so resume playback
        chrome.runtime.sendMessage({ type: 'resume' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Error resuming from control bar:', chrome.runtime.lastError);
          } else if (response && response.status === 'resumed') {
            this.updateStatus(true, false); // speaking state
          }
        });
      } else {
        // Currently showing pause, so pause playback
        chrome.runtime.sendMessage({ type: 'pause' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Error pausing from control bar:', chrome.runtime.lastError);
          } else if (response && response.status === 'paused') {
            this.updateStatus(false, true); // paused state
          }
        });
      }
    });

    // Speed control buttons
    this.controlBar.querySelector('#tts-speed-down-btn').addEventListener('click', () => {
      this.changeSpeed(-0.1);
    });

    this.controlBar.querySelector('#tts-speed-up-btn').addEventListener('click', () => {
      this.changeSpeed(0.1);
    });

    // Drag functionality
    this.addDragListeners();
  }

  addDragListeners() {
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    
    // Mouse events for drag
    dragHandle.addEventListener('mousedown', (e) => {
      this.startDrag(e);
    });

    // Touch events for mobile drag
    dragHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrag(e.touches[0]);
    });

    // Prevent text selection during drag
    dragHandle.addEventListener('selectstart', (e) => {
      e.preventDefault();
    });
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.controlBar.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    // Add dragging class for visual feedback
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.add('dragging');

    // Add global event listeners
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.stopDrag.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this));
    document.addEventListener('touchend', this.stopDrag.bind(this));
  }

  handleDragMove(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    // Calculate new position
    const newX = clientX - this.dragOffset.x;
    const newY = clientY - this.dragOffset.y;
    
    // Keep control bar within viewport bounds
    const rect = this.controlBar.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    // Apply new position
    this.controlBar.style.left = boundedX + 'px';
    this.controlBar.style.top = boundedY + 'px';
    this.controlBar.style.right = 'auto';
  }

  stopDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // Remove dragging class
    const dragHandle = this.controlBar.querySelector('#tts-drag-handle');
    dragHandle.classList.remove('dragging');
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.stopDrag.bind(this));
    document.removeEventListener('touchmove', this.handleDragMove.bind(this));
    document.removeEventListener('touchend', this.stopDrag.bind(this));
    
    // Update global position when drag ends
    this.updateGlobalPosition();
  }
  
  updateGlobalPosition() {
    const position = this.getPosition();
    chrome.runtime.sendMessage({
      type: 'updateControlBarPosition',
      position: position
    }).catch(() => {
      // Ignore errors if background script isn't available
    });
  }

  show(position = null) {
    if (!this.isVisible) {
      document.body.appendChild(this.controlBar);
      this.isVisible = true;
      
      // Apply position if provided
      if (position) {
        this.applyPosition(position);
      }
      
      // Trigger animation
      setTimeout(() => {
        this.controlBar.classList.add('visible');
      }, 10);
    }
  }
  
  applyPosition(position) {
    if (position.x !== null) {
      this.controlBar.style.left = position.x + 'px';
      this.controlBar.style.right = 'auto';
    }
    if (position.y !== null) {
      this.controlBar.style.top = position.y + 'px';
      this.controlBar.style.bottom = 'auto';
    } else if (position.bottom !== null) {
      this.controlBar.style.bottom = position.bottom + 'px';
      this.controlBar.style.top = 'auto';
    }
  }
  
  getPosition() {
    const rect = this.controlBar.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      bottom: window.innerHeight - rect.bottom
    };
  }

  hide() {
    if (this.isVisible) {
      this.controlBar.classList.remove('visible');
      setTimeout(() => {
        if (this.controlBar.parentNode) {
          this.controlBar.parentNode.removeChild(this.controlBar);
        }
        this.isVisible = false;
      }, 300);
    }
  }

  updateStatus(isSpeaking, isPaused = false) {
    const stopBtn = this.controlBar.querySelector('#tts-stop-btn');
    const toggleBtn = this.controlBar.querySelector('#tts-toggle-btn');
    const toggleIcon = this.controlBar.querySelector('#tts-toggle-icon');
    const toggleText = this.controlBar.querySelector('#tts-toggle-text');
    const speedDownBtn = this.controlBar.querySelector('#tts-speed-down-btn');
    const speedUpBtn = this.controlBar.querySelector('#tts-speed-up-btn');

    if (isSpeaking) {
      // Currently speaking - show pause button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
      speedDownBtn.disabled = false;
      speedUpBtn.disabled = false;
    } else if (isPaused) {
      // Currently paused - show resume button
      stopBtn.disabled = false;
      toggleBtn.disabled = false;
      toggleBtn.classList.add('resume-state');
      toggleIcon.textContent = '▶';
      toggleText.textContent = 'Resume';
      speedDownBtn.disabled = false;
      speedUpBtn.disabled = false;
    } else {
      // Not speaking or paused - disable toggle button
      stopBtn.disabled = true;
      toggleBtn.disabled = true;
      toggleBtn.classList.remove('resume-state');
      toggleIcon.textContent = '⏸';
      toggleText.textContent = 'Pause';
      speedDownBtn.disabled = true;
      speedUpBtn.disabled = true;
    }
  }

  changeSpeed(delta) {
    // Get current speed from storage
    chrome.storage.sync.get(['speechRate'], (result) => {
      const currentRate = result.speechRate ? parseFloat(result.speechRate) : 1.0;
      let newRate = currentRate + delta;
      
      // Clamp speed between 0.1 and 3.0
      newRate = Math.max(0.1, Math.min(3.0, newRate));
      
      // Round to 1 decimal place
      newRate = Math.round(newRate * 10) / 10;
      
      // Update storage
      chrome.storage.sync.set({ speechRate: newRate.toString() }, () => {
        // Update display
        this.updateSpeedDisplay(newRate);
        
        // If currently speaking, send message to background to apply new speed
        chrome.runtime.sendMessage({ 
          type: 'updateSpeed', 
          rate: newRate 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Error updating speed:', chrome.runtime.lastError);
          } else if (response && response.status === 'error') {
            console.error('Speed update error:', response.error);
          }
        });
      });
    });
  }

  updateSpeedDisplay(rate) {
    const speedDisplay = this.controlBar.querySelector('#tts-speed-display');
    if (speedDisplay) {
      speedDisplay.textContent = rate.toFixed(1) + 'x';
    }
  }

  initializeSpeedDisplay() {
    // Get current speed from storage and update display
    chrome.storage.sync.get(['speechRate'], (result) => {
      const currentRate = result.speechRate ? parseFloat(result.speechRate) : 1.0;
      this.updateSpeedDisplay(currentRate);
    });
  }
}

// Make FloatingControlBar available globally
if (typeof window !== 'undefined') {
  window.FloatingControlBar = FloatingControlBar;
}

// Initialize the floating control bar and text highlighter
if (typeof window !== 'undefined') {
  if (typeof window.floatingControlBar === 'undefined') {
    window.floatingControlBar = null;
  }
  if (typeof window.textHighlighter === 'undefined') {
    window.textHighlighter = null;
  }

  // Only add message listener if not already added
  if (!window.ttsMessageListenerAdded) {
  window.ttsMessageListenerAdded = true;
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (!window.floatingControlBar) {
      window.floatingControlBar = new FloatingControlBar();
    }
    
    if (!window.textHighlighter) {
      window.textHighlighter = new TextHighlighter();
    }

    switch (message.type) {
      case 'showControlBar':
        console.log('Showing control bar');
        // Show with position if provided
        window.floatingControlBar.show(message.position);
        // Set initial state if provided
        if (message.isSpeaking !== undefined || message.isPaused !== undefined) {
          console.log('Updating control bar status:', message.isSpeaking, message.isPaused);
          window.floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
        }
        // Initialize speed display
        window.floatingControlBar.initializeSpeedDisplay();
        sendResponse({ status: 'success' });
        break;
      case 'hideControlBar':
        console.log('Hiding control bar');
        window.floatingControlBar.hide();
        sendResponse({ status: 'success' });
        break;
      case 'updateStatus':
        console.log('Updating control bar status:', message.isSpeaking, message.isPaused);
        window.floatingControlBar.updateStatus(message.isSpeaking, message.isPaused);
        sendResponse({ status: 'success' });
        break;
      case 'highlightText':
        
        if (message.action === 'start') {
          if (message.mode === 'sentence' && message.sentenceData) {
            
            // Initialize with timepoints if available
            window.textHighlighter.initializeSentenceHighlighting(
              message.text, 
              message.sentenceData, 
              message.timepoints
            );
            
            // Start timing-based highlighting if we have timing events
            if (message.timepoints && message.timepoints.length > 0) {
              window.textHighlighter.startTimingBasedHighlighting();
            } else {
              window.textHighlighter.highlightSentence(0);
            }
          } else {
            window.textHighlighter.highlightText(message.text);
          }
        } else if (message.action === 'end') {
          window.textHighlighter.clearTimingBasedHighlighting();
          window.textHighlighter.clearHighlights();
        }
        sendResponse({ status: 'success' });
        break;
      default:
        console.log('Unknown message type:', message.type);
        sendResponse({ status: 'error', error: 'Unknown message type' });
    }
  });

} // End of message listener guard

} // End of window check

} // End of TTSContentScriptLoaded guard

// Export classes for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FloatingControlBar, TextHighlighter };
} 