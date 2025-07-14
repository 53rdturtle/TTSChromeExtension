// E2E test setup
const { execSync } = require('child_process');
const path = require('path');

// Global setup for E2E tests
beforeAll(() => {
  console.log('Setting up E2E test environment...');
  
  // Ensure Chrome is available
  try {
    execSync('google-chrome --version', { stdio: 'ignore' });
  } catch (error) {
    console.warn('Chrome not found, E2E tests may fail');
  }
});

afterAll(() => {
  console.log('Cleaning up E2E test environment...');
});