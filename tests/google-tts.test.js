// Tests for Google TTS Service
const GoogleTTSService = require('../extension/services/google-tts.js');

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleTTSService', () => {
  let service;

  beforeEach(() => {
    service = new GoogleTTSService();
    jest.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockClear();
    
    // Setup chrome storage mock for Google TTS tests
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        googleAPIKey: 'test-api-key',
        googleTTSEnabled: true
      });
    });
    
    // Setup chrome runtime mocks
    chrome.runtime.getContexts = jest.fn(() => Promise.resolve([]));
    chrome.runtime.getURL = jest.fn(path => `chrome-extension://test/${path}`);
    
    // Setup chrome offscreen mock
    chrome.offscreen = {
      createDocument: jest.fn(() => Promise.resolve())
    };
  });

  describe('constructor', () => {
    test('should initialize with correct endpoint', () => {
      expect(service.endpoint).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
      expect(service.apiKey).toBeNull();
    });
  });

  describe('getApiKey', () => {
    test('should retrieve API key from storage', async () => {
      const apiKey = await service.getApiKey();
      
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['googleAPIKey'], expect.any(Function));
      expect(apiKey).toBe('test-api-key');
      expect(service.apiKey).toBe('test-api-key');
    });

    test('should handle missing API key', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const apiKey = await service.getApiKey();
      
      expect(apiKey).toBeNull();
      expect(service.apiKey).toBeNull();
    });
  });

  describe('isEnabled', () => {
    test('should return true when enabled with valid API key', async () => {
      const enabled = await service.isEnabled();
      
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['googleTTSEnabled', 'googleAPIKey'], expect.any(Function));
      expect(enabled).toBe(true);
    });

    test('should return false when disabled', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          googleTTSEnabled: false,
          googleAPIKey: 'test-api-key'
        });
      });

      const enabled = await service.isEnabled();
      expect(enabled).toBe(false);
    });

    test('should return false when no API key', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          googleTTSEnabled: true,
          googleAPIKey: ''
        });
      });

      const enabled = await service.isEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe('voice name detection and mapping', () => {
    describe('isGoogleVoiceName', () => {
      test('should correctly identify Google TTS voice names', () => {
        expect(service.isGoogleVoiceName('en-US-Neural2-F')).toBe(true);
        expect(service.isGoogleVoiceName('es-ES-WaveNet-A')).toBe(true);
        expect(service.isGoogleVoiceName('ja-JP-Chirp-M')).toBe(true);
        expect(service.isGoogleVoiceName('fr-CA-Studio-B')).toBe(true);
      });

      test('should correctly reject Chrome TTS voice names', () => {
        expect(service.isGoogleVoiceName('Google US English')).toBe(false);
        expect(service.isGoogleVoiceName('Microsoft David - English (United States)')).toBe(false);
        expect(service.isGoogleVoiceName('Alex')).toBe(false);
        expect(service.isGoogleVoiceName('Samantha')).toBe(false);
        expect(service.isGoogleVoiceName('')).toBe(false);
      });
    });

    describe('extractLanguageFromGoogleVoice', () => {
      test('should extract language codes from Google voice names', () => {
        expect(service.extractLanguageFromGoogleVoice('en-US-Neural2-F')).toBe('en-US');
        expect(service.extractLanguageFromGoogleVoice('es-ES-WaveNet-A')).toBe('es-ES');
        expect(service.extractLanguageFromGoogleVoice('ja-JP-Chirp-M')).toBe('ja-JP');
        expect(service.extractLanguageFromGoogleVoice('fr-CA-Studio-B')).toBe('fr-CA');
      });

      test('should return default for invalid voice names', () => {
        expect(service.extractLanguageFromGoogleVoice('invalid-voice')).toBe('en-US');
        expect(service.extractLanguageFromGoogleVoice('Google US English')).toBe('en-US');
        expect(service.extractLanguageFromGoogleVoice('')).toBe('en-US');
      });
    });

    describe('getVoiceConfig - THE VOICE SELECTION BUG FIX', () => {
      test('should handle Google TTS voice names directly', () => {
        const config = service.getVoiceConfig('en-US-Neural2-F');
        
        expect(config).toEqual({
          voice: 'en-US-Neural2-F',
          lang: 'en-US'
        });
      });

      test('should handle various Google voice formats', () => {
        const testCases = [
          { input: 'es-ES-WaveNet-A', expected: { voice: 'es-ES-WaveNet-A', lang: 'es-ES' } },
          { input: 'ja-JP-Chirp-M', expected: { voice: 'ja-JP-Chirp-M', lang: 'ja-JP' } },
          { input: 'fr-CA-Studio-B', expected: { voice: 'fr-CA-Studio-B', lang: 'fr-CA' } }
        ];

        testCases.forEach(testCase => {
          const config = service.getVoiceConfig(testCase.input);
          expect(config).toEqual(testCase.expected);
        });
      });

      test('should map Chrome TTS voice names to Google equivalents', () => {
        const config = service.getVoiceConfig('Google US English');
        
        expect(config).toEqual({
          voice: 'en-US-Neural2-F',
          lang: 'en-US'
        });
      });

      test('should provide fallback for unknown Chrome voices', () => {
        const config = service.getVoiceConfig('Unknown Voice Name');
        
        expect(config).toEqual({
          voice: 'en-US-Neural2-F',
          lang: 'en-US'
        });
      });
    });

    describe('mapChromeVoiceToGoogle', () => {
      test('should map known Chrome voices correctly', () => {
        const testCases = [
          { chrome: 'Google US English', expected: { voice: 'en-US-Neural2-F', lang: 'en-US' } },
          { chrome: 'Google UK English Female', expected: { voice: 'en-GB-Neural2-A', lang: 'en-GB' } },
          { chrome: 'Google UK English Male', expected: { voice: 'en-GB-Neural2-B', lang: 'en-GB' } },
          { chrome: 'Alex', expected: { voice: 'en-US-Neural2-D', lang: 'en-US' } },
          { chrome: 'Samantha', expected: { voice: 'en-US-Neural2-F', lang: 'en-US' } }
        ];

        testCases.forEach(testCase => {
          const result = service.mapChromeVoiceToGoogle(testCase.chrome);
          expect(result).toEqual(testCase.expected);
        });
      });

      test('should provide default fallback for unmapped voices', () => {
        const result = service.mapChromeVoiceToGoogle('Unmapped Voice');
        expect(result).toEqual({
          voice: 'en-US-Neural2-F',
          lang: 'en-US'
        });
      });
    });
  });

  describe('getVoices', () => {
    test('should fetch and format Google TTS voices', async () => {
      const mockVoicesResponse = {
        voices: [
          {
            name: 'en-US-Neural2-F',
            languageCodes: ['en-US'],
            ssmlGender: 'FEMALE',
            naturalSampleRateHertz: 24000
          },
          {
            name: 'en-GB-WaveNet-A',
            languageCodes: ['en-GB'],
            ssmlGender: 'FEMALE',
            naturalSampleRateHertz: 24000
          }
        ]
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVoicesResponse)
      });

      const voices = await service.getVoices();

      expect(fetch).toHaveBeenCalledWith(
        'https://texttospeech.googleapis.com/v1/voices?key=test-api-key'
      );

      expect(voices).toEqual([
        {
          name: 'en-US-Neural2-F',
          lang: 'en-US',
          languages: ['en-US'],
          gender: 'female',
          quality: 'Neural2',
          sampleRate: 24000,
          isGoogle: true
        },
        {
          name: 'en-GB-WaveNet-A',
          lang: 'en-GB',
          languages: ['en-GB'],
          gender: 'female',
          quality: 'WaveNet',
          sampleRate: 24000,
          isGoogle: true
        }
      ]);
    });

    test('should handle API errors gracefully', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const voices = await service.getVoices();

      expect(voices).toEqual([]);
    });

    test('should return empty array when no API key', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const voices = await service.getVoices();

      expect(voices).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should filter by language code when provided', async () => {
      const mockVoicesResponse = {
        voices: [
          {
            name: 'en-US-Neural2-F',
            languageCodes: ['en-US'],
            ssmlGender: 'FEMALE',
            naturalSampleRateHertz: 24000
          }
        ]
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVoicesResponse)
      });

      await service.getVoices('en-US');

      expect(fetch).toHaveBeenCalledWith(
        'https://texttospeech.googleapis.com/v1/voices?key=test-api-key&languageCode=en-US'
      );
    });
  });

  describe('quality detection', () => {
    test('should correctly identify voice quality from name', () => {
      expect(service.getVoiceQuality('en-US-Chirp-F')).toBe('Chirp3');
      expect(service.getVoiceQuality('en-US-Neural2-F')).toBe('Neural2');
      expect(service.getVoiceQuality('en-US-WaveNet-A')).toBe('WaveNet');
      expect(service.getVoiceQuality('en-US-Studio-B')).toBe('Studio');
      expect(service.getVoiceQuality('en-US-Standard-A')).toBe('Standard');
      expect(service.getVoiceQuality('unknown-voice')).toBe('Standard');
    });
  });

  describe('gender mapping', () => {
    test('should map Google TTS gender correctly', () => {
      expect(service.mapGender('MALE')).toBe('male');
      expect(service.mapGender('FEMALE')).toBe('female');
      expect(service.mapGender('NEUTRAL')).toBe('neutral');
      expect(service.mapGender('UNKNOWN')).toBe('unknown');
      expect(service.mapGender(undefined)).toBe('unknown');
    });
  });

  describe('synthesize', () => {
    test('should synthesize text with Google voice name', async () => {
      const mockResponse = {
        audioContent: 'base64-audio-data',
        audioConfig: { audioEncoding: 'MP3' }
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.synthesize('Hello world', {
        voiceName: 'en-US-Neural2-F',
        rate: 1.2
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=test-api-key',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: 'Hello world' },
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-F'
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.2,
              pitch: 0.0,
              volumeGainDb: 0.0
            }
          })
        }
      );

      expect(result).toEqual({
        audioContent: 'base64-audio-data',
        audioConfig: { audioEncoding: 'MP3' }
      });
    });

    test('should synthesize text with Chrome voice name (mapped)', async () => {
      const mockResponse = {
        audioContent: 'base64-audio-data',
        audioConfig: { audioEncoding: 'MP3' }
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.synthesize('Hello world', {
        voiceName: 'Google US English', // Chrome voice name
        rate: 1.0
      });

      // Should map to Google voice
      expect(fetch).toHaveBeenCalledWith(
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=test-api-key',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: 'Hello world' },
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-F' // Mapped Google voice
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.0,
              pitch: 0.0,
              volumeGainDb: 0.0
            }
          })
        }
      );

      expect(result).toEqual({
        audioContent: 'base64-audio-data',
        audioConfig: { audioEncoding: 'MP3' }
      });
    });

    test('should throw error when no API key', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(service.synthesize('Hello world')).rejects.toThrow('Google TTS API key not configured');
    });

    test('should handle API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      });

      await expect(service.synthesize('Hello world')).rejects.toThrow('Google TTS API error: 400 - Bad Request');
    });
  });

  describe('offscreen document management', () => {
    test('should create offscreen document if not exists', async () => {
      chrome.runtime.getContexts.mockResolvedValue([]); // No existing contexts

      await service.ensureOffscreenDocument();

      expect(chrome.runtime.getContexts).toHaveBeenCalledWith({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: ['chrome-extension://test/offscreen.html']
      });

      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play Google TTS audio in service worker context'
      });
    });

    test('should not create offscreen document if already exists', async () => {
      chrome.runtime.getContexts.mockResolvedValue([{ documentUrl: 'offscreen.html' }]);

      await service.ensureOffscreenDocument();

      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });
  });
});