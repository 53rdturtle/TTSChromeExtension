module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1, // E2E tests should run sequentially
  collectCoverageFrom: [
    'TTSChromeExtension/**/*.js',
    '!TTSChromeExtension/test.html'
  ]
};