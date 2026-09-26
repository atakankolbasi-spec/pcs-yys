const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    acceptDownloads: true,
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {})
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: !process.env.CI
  }
});
