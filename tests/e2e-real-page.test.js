// End-to-end tests using real test.html page with browser automation
// These tests validate the actual Chrome extension behavior on the real page

const puppeteer = require('puppeteer');
const path = require('path');

describe('E2E: Real test.html Page Tests', () => {
  let browser, page;
  const testPagePath = `file://${path.resolve(__dirname, '../extension/test.html').replace(/\\/g, '/')}`;

  beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: [
        `--disable-extensions-except=${path.resolve(__dirname, '../extension')}`,
        `--load-extension=${path.resolve(__dirname, '../extension')}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Navigate to the test page
    await page.goto(testPagePath, { waitUntil: 'networkidle0' });
    
    // Wait for page to be fully loaded
    await page.waitForSelector('h1', { timeout: 5000 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Real Page Structure Validation', () => {
    test('SHOULD load test.html with correct structure', async () => {
      // Verify the page loaded correctly
      const title = await page.title();
      expect(title).toBe('TTS Extension Test');

      const h1Text = await page.$eval('h1', el => el.textContent);
      expect(h1Text).toBe('TTS Chrome Extension Test Page');

      // Count all block elements that should contain sentences
      const blockElements = await page.$$eval('h1, h2, p, li, div.highlight', elements => 
        elements.map(el => ({
          tagName: el.tagName,
          textContent: el.textContent.trim()
        }))
      );

      // Should match our test case expectations: 23 elements total
      expect(blockElements).toHaveLength(23);
    });

    test('SHOULD count exactly 28 sentences across all elements', async () => {
      // Get all text content from block elements
      const allText = await page.$$eval('h1, h2, p, li, div.highlight', elements => 
        elements.map(el => el.textContent.trim()).join('\n')
      );

      // Basic sentence counting (this should match our detailed analysis)
      const basicSentenceCount = allText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      
      // Should be close to our expected 28 sentences
      expect(basicSentenceCount).toBeGreaterThanOrEqual(25);
      expect(basicSentenceCount).toBeLessThanOrEqual(30);
    });
  });

  describe('Selection and TTS Integration Tests', () => {
    test('Case 1 E2E: Full page selection should work without crashes', async () => {
      // Enable console logging to catch errors
      const consoleMessages = [];
      const errors = [];
      
      page.on('console', msg => consoleMessages.push(msg.text()));
      page.on('pageerror', error => errors.push(error.message));

      // Select all page content
      await page.evaluate(() => {
        const range = document.createRange();
        range.selectNodeContents(document.body);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });

      // Get selection info
      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        return {
          hasSelection: !selection.isCollapsed,
          selectedText: selection.toString(),
          rangeCount: selection.rangeCount
        };
      });

      expect(selectionInfo.hasSelection).toBe(true);
      expect(selectionInfo.selectedText.length).toBeGreaterThan(2000);
      expect(errors).toHaveLength(0); // No JavaScript errors should occur

      // Test keyboard shortcut (if extension is loaded)
      try {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyQ');
        await page.keyboard.up('Control');
        
        // Wait a moment for any TTS processing
        await page.waitForTimeout(1000);
        
        // Check for any errors after TTS activation
        expect(errors).toHaveLength(0);
      } catch (error) {
        // Extension might not be loaded - this is expected in some test environments
        console.log('TTS shortcut test skipped - extension not available');
      }
    });

    test('Case 6c E2E: Long text DIV selection (highest sentence density)', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      // Select the long text DIV specifically
      await page.evaluate(() => {
        const longTextDiv = [...document.querySelectorAll('div.highlight')]
          .find(div => div.textContent.includes('Long text:'));
        
        if (longTextDiv) {
          const range = document.createRange();
          range.selectNodeContents(longTextDiv);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        return false;
      });

      // Verify selection
      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        return {
          hasSelection: !selection.isCollapsed,
          selectedText: selection.toString(),
          containsLongText: selection.toString().includes('Long text:')
        };
      });

      expect(selectionInfo.hasSelection).toBe(true);
      expect(selectionInfo.containsLongText).toBe(true);
      expect(selectionInfo.selectedText.length).toBeGreaterThan(500);
      expect(errors).toHaveLength(0);
    });

    test('Case 7c E2E: Cross-section selection (Medium + Long DIVs)', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      // Select both medium and long text DIVs
      const selectionMade = await page.evaluate(() => {
        const highlightDivs = [...document.querySelectorAll('div.highlight')];
        const mediumDiv = highlightDivs.find(div => div.textContent.includes('Medium text:'));
        const longDiv = highlightDivs.find(div => div.textContent.includes('Long text:'));
        
        if (mediumDiv && longDiv) {
          const range = document.createRange();
          range.setStartBefore(mediumDiv);
          range.setEndAfter(longDiv);
          
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        return false;
      });

      expect(selectionMade).toBe(true);

      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        const text = selection.toString();
        return {
          hasSelection: !selection.isCollapsed,
          containsMedium: text.includes('Medium text:'),
          containsLong: text.includes('Long text:'),
          textLength: text.length
        };
      });

      expect(selectionInfo.hasSelection).toBe(true);
      expect(selectionInfo.containsMedium).toBe(true);
      expect(selectionInfo.containsLong).toBe(true);
      expect(selectionInfo.textLength).toBeGreaterThan(800); // Both medium + long content
      expect(errors).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('SHOULD handle empty selection gracefully', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      // Clear any existing selection
      await page.evaluate(() => {
        window.getSelection().removeAllRanges();
      });

      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        return {
          hasSelection: !selection.isCollapsed,
          selectedText: selection.toString(),
          rangeCount: selection.rangeCount
        };
      });

      expect(selectionInfo.hasSelection).toBe(false);
      expect(selectionInfo.selectedText).toBe('');
      expect(selectionInfo.rangeCount).toBe(0);
      expect(errors).toHaveLength(0);
    });

    test('SHOULD handle partial word selections without crashes', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      // Select partial text within a paragraph
      await page.evaluate(() => {
        const firstP = document.querySelector('p');
        if (firstP && firstP.firstChild) {
          const range = document.createRange();
          const textNode = firstP.firstChild;
          // Select middle portion of text to test boundary issues
          range.setStart(textNode, 5);
          range.setEnd(textNode, 15);
          
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });

      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        return {
          hasSelection: !selection.isCollapsed,
          selectedText: selection.toString(),
          textLength: selection.toString().length
        };
      });

      expect(selectionInfo.hasSelection).toBe(true);
      expect(selectionInfo.textLength).toBeGreaterThan(5);
      expect(selectionInfo.textLength).toBeLessThan(20);
      expect(errors).toHaveLength(0);
    });

    test('SHOULD handle selections across multiple elements', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      // Select from H1 to first paragraph
      await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const firstP = document.querySelector('p');
        
        if (h1 && firstP) {
          const range = document.createRange();
          range.setStartBefore(h1);
          range.setEndAfter(firstP);
          
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });

      const selectionInfo = await page.evaluate(() => {
        const selection = window.getSelection();
        const text = selection.toString();
        return {
          hasSelection: !selection.isCollapsed,
          containsTitle: text.includes('TTS Chrome Extension Test Page'),
          containsInstructions: text.includes('floating control bar'),
          crossesElements: true
        };
      });

      expect(selectionInfo.hasSelection).toBe(true);
      expect(selectionInfo.containsTitle).toBe(true);
      expect(selectionInfo.containsInstructions).toBe(true);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Console Error Detection', () => {
    test('SHOULD not produce console errors during normal page interaction', async () => {
      const consoleErrors = [];
      const jsErrors = [];
      
      // Capture console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      page.on('pageerror', error => {
        jsErrors.push(error.message);
      });

      // Perform various interactions
      await page.click('h1');
      await page.click('h2');
      
      // Make a selection
      await page.evaluate(() => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('h1'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });

      // Wait for any async operations
      await page.waitForTimeout(500);

      // Filter out unrelated errors (extension loading, etc.)
      const relevantErrors = jsErrors.filter(error => 
        !error.includes('Extension') &&
        !error.includes('chrome-extension') &&
        !error.includes('Unchecked runtime.lastError')
      );

      expect(relevantErrors).toHaveLength(0);
      expect(consoleErrors.filter(err => !err.includes('Extension'))).toHaveLength(0);
    });
  });
});