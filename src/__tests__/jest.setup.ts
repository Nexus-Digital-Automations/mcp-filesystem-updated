// src/__tests__/jest.setup.ts
// Mock fastmcp at the global level for Jest compatibility

// TypeScript global augmentation for test utilities
declare global {
  var mockUserError: new (message: string) => Error;
  var createMockFs: () => any;
}

// Mock fastmcp UserError class
global.mockUserError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
};

// Mock fastmcp module
jest.mock('fastmcp', () => ({
  UserError: global.mockUserError,
}));

// Global test utilities
global.createMockFs = () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  appendFile: jest.fn(),
  copyFile: jest.fn(),
  rename: jest.fn(),
  readdir: jest.fn(),
  realpath: jest.fn(),
});

// Configure default test timeout
jest.setTimeout(10000);
