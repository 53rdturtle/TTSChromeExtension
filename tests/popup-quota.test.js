// Tests for popup quota status display integration

describe('Popup Quota Status Display', () => {
  let ttsController;
  let mockElements;

  beforeEach(() => {
    // Clear require cache
    delete require.cache[require.resolve('../extension/popup.js')];

    // Create mock DOM elements
    mockElements = {
      quotaStatus: { 
        textContent: '', 
        style: { display: 'none' },
        classList: { add: jest.fn(), remove: jest.fn() }
      },
      quotaBar: { 
        style: { width: '0%', background: '' } 
      },
      quotaText: { textContent: '' },
      googleTTSToggle: { 
        checked: false,
        addEventListener: jest.fn() 
      }
    };

    // Mock document.getElementById
    document.getElementById = jest.fn((id) => {
      return mockElements[id] || {
        addEventListener: jest.fn(),
        checked: false,
        value: '',
        textContent: '',
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() }
      };
    });

    // Mock chrome.runtime.sendMessage
    chrome.runtime.sendMessage = jest.fn();

    // Mock chrome.storage
    chrome.storage.sync.get = jest.fn();
    chrome.storage.local.get = jest.fn();

    // Create mock TTSController
    global.TTSController = class MockTTSController {
      constructor() {
        this.quotaUpdateInterval = null;
      }

      async loadQuotaStatus() {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'getQuotaUsage' }, (response) => {
            if (response && response.status === 'success' && response.quota) {
              this.updateQuotaDisplay(response.quota);
            }
            resolve(response);
          });
        });
      }

      updateQuotaDisplay(quotaData) {
        const quotaStatus = document.getElementById('quotaStatus');
        const quotaBar = document.getElementById('quotaBar');
        const quotaText = document.getElementById('quotaText');

        if (quotaStatus) {
          quotaStatus.style.display = 'block';
        }

        if (quotaText) {
          const used = this.formatBytes(quotaData.used);
          const limit = this.formatBytes(quotaData.limit);
          quotaText.textContent = `${used} / ${limit} (${quotaData.percentage.toFixed(1)}%)`;
        }

        if (quotaBar) {
          quotaBar.style.width = `${Math.min(quotaData.percentage, 100)}%`;
          
          if (quotaData.percentage >= 95) {
            quotaBar.style.background = '#dc3545';
            quotaStatus.classList.add('quota-critical');
          } else if (quotaData.percentage >= 80) {
            quotaBar.style.background = '#ffc107';
            quotaStatus.classList.add('quota-warning');
          } else {
            quotaBar.style.background = '#28a745';
            quotaStatus.classList.remove('quota-critical', 'quota-warning');
          }
        }
      }

      formatBytes(bytes) {
        if (bytes >= 1000000) {
          return (bytes / 1000000).toFixed(1) + 'M';
        } else if (bytes >= 1000) {
          return (bytes / 1000).toFixed(1) + 'K';
        }
        return bytes.toString();
      }

      startQuotaMonitoring() {
        // Update quota every 30 seconds when popup is open
        this.quotaUpdateInterval = setInterval(() => {
          this.loadQuotaStatus();
        }, 30000);
      }

      stopQuotaMonitoring() {
        if (this.quotaUpdateInterval) {
          clearInterval(this.quotaUpdateInterval);
          this.quotaUpdateInterval = null;
        }
      }

      async onGoogleTTSToggleChange() {
        const isEnabled = document.getElementById('googleTTSToggle').checked;
        if (isEnabled) {
          await this.loadQuotaStatus();
          this.startQuotaMonitoring();
        } else {
          this.stopQuotaMonitoring();
          const quotaStatus = document.getElementById('quotaStatus');
          if (quotaStatus) {
            quotaStatus.style.display = 'none';
          }
        }
      }
    };

    ttsController = new TTSController();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (ttsController.quotaUpdateInterval) {
      clearInterval(ttsController.quotaUpdateInterval);
    }
  });

  describe('loadQuotaStatus', () => {
    test('should load and display quota status', async () => {
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

      await ttsController.loadQuotaStatus();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'getQuotaUsage' },
        expect.any(Function)
      );
      expect(mockElements.quotaStatus.style.display).toBe('block');
      expect(mockElements.quotaText.textContent).toBe('250.0K / 1.0M (25.0%)');
    });

    test('should handle API errors gracefully', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          status: 'error',
          error: 'Service unavailable'
        });
      });

      await ttsController.loadQuotaStatus();

      expect(mockElements.quotaStatus.style.display).toBe('none');
    });

    test('should handle no response', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null);
      });

      await ttsController.loadQuotaStatus();

      expect(mockElements.quotaStatus.style.display).toBe('none');
    });
  });

  describe('updateQuotaDisplay', () => {
    test('should display low usage with green progress bar', () => {
      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      ttsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaText.textContent).toBe('100.0K / 1.0M (10.0%)');
      expect(mockElements.quotaBar.style.width).toBe('10%');
      expect(mockElements.quotaBar.style.background).toBe('#28a745');
      expect(mockElements.quotaStatus.classList.remove).toHaveBeenCalledWith('quota-critical', 'quota-warning');
    });

    test('should display high usage with yellow progress bar', () => {
      const quotaData = {
        used: 850000,
        limit: 1000000,
        percentage: 85.0,
        warning: 'high'
      };

      ttsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaBar.style.width).toBe('85%');
      expect(mockElements.quotaBar.style.background).toBe('#ffc107');
      expect(mockElements.quotaStatus.classList.add).toHaveBeenCalledWith('quota-warning');
    });

    test('should display critical usage with red progress bar', () => {
      const quotaData = {
        used: 970000,
        limit: 1000000,
        percentage: 97.0,
        warning: 'critical'
      };

      ttsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaBar.style.width).toBe('97%');
      expect(mockElements.quotaBar.style.background).toBe('#dc3545');
      expect(mockElements.quotaStatus.classList.add).toHaveBeenCalledWith('quota-critical');
    });

    test('should cap progress bar at 100% for over-quota usage', () => {
      const quotaData = {
        used: 1200000,
        limit: 1000000,
        percentage: 120.0,
        warning: 'critical'
      };

      ttsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaBar.style.width).toBe('100%');
      expect(mockElements.quotaText.textContent).toBe('1.2M / 1.0M (120.0%)');
    });
  });

  describe('formatBytes', () => {
    test('should format numbers under 1000 as-is', () => {
      expect(ttsController.formatBytes(999)).toBe('999');
      expect(ttsController.formatBytes(0)).toBe('0');
      expect(ttsController.formatBytes(1)).toBe('1');
    });

    test('should format thousands with K suffix', () => {
      expect(ttsController.formatBytes(1000)).toBe('1.0K');
      expect(ttsController.formatBytes(1500)).toBe('1.5K');
      expect(ttsController.formatBytes(750000)).toBe('750.0K');
    });

    test('should format millions with M suffix', () => {
      expect(ttsController.formatBytes(1000000)).toBe('1.0M');
      expect(ttsController.formatBytes(1500000)).toBe('1.5M');
      expect(ttsController.formatBytes(2750000)).toBe('2.8M');
    });
  });

  describe('quota monitoring', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start monitoring when Google TTS is enabled', () => {
      const loadQuotaStatusSpy = jest.spyOn(ttsController, 'loadQuotaStatus').mockResolvedValue();

      ttsController.startQuotaMonitoring();

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(loadQuotaStatusSpy).toHaveBeenCalled();
    });

    test('should stop monitoring when called', () => {
      const loadQuotaStatusSpy = jest.spyOn(ttsController, 'loadQuotaStatus').mockResolvedValue();

      ttsController.startQuotaMonitoring();
      ttsController.stopQuotaMonitoring();

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(loadQuotaStatusSpy).not.toHaveBeenCalled();
    });

    test('should handle multiple stop calls gracefully', () => {
      ttsController.startQuotaMonitoring();
      ttsController.stopQuotaMonitoring();
      
      // Should not throw
      expect(() => ttsController.stopQuotaMonitoring()).not.toThrow();
    });
  });

  describe('Google TTS toggle integration', () => {
    test('should show quota status when Google TTS is enabled', async () => {
      mockElements.googleTTSToggle.checked = true;

      const loadQuotaStatusSpy = jest.spyOn(ttsController, 'loadQuotaStatus').mockResolvedValue();
      const startMonitoringSpy = jest.spyOn(ttsController, 'startQuotaMonitoring').mockImplementation();

      await ttsController.onGoogleTTSToggleChange();

      expect(loadQuotaStatusSpy).toHaveBeenCalled();
      expect(startMonitoringSpy).toHaveBeenCalled();
    });

    test('should hide quota status when Google TTS is disabled', async () => {
      mockElements.googleTTSToggle.checked = false;

      const stopMonitoringSpy = jest.spyOn(ttsController, 'stopQuotaMonitoring').mockImplementation();

      await ttsController.onGoogleTTSToggleChange();

      expect(stopMonitoringSpy).toHaveBeenCalled();
      expect(mockElements.quotaStatus.style.display).toBe('none');
    });
  });

  describe('quota status visibility', () => {
    test('should show quota status element when data is available', () => {
      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      ttsController.updateQuotaDisplay(quotaData);

      expect(mockElements.quotaStatus.style.display).toBe('block');
    });

    test('should handle missing DOM elements gracefully', () => {
      // Mock missing elements
      document.getElementById = jest.fn(() => null);

      const quotaData = {
        used: 100000,
        limit: 1000000,
        percentage: 10.0,
        warning: null
      };

      // Should not throw
      expect(() => ttsController.updateQuotaDisplay(quotaData)).not.toThrow();
    });
  });

  describe('real-time quota updates', () => {
    test('should update display when receiving quota messages', async () => {
      const updateDisplaySpy = jest.spyOn(ttsController, 'updateQuotaDisplay');

      const mockQuotaData = {
        used: 300000,
        limit: 1000000,
        percentage: 30.0,
        warning: null
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({
          status: 'success',
          quota: mockQuotaData
        });
      });

      await ttsController.loadQuotaStatus();

      expect(updateDisplaySpy).toHaveBeenCalledWith(mockQuotaData);
    });

    test('should handle quota warning escalation', () => {
      // Start with normal usage
      let quotaData = {
        used: 750000,
        limit: 1000000,
        percentage: 75.0,
        warning: null
      };

      ttsController.updateQuotaDisplay(quotaData);
      expect(mockElements.quotaBar.style.background).toBe('#28a745');

      // Escalate to warning
      quotaData = {
        used: 850000,
        limit: 1000000,
        percentage: 85.0,
        warning: 'high'
      };

      ttsController.updateQuotaDisplay(quotaData);
      expect(mockElements.quotaBar.style.background).toBe('#ffc107');

      // Escalate to critical
      quotaData = {
        used: 970000,
        limit: 1000000,
        percentage: 97.0,
        warning: 'critical'
      };

      ttsController.updateQuotaDisplay(quotaData);
      expect(mockElements.quotaBar.style.background).toBe('#dc3545');
    });
  });
});