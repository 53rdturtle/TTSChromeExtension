// Test script to verify Google TTS fallback fixes
// Run this in the browser console of the extension background page

console.log('🧪 Testing Google TTS Fallback Fixes...');

async function testGoogleTTSFixes() {
  console.log('1️⃣ Testing SSML Builder availability...');
  if (typeof SSMLBuilder !== 'undefined') {
    console.log('✅ SSMLBuilder is available globally');
    
    // Test SSML creation
    try {
      const testResult = SSMLBuilder.createBasicSSML('Test text for SSML');
      console.log('✅ SSML creation works:', testResult);
    } catch (error) {
      console.error('❌ SSML creation failed:', error);
    }
  } else {
    console.error('❌ SSMLBuilder is not available');
  }
  
  console.log('\n2️⃣ Testing GoogleTTSService loadSSMLBuilder...');
  try {
    await googleTTSService.loadSSMLBuilder();
    console.log('✅ loadSSMLBuilder completed successfully');
  } catch (error) {
    console.error('❌ loadSSMLBuilder failed:', error);
  }
  
  console.log('\n3️⃣ Testing Google TTS service availability...');
  try {
    const isEnabled = await googleTTSService.isEnabled();
    console.log('Google TTS enabled:', isEnabled);
    
    if (isEnabled) {
      console.log('✅ Google TTS is enabled and should be used');
    } else {
      console.log('ℹ️ Google TTS is disabled or not configured');
    }
  } catch (error) {
    console.error('❌ Error checking Google TTS status:', error);
  }
  
  console.log('\n4️⃣ Testing handleSpeak message flow (simulation)...');
  try {
    // Simulate the message handling without actually speaking
    const testMessage = {
      type: 'speak',
      text: 'Test message for debugging',
      rate: 1.0,
      voiceName: 'en-US-Neural2-F'
    };
    
    const options = {
      rate: testMessage.rate,
      voiceName: testMessage.voiceName
    };
    
    console.log('Testing Google TTS enabled check...');
    const useGoogleTTS = await googleTTSService.isEnabled();
    console.log('🔍 Google TTS enabled check result:', useGoogleTTS);
    
    if (useGoogleTTS) {
      console.log('🎵 Would use Google TTS with SSML highlighting');
      
      // Test the SSML creation part without actually speaking
      if (typeof SSMLBuilder !== 'undefined') {
        const ssmlResult = SSMLBuilder.createBasicSSML(testMessage.text);
        console.log('✅ SSML generation successful for handleSpeak flow');
      } else {
        console.error('❌ SSML Builder not available in handleSpeak flow');
      }
    } else {
      console.log('🎤 Would use Chrome TTS (Google TTS disabled or not configured)');
    }
    
  } catch (error) {
    console.error('❌ Error in handleSpeak simulation:', error);
  }
  
  console.log('\n📋 Testing complete!');
  console.log('If all tests passed, the Google TTS fallback issue should be resolved.');
}

// Run the test
testGoogleTTSFixes();