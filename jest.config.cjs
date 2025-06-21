// jest.config.cjs
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  verbose: true,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^fastmcp$': '<rootDir>/src/__tests__/jest.setup.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(fastmcp|@modelcontextprotocol)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.js'],
};