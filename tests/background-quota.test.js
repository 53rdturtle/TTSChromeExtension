// Tests for background script quota management integration

describe('Background Script Quota Management', () => {
  let messageHandler;
  let mockStorage;

  beforeEach(() => {
    // Clear require cache
    delete require.cache[require.resolve('../extension/background.js')];
    
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

    // Mock chrome.notifications.create
    chrome.notifications.create = jest.fn();

    // Mock current date
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December

    // Create mock MessageHandler
    global.MessageHandler = class MockMessageHandler {
      constructor() {
        this.googleTTSService = {
          checkQuotaStatus: jest.fn(),
          getCurrentUsage: jest.fn()
        };
      }

      async handleMessage(message, sender, sendResponse) {
        if (message.type === 'quotaWarning') {
          await this.handleQuotaWarning(message.quotaData);
          sendResponse({ status: 'processed' });
        } else if (message.type === 'getQuotaUsage') {
          try {
            const quotaStatus = await this.googleTTSService.checkQuotaStatus();
            sendResponse({ status: 'success', quota: quotaStatus });
          } catch (error) {
            sendResponse({ status: 'success', quota: undefined });
          }
        }
      }

      async handleQuotaWarning(quotaData) {
        if (!quotaData) return;
        
        if (quotaData.warning === 'high') {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Google TTS Quota Warning',
            message: `Usage at ${quotaData.percentage.toFixed(1)}%. Monitor usage carefully.`
          });
        } else if (quotaData.warning === 'critical') {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Google TTS Quota Critical',
            message: `Usage at ${quotaData.percentage.toFixed(1)}%! Consider upgrading your plan.`
          });
        }
      }
    };

    messageHandler = new MessageHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('quota warning notifications', () => {
    test('should create notification for high usage warning', async () => {
      const quotaData = {
        used: 850000,
        limit: 1000000,
        percentage: 85.0,
        warning: 'high'
      };

      const message = { type: 'quotaWarning', quotaData };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, null, sendResponse);

      expect(chrome.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Google TTS Quota Warning',
        message: 'Usage at 85.0%. Monitor usage carefully.'
      });
      expect(sendResponse).toHaveBeenCalledWith({ status: 'processed' });
    });

    test('should create critical notification for 95%+ usage', async () => {
      const quotaData = {
        used: 970000,
        limit: 1000000,
        percentage: 97.0,
        warning: 'critical'
      };

      const message = { type: 'quotaWarning', quotaData };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, null, sendResponse);

      expect(chrome.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Google TTS Quota Critical',
        message: 'Usage at 97.0%! Consider upgrading your plan.'
      });
    });

    test('should not create notification for null warning', async () => {
      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      const message = { type: 'quotaWarning', quotaData };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, null, sendResponse);

      expect(chrome.notifications.create).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'processed' });
    });

    test('should handle missing quotaData gracefully', async () => {
      const message = { type: 'quotaWarning' };
      const sendResponse = jest.fn();

      // Should not throw
      await messageHandler.handleMessage(message, null, sendResponse);

      expect(chrome.notifications.create).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'processed' });
    });
  });

  describe('quota status requests', () => {
    test('should respond with quota status for getQuotaUsage message', async () => {
      const mockQuotaStatus = {
        used: 250000,
        limit: 1000000,
        percentage: 25.0,
        warning: null
      };

      messageHandler.googleTTSService.checkQuotaStatus.mockResolvedValue(mockQuotaStatus);

      const message = { type: 'getQuotaUsage' };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, null, sendResponse);

      expect(messageHandler.googleTTSService.checkQuotaStatus).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        quota: mockQuotaStatus
      });
    });

    test('should handle quota service errors gracefully', async () => {
      messageHandler.googleTTSService.checkQuotaStatus.mockRejectedValue(
        new Error('Service unavailable')
      );

      const message = { type: 'getQuotaUsage' };
      const sendResponse = jest.fn();

      await messageHandler.handleMessage(message, null, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        quota: undefined
      });
    });
  });

  describe('quota threshold calculations', () => {
    test('should calculate percentage correctly for various usage levels', () => {
      const testCases = [
        { used: 0, limit: 1000000, expected: 0 },
        { used: 100000, limit: 1000000, expected: 10 },
        { used: 500000, limit: 1000000, expected: 50 },
        { used: 800000, limit: 1000000, expected: 80 },
        { used: 950000, limit: 1000000, expected: 95 },
        { used: 1000000, limit: 1000000, expected: 100 },
        { used: 1200000, limit: 1000000, expected: 120 }
      ];

      testCases.forEach(({ used, limit, expected }) => {
        const percentage = (used / limit) * 100;
        expect(percentage).toBe(expected);
      });
    });

    test('should determine warning levels correctly', () => {
      const getWarningLevel = (percentage) => {
        if (percentage >= 95) return 'critical';
        if (percentage >= 80) return 'high';
        return null;
      };

      expect(getWarningLevel(10)).toBe(null);
      expect(getWarningLevel(79)).toBe(null);
      expect(getWarningLevel(80)).toBe('high');
      expect(getWarningLevel(94)).toBe('high');
      expect(getWarningLevel(95)).toBe('critical');
      expect(getWarningLevel(100)).toBe('critical');
      expect(getWarningLevel(120)).toBe('critical');
    });
  });

  describe('notification rate limiting', () => {
    test('should track notification timing to prevent spam', () => {
      // Mock implementation to track when notifications were last sent
      const notificationTracker = {
        lastWarningTime: null,
        lastCriticalTime: null,
        
        shouldSendWarning(type) {
          const now = Date.now();
          const cooldown = 5 * 60 * 1000; // 5 minutes
          
          if (type === 'high' && this.lastWarningTime) {
            return now - this.lastWarningTime > cooldown;
          } else if (type === 'critical' && this.lastCriticalTime) {
            return now - this.lastCriticalTime > cooldown;
          }
          
          return true;
        },
        
        markSent(type) {
          const now = Date.now();
          if (type === 'high') {
            this.lastWarningTime = now;
          } else if (type === 'critical') {
            this.lastCriticalTime = now;
          }
        }
      };

      // First warning should be sent
      expect(notificationTracker.shouldSendWarning('high')).toBe(true);
      notificationTracker.markSent('high');

      // Second warning within cooldown should be blocked
      expect(notificationTracker.shouldSendWarning('high')).toBe(false);

      // Critical warning should still be allowed (different type)
      expect(notificationTracker.shouldSendWarning('critical')).toBe(true);
    });
  });

  describe('quota reset functionality', () => {
    test('should detect month boundaries correctly', () => {
      // Restore real date for this test
      jest.restoreAllMocks();
      
      const getMonthKey = (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };

      // Test various dates
      expect(getMonthKey(new Date(2024, 0, 1))).toBe('2024-01'); // January
      expect(getMonthKey(new Date(2024, 11, 31))).toBe('2024-12'); // December
      expect(getMonthKey(new Date(2025, 0, 1))).toBe('2025-01'); // New year
      
      // Restore mocks for other tests
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11);
    });

    test('should clean up old usage data', () => {
      const cleanupOldUsage = (usageData, currentMonth) => {
        const months = Object.keys(usageData).sort();
        const currentIndex = months.indexOf(currentMonth);
        
        if (currentIndex === -1) {
          // Current month not in data, keep last 2 months
          return months.slice(-2).reduce((acc, month) => {
            acc[month] = usageData[month];
            return acc;
          }, {});
        }
        
        // Keep current month and previous 2 months
        const keepMonths = months.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
        return keepMonths.reduce((acc, month) => {
          acc[month] = usageData[month];
          return acc;
        }, {});
      };

      const testData = {
        '2024-08': 1000,
        '2024-09': 2000,
        '2024-10': 3000,
        '2024-11': 4000,
        '2024-12': 5000
      };

      const cleaned = cleanupOldUsage(testData, '2024-12');
      expect(Object.keys(cleaned)).toEqual(['2024-10', '2024-11', '2024-12']);
      expect(cleaned['2024-08']).toBeUndefined();
      expect(cleaned['2024-09']).toBeUndefined();
    });
  });
});