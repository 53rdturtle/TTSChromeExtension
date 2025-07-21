// Debug script to identify Google TTS fallback issues
// This should be run in the browser console of the extension's background context

console.log('🔍 Starting Google TTS Fallback Debug Analysis...');

// Test 1: Check storage values
async function checkStorageValues() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['googleTTSEnabled', 'googleAPIKey'], (result) => {
      const enabled = result.googleTTSEnabled === true;
      const hasKey = !!(result.googleAPIKey && result.googleAPIKey.trim() !== '');
      const isEnabledResult = enabled && hasKey;
      
      console.log('📦 Storage Values:', { 
        googleTTSEnabled: result.googleTTSEnabled,
        hasAPIKey: !!result.googleAPIKey,
        keyLength: result.googleAPIKey ? result.googleAPIKey.length : 0,
        keyPrefix: result.googleAPIKey ? result.googleAPIKey.substring(0, 10) + '...' : 'none',
        enabled, 
        hasKey, 
        isEnabledResult
      });
      
      resolve({ enabled, hasKey, isEnabledResult });
    });
  });
}

// Test 2: Test isEnabled() method directly
async function testIsEnabledMethod() {
  console.log('🧪 Testing GoogleTTSService.isEnabled() method...');
  try {
    const result = await googleTTSService.isEnabled();
    console.log('✅ GoogleTTSService.isEnabled() result:', result);
    return result;
  } catch (error) {
    console.error('❌ GoogleTTSService.isEnabled() error:', error);
    return false;
  }
}

// Test 3: Check if SSML builder loads
async function testSSMLBuilderLoading() {
  console.log('📝 Testing SSML Builder loading...');
  try {
    // Try to load SSML builder like the service does
    if (!window.SSMLBuilder) {
      await googleTTSService.loadSSMLBuilder();
    }
    
    if (window.SSMLBuilder) {
      console.log('✅ SSML Builder loaded successfully');
      // Test basic SSML creation
      const testResult = window.SSMLBuilder.createBasicSSML('Test text');
      console.log('✅ SSML creation test:', testResult);
      return true;
    } else {
      console.error('❌ SSML Builder not available after loading');
      return false;
    }
  } catch (error) {
    console.error('❌ SSML Builder loading error:', error);
    return false;
  }
}

// Test 4: Test API key validation
async function testAPIKey() {
  console.log('🔑 Testing API Key...');
  try {
    const apiKey = await googleTTSService.getApiKey();
    if (!apiKey) {
      console.error('❌ No API key found');
      return false;
    }
    
    console.log('✅ API key found, length:', apiKey.length);
    
    // Test API key with a simple voices request
    const testUrl = `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`;
    const response = await fetch(testUrl);
    
    if (response.ok) {
      console.log('✅ API key is valid - voices endpoint accessible');
      return true;
    } else {
      console.error('❌ API key validation failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ API key test error:', error);
    return false;
  }
}

// Test 5: Test quota check
async function testQuotaCheck() {
  console.log('📊 Testing quota check...');
  try {
    const quotaStatus = await googleTTSService.checkQuotaStatus();
    console.log('✅ Quota status:', quotaStatus);
    
    if (quotaStatus.percentage >= 100) {
      console.warn('⚠️ Quota exceeded! This would cause fallback.');
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Quota check error:', error);
    return false;
  }
}

// Test 6: Test SSML synthesis without full audio playback
async function testSSMLSynthesis() {
  console.log('🎵 Testing SSML synthesis...');
  try {
    const testText = 'Test synthesis';
    const testSSML = window.SSMLBuilder.createBasicSSML(testText);
    
    console.log('🔧 Attempting SSML synthesis...');
    const result = await googleTTSService.synthesizeSSML(testSSML.ssml, { rate: 1.0 });
    
    if (result.audioContent) {
      console.log('✅ SSML synthesis successful, audio content length:', result.audioContent.length);
      return true;
    } else {
      console.error('❌ No audio content in synthesis result');
      return false;
    }
  } catch (error) {
    console.error('❌ SSML synthesis error:', error);
    return false;
  }
}

// Run all tests
async function runFullDebugSuite() {
  console.log('🚀 Running complete debug suite...\n');
  
  const results = {
    storage: await checkStorageValues(),
    isEnabled: await testIsEnabledMethod(),
    ssmlBuilder: await testSSMLBuilderLoading(),
    apiKey: await testAPIKey(),
    quota: await testQuotaCheck(),
    synthesis: await testSSMLSynthesis()
  };
  
  console.log('\n📋 Debug Results Summary:');
  console.table(results);
  
  // Analyze results
  console.log('\n🔍 Analysis:');
  
  if (!results.storage.isEnabledResult) {
    console.log('❌ ISSUE FOUND: Google TTS not enabled in storage or missing API key');
    console.log('   - googleTTSEnabled:', results.storage.enabled);
    console.log('   - hasAPIKey:', results.storage.hasKey);
  }
  
  if (results.storage.isEnabledResult && !results.isEnabled) {
    console.log('❌ ISSUE FOUND: isEnabled() method returning false despite storage being correct');
  }
  
  if (!results.ssmlBuilder) {
    console.log('❌ ISSUE FOUND: SSML Builder failing to load - this would cause fallback');
  }
  
  if (!results.apiKey) {
    console.log('❌ ISSUE FOUND: API key invalid or inaccessible - this would cause fallback');
  }
  
  if (!results.quota) {
    console.log('❌ ISSUE FOUND: Quota exceeded or quota check failing - this would cause fallback');
  }
  
  if (!results.synthesis) {
    console.log('❌ ISSUE FOUND: SSML synthesis failing - this would cause fallback in speakWithHighlighting()');
  }
  
  if (results.storage.isEnabledResult && results.isEnabled && results.ssmlBuilder && results.apiKey && results.quota && results.synthesis) {
    console.log('✅ All tests passed - Google TTS should work correctly');
    console.log('   If fallback is still occurring, the issue might be in the handleSpeak flow or offscreen document');
  }
  
  return results;
}

// Export for manual testing
window.debugGoogleTTS = {
  runFullSuite: runFullDebugSuite,
  checkStorage: checkStorageValues,
  testIsEnabled: testIsEnabledMethod,
  testSSMLBuilder: testSSMLBuilderLoading,
  testAPIKey: testAPIKey,
  testQuota: testQuotaCheck,
  testSynthesis: testSSMLSynthesis
};

console.log('🔧 Debug functions available at window.debugGoogleTTS');
console.log('Run window.debugGoogleTTS.runFullSuite() to start debugging');