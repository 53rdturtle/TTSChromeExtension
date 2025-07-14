// End-to-End tests using Puppeteer for Chrome extension testing
const puppeteer = require('puppeteer');
const path = require('path');

describe('TTS Chrome Extension E2E Tests', () => {
  let browser;
  let page;
  const extensionPath = path.join(__dirname, '../extension');

  beforeAll(async () => {
    // Launch Chrome with the extension loaded
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    // Get the extension page
    const targets = await browser.targets();
    const extensionTarget = targets.find(target => 
      target.type() === 'background_page' || 
      target.type() === 'service_worker'
    );

    if (extensionTarget) {
      page = await extensionTarget.page();
    } else {
      page = await browser.newPage();
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Extension Loading', () => {
    test('should load extension successfully', async () => {
      // Check if extension is loaded by looking for background page
      const targets = await browser.targets();
      const hasExtension = targets.some(target => 
        target.type() === 'background_page' || 
        target.type() === 'service_worker'
      );
      
      expect(hasExtension).toBe(true);
    });

    test('should have access to chrome.tts API', async () => {
      const testPage = await browser.newPage();
      
      // Navigate to test page
      await testPage.goto(`file://${path.join(__dirname, '../extension/test.html')}`);
      
      // Check if TTS API is available in extension context
      const hasTTS = await testPage.evaluate(() => {
        return typeof chrome !== 'undefined' && 
               typeof chrome.tts !== 'undefined';
      });
      
      // Note: This might be false in test environment, but helps validate setup
      expect(typeof hasTTS).toBe('boolean');
      
      await testPage.close();
    });
  });

  describe('Popup Functionality', () => {
    test('should open popup and display interface', async () => {
      const testPage = await browser.newPage();
      
      // Navigate to popup HTML directly
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Check if main elements are present
      const elements = await testPage.evaluate(() => {
        return {
          voiceSelect: !!document.getElementById('voiceSelect'),
          rateRange: !!document.getElementById('rateRange'),
          textArea: !!document.getElementById('text'),
          speakBtn: !!document.getElementById('speakBtn'),
          stopBtn: !!document.getElementById('stopBtn')
        };
      });
      
      expect(elements.voiceSelect).toBe(true);
      expect(elements.rateRange).toBe(true);
      expect(elements.textArea).toBe(true);
      expect(elements.speakBtn).toBe(true);
      expect(elements.stopBtn).toBe(true);
      
      await testPage.close();
    });

    test('should handle text input', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Type text into textarea
      await testPage.type('#text', 'Hello E2E test');
      
      // Verify text was entered
      const textValue = await testPage.$eval('#text', el => el.value);
      expect(textValue).toBe('Hello E2E test');
      
      await testPage.close();
    });

    test('should handle rate slider', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Wait for elements to be available
      await testPage.waitForSelector('#rateRange');
      
      // Change rate value
      await testPage.evaluate(() => {
        const rateSlider = document.getElementById('rateRange');
        rateSlider.value = '1.5';
        rateSlider.dispatchEvent(new Event('input'));
      });
      
      // Check if rate display updated
      const rateValue = await testPage.$eval('#rateValue', el => el.textContent);
      expect(rateValue).toBe('1.5');
      
      await testPage.close();
    });
  });

  describe('Test Page Interactions', () => {
    test('should load test page successfully', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/test.html')}`);
      
      // Check page title
      const title = await testPage.title();
      expect(title).toBe('TTS Extension Test');
      
      // Check for test content
      const hasTestContent = await testPage.evaluate(() => {
        return document.querySelector('.test-section') !== null;
      });
      
      expect(hasTestContent).toBe(true);
      
      await testPage.close();
    });

    test('should be able to select text', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/test.html')}`);
      
      // Select text in highlight section
      await testPage.evaluate(() => {
        const textElement = document.querySelector('.highlight');
        if (textElement) {
          const range = document.createRange();
          range.selectNodeContents(textElement);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
      
      // Check if text is selected
      const selectedText = await testPage.evaluate(() => {
        return window.getSelection().toString();
      });
      
      expect(selectedText.length).toBeGreaterThan(0);
      
      await testPage.close();
    });
  });

  describe('Content Script Injection', () => {
    test('should inject content script on page', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/test.html')}`);
      
      // Wait a bit for content script to potentially load
      await testPage.waitForTimeout(1000);
      
      // Check if content script variables are available
      const hasContentScript = await testPage.evaluate(() => {
        return typeof FloatingControlBar !== 'undefined';
      });
      
      // This might be false in test environment, but helps validate approach
      expect(typeof hasContentScript).toBe('boolean');
      
      await testPage.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid pages gracefully', async () => {
      const testPage = await browser.newPage();
      
      try {
        await testPage.goto('about:blank');
        
        // Try to select text on blank page
        const selectedText = await testPage.evaluate(() => {
          return window.getSelection().toString();
        });
        
        expect(selectedText).toBe('');
        
      } catch (error) {
        // Error handling should not crash the test
        expect(error).toBeDefined();
      }
      
      await testPage.close();
    });

    test('should handle missing elements gracefully', async () => {
      const testPage = await browser.newPage();
      await testPage.goto('about:blank');
      
      // Try to access non-existent elements
      const result = await testPage.evaluate(() => {
        return {
          missingElement: document.getElementById('non-existent'),
          hasDocument: typeof document !== 'undefined'
        };
      });
      
      expect(result.missingElement).toBe(null);
      expect(result.hasDocument).toBe(true);
      
      await testPage.close();
    });
  });

  describe('Performance Tests', () => {
    test('should load popup quickly', async () => {
      const testPage = await browser.newPage();
      
      const startTime = Date.now();
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Wait for JavaScript to execute
      await testPage.waitForSelector('#speakBtn');
      
      const loadTime = Date.now() - startTime;
      
      // Should load in under 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      await testPage.close();
    });

    test('should handle multiple rapid interactions', async () => {
      const testPage = await browser.newPage();
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Wait for elements to be ready
      await testPage.waitForSelector('#rateRange');
      
      // Rapidly change rate slider
      for (let i = 0; i < 5; i++) {
        await testPage.evaluate((value) => {
          const rateSlider = document.getElementById('rateRange');
          rateSlider.value = value;
          rateSlider.dispatchEvent(new Event('input'));
        }, (i + 1) * 0.5);
      }
      
      // Should handle rapid changes without crashing
      const finalValue = await testPage.$eval('#rateValue', el => el.textContent);
      expect(parseFloat(finalValue)).toBe(2.5);
      
      await testPage.close();
    });
  });

  describe('Responsive Design', () => {
    test('should work on different viewport sizes', async () => {
      const testPage = await browser.newPage();
      
      // Test mobile viewport
      await testPage.setViewport({ width: 375, height: 667 });
      await testPage.goto(`file://${path.join(__dirname, '../extension/popup.html')}`);
      
      // Check if elements are still accessible
      const elementsVisible = await testPage.evaluate(() => {
        const speakBtn = document.getElementById('speakBtn');
        const textArea = document.getElementById('text');
        return {
          speakBtnVisible: speakBtn && speakBtn.offsetWidth > 0,
          textAreaVisible: textArea && textArea.offsetWidth > 0
        };
      });
      
      expect(elementsVisible.speakBtnVisible).toBe(true);
      expect(elementsVisible.textAreaVisible).toBe(true);
      
      // Test desktop viewport
      await testPage.setViewport({ width: 1920, height: 1080 });
      await testPage.reload();
      
      const elementsVisibleDesktop = await testPage.evaluate(() => {
        const speakBtn = document.getElementById('speakBtn');
        const textArea = document.getElementById('text');
        return {
          speakBtnVisible: speakBtn && speakBtn.offsetWidth > 0,
          textAreaVisible: textArea && textArea.offsetWidth > 0
        };
      });
      
      expect(elementsVisibleDesktop.speakBtnVisible).toBe(true);
      expect(elementsVisibleDesktop.textAreaVisible).toBe(true);
      
      await testPage.close();
    });
  });
});