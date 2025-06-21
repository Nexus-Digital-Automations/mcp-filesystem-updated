// src/__tests__/setup.ts
// Jest test setup file for MCP Filesystem Server

// Global test configuration
beforeEach(() => {
  // Clear all mocks before each test to ensure isolation
  jest.clearAllMocks();
});

// Global error handling for async tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, but log the error
});

// Configure longer timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to avoid noise in test output
const originalConsole = globalThis.console;
globalThis.console = {
  ...originalConsole,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Type definitions for better TypeScript support in tests
declare global {
  var mockFs: {
    stat: jest.Mock;
    realpath: jest.Mock;
    readFile: jest.Mock;
    writeFile: jest.Mock;
    unlink: jest.Mock;
    mkdir: jest.Mock;
    readdir: jest.Mock;
  };
}
