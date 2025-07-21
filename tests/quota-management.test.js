// Tests for Google TTS quota management system

describe('Google TTS Quota Management', () => {
  let googleTTSService;
  let mockStorage;

  beforeEach(() => {
    // Clear require cache and reimport
    delete require.cache[require.resolve('../extension/services/google-tts.js')];
    const GoogleTTSService = require('../extension/services/google-tts.js');
    googleTTSService = new GoogleTTSService();

    // Mock storage
    mockStorage = {};
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        result[keys] = mockStorage[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = mockStorage[key];
        });
      } else if (keys === null) {
        Object.assign(result, mockStorage);
      }
      callback(result);
    });

    chrome.storage.local.set.mockImplementation((data, callback) => {
      Object.assign(mockStorage, data);
      if (callback) callback();
    });

    // Mock current date
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December (0-indexed)
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trackUsage', () => {
    test('should track character usage for current month', async () => {
      const characterCount = 1500;
      
      const result = await googleTTSService.trackUsage(characterCount);
      
      expect(result).toBe(1500);
      expect(mockStorage.googleTTSUsage).toEqual({
        '2024-12': 1500
      });
    });

    test('should accumulate usage for same month', async () => {
      // Set initial usage
      mockStorage.googleTTSUsage = { '2024-12': 1000 };
      
      const result = await googleTTSService.trackUsage(500);
      
      expect(result).toBe(1500);
      expect(mockStorage.googleTTSUsage['2024-12']).toBe(1500);
    });

    test('should clean up old months (keep only last 3)', async () => {
      // Set usage for 5 months
      mockStorage.googleTTSUsage = {
        '2024-08': 1000,
        '2024-09': 2000,
        '2024-10': 3000,
        '2024-11': 4000,
        '2024-12': 5000
      };
      
      await googleTTSService.trackUsage(100);
      
      const remainingMonths = Object.keys(mockStorage.googleTTSUsage);
      expect(remainingMonths).toHaveLength(3);
      expect(remainingMonths).toContain('2024-10');
      expect(remainingMonths).toContain('2024-11');
      expect(remainingMonths).toContain('2024-12');
      expect(remainingMonths).not.toContain('2024-08');
      expect(remainingMonths).not.toContain('2024-09');
    });

    test('should initialize usage for new month', async () => {
      const result = await googleTTSService.trackUsage(750);
      
      expect(result).toBe(750);
      expect(mockStorage.googleTTSUsage).toEqual({
        '2024-12': 750
      });
    });
  });

  describe('getCurrentUsage', () => {
    test('should return current month usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 25000 };
      
      const usage = await googleTTSService.getCurrentUsage();
      
      expect(usage).toEqual({
        used: 25000,
        month: '2024-12',
        limit: 1000000
      });
    });

    test('should return zero usage for new month', async () => {
      const usage = await googleTTSService.getCurrentUsage();
      
      expect(usage).toEqual({
        used: 0,
        month: '2024-12',
        limit: 1000000
      });
    });

    test('should handle missing storage data', async () => {
      mockStorage = {};
      
      const usage = await googleTTSService.getCurrentUsage();
      
      expect(usage).toEqual({
        used: 0,
        month: '2024-12',
        limit: 1000000
      });
    });
  });

  describe('checkQuotaStatus', () => {
    test('should return status with no warning for low usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 100000 }; // 10%
      
      const status = await googleTTSService.checkQuotaStatus();
      
      expect(status).toEqual({
        used: 100000,
        month: '2024-12',
        limit: 1000000,
        percentage: 10,
        warning: null
      });
    });

    test('should return high warning at 80% usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 800000 }; // 80%
      
      const status = await googleTTSService.checkQuotaStatus();
      
      expect(status).toEqual({
        used: 800000,
        month: '2024-12',
        limit: 1000000,
        percentage: 80,
        warning: 'high'
      });
    });

    test('should return critical warning at 95% usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 950000 }; // 95%
      
      const status = await googleTTSService.checkQuotaStatus();
      
      expect(status).toEqual({
        used: 950000,
        month: '2024-12',
        limit: 1000000,
        percentage: 95,
        warning: 'critical'
      });
    });

    test('should handle 100% usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 1000000 }; // 100%
      
      const status = await googleTTSService.checkQuotaStatus();
      
      expect(status.percentage).toBe(100);
      expect(status.warning).toBe('critical');
    });

    test('should handle usage over 100%', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 1200000 }; // 120%
      
      const status = await googleTTSService.checkQuotaStatus();
      
      expect(status.percentage).toBe(120);
      expect(status.warning).toBe('critical');
    });
  });

  describe('speak method quota integration', () => {
    beforeEach(() => {
      // Mock synthesize method
      googleTTSService.synthesize = jest.fn().mockResolvedValue({
        audioContent: 'fake-audio-data'
      });
      
      // Mock playAudio method
      googleTTSService.playAudio = jest.fn().mockResolvedValue();
      
      // Mock chrome.runtime.sendMessage for quota warnings
      chrome.runtime.sendMessage = jest.fn();
    });

    test('should track usage after successful synthesis', async () => {
      const text = 'Hello world'; // 11 characters
      
      await googleTTSService.speak(text);
      
      expect(mockStorage.googleTTSUsage['2024-12']).toBe(11);
    });

    test('should send warning message at 80% usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 800000 }; // Exactly 80%
      const text = 'Hello world test'; // 16 characters
      
      await googleTTSService.speak(text);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'quotaWarning',
        quotaData: expect.objectContaining({
          warning: 'high'
        })
      }, expect.any(Function));
    });

    test('should send critical warning message at 95% usage', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 950000 }; // Exactly 95%
      const text = 'Hello world test message'; // 24 characters
      
      await googleTTSService.speak(text);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'quotaWarning',
        quotaData: expect.objectContaining({
          warning: 'critical'
        })
      }, expect.any(Function));
    });

    test('should throw error when quota exceeded', async () => {
      mockStorage.googleTTSUsage = { '2024-12': 1000000 }; // 100%
      
      await expect(googleTTSService.speak('Hello')).rejects.toThrow(
        'Google TTS monthly quota exceeded'
      );
      
      expect(googleTTSService.synthesize).not.toHaveBeenCalled();
    });

    test('should not track usage if synthesis fails', async () => {
      googleTTSService.synthesize.mockRejectedValue(new Error('API Error'));
      
      await expect(googleTTSService.speak('Hello')).rejects.toThrow('API Error');
      
      expect(mockStorage.googleTTSUsage).toBeUndefined();
    });
  });

  describe('month formatting', () => {
    test('should format single-digit months correctly', async () => {
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(0); // January (0-indexed)
      
      await googleTTSService.trackUsage(100);
      
      expect(Object.keys(mockStorage.googleTTSUsage)).toContain('2024-01');
    });

    test('should format double-digit months correctly', async () => {
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December (0-indexed)
      
      await googleTTSService.trackUsage(100);
      
      expect(Object.keys(mockStorage.googleTTSUsage)).toContain('2024-12');
    });
  });

  describe('edge cases', () => {
    test('should handle zero character usage', async () => {
      const result = await googleTTSService.trackUsage(0);
      
      expect(result).toBe(0);
      expect(mockStorage.googleTTSUsage['2024-12']).toBe(0);
    });

    test('should handle very large character counts', async () => {
      const largeCount = 999999999;
      
      const result = await googleTTSService.trackUsage(largeCount);
      
      expect(result).toBe(largeCount);
      expect(mockStorage.googleTTSUsage['2024-12']).toBe(largeCount);
    });

    test('should handle corrupted storage data', async () => {
      mockStorage.googleTTSUsage = 'invalid-data';
      
      const result = await googleTTSService.trackUsage(100);
      
      expect(result).toBe(100);
      expect(typeof mockStorage.googleTTSUsage).toBe('object');
    });
  });
});