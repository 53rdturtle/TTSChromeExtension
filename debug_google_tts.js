// Debug script for Google TTS fallback issue
// Run this in the browser console when the extension popup is open

console.log('🔍 Starting Google TTS Debug Check');

// Check if Google TTS is enabled in storage
chrome.storage.sync.get(['googleTTSEnabled', 'googleAPIKey'], (result) => {
  console.log('📦 Storage Settings:', {
    googleTTSEnabled: result.googleTTSEnabled,
    hasAPIKey: !!(result.googleAPIKey && result.googleAPIKey.trim() !== ''),
    apiKeyLength: result.googleAPIKey ? result.googleAPIKey.length : 0
  });
  
  // Check if SSML Builder is loaded
  console.log('🔧 SSML Builder availability:', typeof SSMLBuilder !== 'undefined');
  
  // Test Google TTS isEnabled
  chrome.runtime.sendMessage({ type: 'testGoogleTTSEnabled' }, (response) => {
    console.log('🎯 Google TTS enabled check response:', response);
  });
  
  // Test basic TTS speak
  chrome.runtime.sendMessage({
    type: 'speak',
    text: 'This is a test',
    voiceName: 'Google US English',
    rate: 1.0
  }, (response) => {
    console.log('🗣️ TTS speak response:', response);
  });
});

// Listen for console messages
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('TTS')) {
    originalLog('🐛 DEBUG:', ...args);
  }
  originalLog.apply(console, args);
};

console.error = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('TTS')) {
    originalError('💥 ERROR:', ...args);
  }
  originalError.apply(console, args);
};

console.log('✅ Debug logging setup complete. Watch for 🐛 DEBUG and 💥 ERROR messages.');