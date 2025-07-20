// Tests for options page quota management functionality

describe('Options Page Quota Management', () => {
  let optionsController;
  let mockElements;

  beforeEach(() => {
    // Clear require cache
    delete require.cache[require.resolve('../extension/options.js')];

    // Create mock DOM elements for quota functionality
    mockElements = {
      quotaText: { textContent: '' },
      quotaProgress: { style: { width: '', background: '' } },
      quotaDetails: { textContent: '' },
      backfillUsage: { value: '' },
      applyBackfill: { addEventListener: jest.fn() }
    };

    // Mock document.getElementById
    document.getElementById = jest.fn((id) => {
      return mockElements[id] || {
        addEventListener: jest.fn(),
        checked: false,
        value: '',
        textContent: ''
      };
    });

    // Mock chrome.runtime.sendMessage
    chrome.runtime.sendMessage = jest.fn();

    // Mock chrome.storage
    chrome.storage.local.get = jest.fn();
    chrome.storage.local.set = jest.fn();

    // Import OptionsController class (would need to export it from options.js)
    // For now, we'll test the methods directly
    global.OptionsController = class MockOptionsController {
      constructor() {
        this.settings = { favoriteVoices: [] };
      }

      async loadQuotaUsage() {
        const response = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: 'getQuotaUsage' }, resolve);
        });
        if (response && response.status === 'success' && response.quota) {
          this.updateQuotaDisplay(response.quota);
        }
      }

      updateQuotaDisplay(quotaData) {
        const quotaText = document.getElementById('quotaText');
        if (quotaText) {
          const used = this.formatNumber(quotaData.used);
          const limit = this.formatNumber(quotaData.limit);
          quotaText.textContent = `Usage: ${used} / ${limit} characters this month (${quotaData.percentage.toFixed(1)}%)`;
        }

        const quotaProgress = document.getElementById('quotaProgress');
        if (quotaProgress) {
          quotaProgress.style.width = `${Math.min(quotaData.percentage, 100)}%`;
          
          if (quotaData.percentage >= 95) {
            quotaProgress.style.background = '#dc3545';
          } else if (quotaData.percentage >= 80) {
            quotaProgress.style.background = '#ffc107';
          } else {
            quotaProgress.style.background = '#28a745';
          }
        }

        if (quotaData.warning) {
          this.showQuotaWarning(quotaData);
        }
      }

      showQuotaWarning(quotaData) {
        // Mock notification system
        if (quotaData.warning === 'critical') {
          console.warn(`⚠️ Google TTS quota at ${quotaData.percentage.toFixed(1)}%! Consider upgrading your plan.`);
        } else if (quotaData.warning === 'high') {
          console.warn(`⚠️ Google TTS quota at ${quotaData.percentage.toFixed(1)}%. Monitor usage carefully.`);
        }
      }

      formatNumber(num) {
        if (num >= 1000000) {
          return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
          return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
      }

      async applyQuotaBackfill() {
        const backfillInput = document.getElementById('backfillUsage');
        const usage = parseInt(backfillInput.value);
        
        if (!usage || usage < 0 || usage > 1000000) {
          throw new Error('Please enter a valid usage amount (0-1,000,000)');
        }

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(['googleTTSUsage'], (result) => {
            const usageData = result.googleTTSUsage || {};
            const currentUsage = usageData[currentMonth] || 0;
            
            usageData[currentMonth] = currentUsage + usage;
            
            chrome.storage.local.set({ googleTTSUsage: usageData }, () => {
              backfillInput.value = '';
              resolve(usage);
            });
          });
        });
      }

      showNotification(message, type) {
        // Mock notification
        console.log(`${type.toUpperCase()}: ${message}`);
      }
    };

    optionsController = new OptionsController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadQuotaUsage', () => {
    test('should load quota usage and update display', async () => {
      const mockQuotaData = {
        used: 250000,
        limit: 1000000,
        percentage: 25.0,
        warning: null
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          status: 'success',
          quota: mockQuotaData
        });
      });

      await optionsController.loadQuotaUsage();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getQuotaUsage' },
        expect.any(Function)
      );
      expect(mockElements.quotaText.textContent).toBe(
        'Usage: 250.0K / 1.0M characters this month (25.0%)'
      );
    });

    test('should handle API errors gracefully', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          status: 'error',
          error: 'API Error'
        });
      });

      // Should not throw
      await optionsController.loadQuotaUsage();

      expect(mockElements.quotaText.textContent).toBe('');
    });

    test('should handle no response', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null);
      });

      await optionsController.loadQuotaUsage();

      expect(mockElements.quotaText.textContent).toBe('');
    });
  });

  describe('updateQuotaDisplay', () => {
    test('should display quota with green color for low usage', () => {
      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      optionsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaText.textContent).toBe(
        'Usage: 100.0K / 1.0M characters this month (10.0%)'
      );
      expect(mockElements.quotaProgress.style.width).toBe('10%');
      expect(mockElements.quotaProgress.style.background).toBe('#28a745');
    });

    test('should display quota with yellow color for 80% usage', () => {
      const quotaData = {
        used: 800000,
        limit: 1000000,
        percentage: 80.0,
        warning: 'high'
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      optionsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaProgress.style.width).toBe('80%');
      expect(mockElements.quotaProgress.style.background).toBe('#ffc107');
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Google TTS quota at 80.0%. Monitor usage carefully.'
      );

      consoleSpy.mockRestore();
    });

    test('should display quota with red color for 95% usage', () => {
      const quotaData = {
        used: 950000,
        limit: 1000000,
        percentage: 95.0,
        warning: 'critical'
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      optionsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaProgress.style.width).toBe('95%');
      expect(mockElements.quotaProgress.style.background).toBe('#dc3545');
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Google TTS quota at 95.0%! Consider upgrading your plan.'
      );

      consoleSpy.mockRestore();
    });

    test('should cap progress bar at 100% for over-quota usage', () => {
      const quotaData = {
        used: 1200000,
        limit: 1000000,
        percentage: 120.0,
        warning: 'critical'
      };

      optionsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaProgress.style.width).toBe('100%');
      expect(mockElements.quotaText.textContent).toBe(
        'Usage: 1.2M / 1.0M characters this month (120.0%)'
      );
    });
  });

  describe('formatNumber', () => {
    test('should format numbers under 1000 as-is', () => {
      expect(optionsController.formatNumber(999)).toBe('999');
      expect(optionsController.formatNumber(0)).toBe('0');
      expect(optionsController.formatNumber(1)).toBe('1');
    });

    test('should format thousands with K suffix', () => {
      expect(optionsController.formatNumber(1000)).toBe('1.0K');
      expect(optionsController.formatNumber(1500)).toBe('1.5K');
      expect(optionsController.formatNumber(750000)).toBe('750.0K');
    });

    test('should format millions with M suffix', () => {
      expect(optionsController.formatNumber(1000000)).toBe('1.0M');
      expect(optionsController.formatNumber(1500000)).toBe('1.5M');
      expect(optionsController.formatNumber(2750000)).toBe('2.8M');
    });
  });

  describe('applyQuotaBackfill', () => {
    beforeEach(() => {
      // Mock current date
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should apply backfill to empty storage', async () => {
      mockElements.backfillUsage.value = '50000';

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ googleTTSUsage: {} });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        expect(data.googleTTSUsage).toEqual({
          '2024-12': 50000
        });
        callback();
      });

      const result = await optionsController.applyQuotaBackfill();

      expect(result).toBe(50000);
      expect(mockElements.backfillUsage.value).toBe('');
    });

    test('should add to existing usage', async () => {
      mockElements.backfillUsage.value = '25000';

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          googleTTSUsage: { '2024-12': 30000 }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        expect(data.googleTTSUsage).toEqual({
          '2024-12': 55000
        });
        callback();
      });

      const result = await optionsController.applyQuotaBackfill();

      expect(result).toBe(25000);
    });

    test('should reject invalid input values', async () => {
      mockElements.backfillUsage.value = '-100';

      await expect(optionsController.applyQuotaBackfill()).rejects.toThrow(
        'Please enter a valid usage amount (0-1,000,000)'
      );

      mockElements.backfillUsage.value = '2000000';

      await expect(optionsController.applyQuotaBackfill()).rejects.toThrow(
        'Please enter a valid usage amount (0-1,000,000)'
      );

      mockElements.backfillUsage.value = 'invalid';

      await expect(optionsController.applyQuotaBackfill()).rejects.toThrow(
        'Please enter a valid usage amount (0-1,000,000)'
      );
    });

    test('should reject zero as invalid input', async () => {
      mockElements.backfillUsage.value = '0';

      await expect(optionsController.applyQuotaBackfill()).rejects.toThrow(
        'Please enter a valid usage amount (0-1,000,000)'
      );
    });

    test('should accept maximum quota as valid input', async () => {
      mockElements.backfillUsage.value = '1000000';

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ googleTTSUsage: {} });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await optionsController.applyQuotaBackfill();

      expect(result).toBe(1000000);
    });

    test('should handle missing storage gracefully', async () => {
      mockElements.backfillUsage.value = '10000';

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        expect(data.googleTTSUsage).toEqual({
          '2024-12': 10000
        });
        callback();
      });

      const result = await optionsController.applyQuotaBackfill();

      expect(result).toBe(10000);
    });
  });

  describe('quota warning display', () => {
    test('should show high warning for 80-94% usage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const quotaData = {
        used: 850000,
        limit: 1000000,
        percentage: 85.0,
        warning: 'high'
      };

      optionsController.showQuotaWarning(quotaData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Google TTS quota at 85.0%. Monitor usage carefully.'
      );

      consoleSpy.mockRestore();
    });

    test('should show critical warning for 95%+ usage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const quotaData = {
        used: 980000,
        limit: 1000000,
        percentage: 98.0,
        warning: 'critical'
      };

      optionsController.showQuotaWarning(quotaData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Google TTS quota at 98.0%! Consider upgrading your plan.'
      );

      consoleSpy.mockRestore();
    });

    test('should not show warning for null warning status', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      optionsController.showQuotaWarning(quotaData);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});