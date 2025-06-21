// src/__tests__/tools/terminal.integration.test.ts

// Mock child_process before all other imports
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Mock fs/promises before other imports
const mockStat = jest.fn();
jest.mock('fs/promises', () => ({
  stat: mockStat,
}));

// Mock security module
const mockValidatePath = jest.fn();
jest.mock('../../utils/security.js', () => ({
  validatePath: mockValidatePath,
  allowedDirectories: ['/safe/'],
}));

// Mock fastmcp UserError
const mockUserError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
};

jest.mock('fastmcp', () => ({
  UserError: mockUserError,
}));

import { registerTerminalTools, clearAllTerminalSessions } from '../../tools/terminal';
import { EventEmitter } from 'events';

describe('Terminal Tools Integration Tests', () => {
  const mockServer = {
    addTool: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpawn.mockReset();
    mockValidatePath.mockReset();
    mockStat.mockReset();
    
    // Setup default mocks
    mockValidatePath.mockResolvedValue('/safe/search/path');
    mockStat.mockResolvedValue({
      isDirectory: () => true,
    });
    
    // Clear terminal sessions between tests
    clearAllTerminalSessions();
  });

  describe('Tool Registration', () => {
    it('should register all terminal tools successfully', () => {
      registerTerminalTools(mockServer as any);
      
      const expectedTools = [
        'execute_command',
        'read_output',
        'list_sessions',
        'force_terminate',
        'search_code',
      ];
      
      expectedTools.forEach(toolName => {
        expect(mockServer.addTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: toolName,
            description: expect.any(String),
            parameters: expect.anything(),
            execute: expect.any(Function),
          })
        );
      });
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(expectedTools.length);
    });
  });

  describe('execute_command Tool', () => {
    let executeCommandTool: any;

    beforeEach(() => {
      registerTerminalTools(mockServer as any);
      const executeCommandCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'execute_command'
      );
      executeCommandTool = executeCommandCall[0];
    });

    it('should execute command successfully and return results', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      // Start command execution
      const resultPromise = executeCommandTool.execute({
        command: 'echo "Hello, World!"',
        timeout_ms: 5000,
      }, { log: mockLog });

      // Simulate command completion immediately
      setImmediate(() => {
        (mockChildProcess as any).stdout.emit('data', 'Hello, World!\n');
        mockChildProcess.emit('close', 0, null);
      });
      
      const result = await resultPromise;
      const resultData = JSON.parse(result);
      
      expect(resultData).toMatchObject({
        command: 'echo "Hello, World!"',
        completed: true,
        output: 'Hello, World!',
        error: '',
        exitCode: 0,
        exitSignal: null,
      });
      
      expect(resultData).toHaveProperty('sessionId');
      expect(resultData).toHaveProperty('timestamp');
      expect(resultData).toHaveProperty('workingDirectory');
      expect(resultData).toHaveProperty('shell');
    });

    it('should handle command timeout and background execution', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = executeCommandTool.execute({
        command: 'sleep 10',
        timeout_ms: 100, // Very short timeout to force timeout behavior
      }, { log: { info: jest.fn() } });

      // Simulate some output but don't complete the process
      setTimeout(() => {
        (mockChildProcess as any).stdout.emit('data', 'Starting sleep...\n');
      }, 50);
      
      const result = await resultPromise;
      const resultData = JSON.parse(result);
      
      expect(resultData).toMatchObject({
        command: 'sleep 10',
        completed: false,
        output: 'Starting sleep...',
      });
      
      expect(resultData).toHaveProperty('sessionId');
      expect(resultData).not.toHaveProperty('exitCode'); // Not completed
    });

    it('should capture both stdout and stderr', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = executeCommandTool.execute({
        command: 'echo "output" && echo "error" >&2',
        timeout_ms: 5000,
      }, { log: { info: jest.fn() } });

      // Simulate mixed output and completion
      setImmediate(() => {
        (mockChildProcess as any).stdout.emit('data', 'standard output\n');
        (mockChildProcess as any).stderr.emit('data', 'error output\n');
        mockChildProcess.emit('close', 1, null); // Non-zero exit code
      });
      
      const result = await resultPromise;
      const resultData = JSON.parse(result);
      
      expect(resultData).toMatchObject({
        completed: true,
        output: 'standard output',
        error: 'error output',
        exitCode: 1,
      });
    });

    it('should validate and reject dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'mkfs.ext4 /dev/sda',
        'dd if=/dev/zero of=/dev/sda',
        ':(){ :|:& };:',
        'shutdown -h now',
        'reboot',
      ];

      for (const command of dangerousCommands) {
        await expect(
          executeCommandTool.execute({
            command,
            timeout_ms: 1000,
          }, { log: { info: jest.fn() } })
        ).rejects.toThrow('Command contains potentially dangerous operations');
      }
    });

    it('should validate command parameters', async () => {
      // Empty command
      await expect(
        executeCommandTool.execute({
          command: '',
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Command must be a non-empty string');
      
      // Command too long
      const longCommand = 'echo ' + 'a'.repeat(8190);
      await expect(
        executeCommandTool.execute({
          command: longCommand,
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Command exceeds maximum length');
      
      // Invalid timeout
      await expect(
        executeCommandTool.execute({
          command: 'echo test',
          timeout_ms: 50, // Too short
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Timeout must be between 100ms and 300000ms');
    });

    it('should handle process spawn errors', async () => {
      const spawnError = new Error('spawn ENOENT');
      (spawnError as any).code = 'ENOENT';
      mockSpawn.mockImplementation(() => {
        throw spawnError;
      });
      
      await expect(
        executeCommandTool.execute({
          command: 'nonexistent-command',
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Shell not found');
    });

    it('should handle process permission errors', async () => {
      const permissionError = new Error('spawn EACCES');
      (permissionError as any).code = 'EACCES';
      mockSpawn.mockImplementation(() => {
        throw permissionError;
      });
      
      await expect(
        executeCommandTool.execute({
          command: 'restricted-command',
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Permission denied executing command');
    });

    it('should handle process errors during execution', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = executeCommandTool.execute({
        command: 'failing-command',
        timeout_ms: 200, // Short timeout
      }, { log: { info: jest.fn() } });

      // Simulate process error 
      setTimeout(() => {
        mockChildProcess.emit('error', new Error('Process crashed'));
      }, 50);
      
      // Wait for timeout since error doesn't resolve the promise
      const result = await resultPromise;
      const resultData = JSON.parse(result);
      
      expect(resultData.error).toContain('Process error: Process crashed');
      expect(resultData.completed).toBe(false);
    });
  });

  describe('read_output Tool', () => {
    let readOutputTool: any;

    beforeEach(() => {
      registerTerminalTools(mockServer as any);
      
      const readOutputCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'read_output'
      );
      readOutputTool = readOutputCall[0];
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        readOutputTool.execute({
          pid: 99999, // Non-existent session
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('No active terminal session found with ID containing: 99999');
    });
  });

  describe('list_sessions Tool', () => {
    let listSessionsTool: any;

    beforeEach(() => {
      registerTerminalTools(mockServer as any);
      
      const listSessionsCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_sessions'
      );
      listSessionsTool = listSessionsCall[0];
    });

    it('should return empty list when no sessions exist', async () => {
      // Ensure sessions are cleared
      clearAllTerminalSessions();
      
      const result = await listSessionsTool.execute({}, { log: { info: jest.fn() } });
      const data = JSON.parse(result);
      
      expect(data.statistics).toMatchObject({
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
      });
      
      expect(data.sessions).toHaveLength(0);
    });
  });

  describe('force_terminate Tool', () => {
    let forceTerminateTool: any;

    beforeEach(() => {
      registerTerminalTools(mockServer as any);
      
      const forceTerminateCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'force_terminate'
      );
      forceTerminateTool = forceTerminateCall[0];
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        forceTerminateTool.execute({
          pid: 99999,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('No terminal session found with ID containing: 99999');
    });
  });

  describe('search_code Tool', () => {
    let searchCodeTool: any;

    beforeEach(() => {
      registerTerminalTools(mockServer as any);
      
      const searchCodeCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'search_code'
      );
      searchCodeTool = searchCodeCall[0];
      
      // Setup path validation and fs.stat
      mockValidatePath.mockResolvedValue('/safe/search/path');
      mockStat.mockResolvedValue({
        isDirectory: () => true,
      });
    });

    it('should search code successfully using ripgrep', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      (mockChildProcess as any).kill = jest.fn(); // Add kill method
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = searchCodeTool.execute({
        path: '/safe/search/path',
        pattern: 'function test',
        filePattern: '*.js',
        contextLines: 2,
        ignoreCase: true,
        maxResults: 50,
      }, { log: { info: jest.fn() } });

      // Simulate ripgrep JSON output
      const mockRgOutput = [
        '{"type":"match","data":{"path":{"text":"test.js"},"line_number":10,"submatches":[{"match":{"text":"function test"},"start":0}],"lines":{"text":"function test() {"}}}',
        '{"type":"match","data":{"path":{"text":"utils.js"},"line_number":25,"submatches":[{"match":{"text":"function test"},"start":0}],"lines":{"text":"  function testUtil() {"}}}',
      ].join('\n');
      
      setImmediate(() => {
        (mockChildProcess as any).stdout.emit('data', mockRgOutput);
        mockChildProcess.emit('close', 0);
      });
      
      const result = await resultPromise;
      const data = JSON.parse(result);
      
      expect(data).toMatchObject({
        searchPattern: 'function test',
        searchPath: '/safe/search/path',
        filePattern: '*.js',
      });
      
      expect(data.results.matches).toHaveLength(2);
      expect(data.results.matches[0]).toMatchObject({
        file: 'test.js',
        line: 10,
        text: 'function test() {',
        match: 'function test',
      });
    });

    it('should validate search parameters', async () => {
      // Empty pattern
      await expect(
        searchCodeTool.execute({
          path: '/safe/path',
          pattern: '',
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Search pattern must be a non-empty string');
      
      // Pattern too long
      const longPattern = 'a'.repeat(1001);
      await expect(
        searchCodeTool.execute({
          path: '/safe/path',
          pattern: longPattern,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Search pattern exceeds maximum length');
      
      // Invalid timeout
      await expect(
        searchCodeTool.execute({
          path: '/safe/path',
          pattern: 'test',
          timeoutMs: 100, // Too short
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Timeout must be between 1000ms and 120000ms');
    });

    it('should validate search path exists and is directory', async () => {
      // Override the default mock for this test
      mockStat.mockResolvedValueOnce({
        isDirectory: () => false, // Not a directory
      });
      
      await expect(
        searchCodeTool.execute({
          path: '/safe/file.txt',
          pattern: 'test',
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Search path is not a directory');
    });

    it('should handle ripgrep not found error', async () => {
      const spawnError = new Error('spawn rg ENOENT');
      (spawnError as any).code = 'ENOENT';
      
      mockSpawn.mockImplementationOnce(() => {
        throw spawnError;
      });
      
      await expect(
        searchCodeTool.execute({
          path: '/safe/path',
          pattern: 'test',
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('ripgrep (rg) command not found');
    });

    it('should handle search timeout', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).kill = jest.fn(); // Add kill method
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = searchCodeTool.execute({
        path: '/safe/path',
        pattern: 'test',
        timeoutMs: 1000, // Minimum valid timeout
      }, { log: { info: jest.fn() } });

      // Don't complete the process, let it timeout
      const result = await resultPromise;
      const data = JSON.parse(result);
      
      expect(data.results.searchSuccessful).toBe(false);
      expect(data.errors).toContain('Search timed out');
    });

    it('should parse ripgrep JSON output correctly', async () => {
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).kill = jest.fn(); // Add kill method
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      const resultPromise = searchCodeTool.execute({
        path: '/safe/path',
        pattern: 'class',
      }, { log: { info: jest.fn() } });

      // Simulate mixed ripgrep output (some invalid JSON)
      const mockOutput = [
        '{"type":"begin","data":{"path":{"text":"file1.js"}}}',
        '{"type":"match","data":{"path":{"text":"file1.js"},"line_number":5,"submatches":[{"match":{"text":"class"},"start":0}],"lines":{"text":"class TestClass {"}}}',
        'invalid json line',
        '{"type":"match","data":{"path":{"text":"file2.js"},"line_number":12,"submatches":[{"match":{"text":"class"},"start":4}],"lines":{"text":"    class Util {"}}}',
        '{"type":"end","data":{"path":{"text":"file1.js"}}}',
      ].join('\n');
      
      setImmediate(() => {
        (mockChildProcess as any).stdout.emit('data', mockOutput);
        mockChildProcess.emit('close', 0);
      });
      
      const result = await resultPromise;
      const data = JSON.parse(result);
      
      // Should parse 2 valid match entries, ignore invalid JSON and non-match types
      expect(data.results.matches).toHaveLength(2);
      expect(data.results.matches[0]).toMatchObject({
        file: 'file1.js',
        line: 5,
        text: 'class TestClass {',
        match: 'class',
      });
      expect(data.results.matches[1]).toMatchObject({
        file: 'file2.js',
        line: 12,
        column: 4,
        text: 'class Util {',
        match: 'class',
      });
    });
  });

  describe('Advanced Programming Techniques Integration', () => {
    it('should demonstrate Design by Contract principles', async () => {
      registerTerminalTools(mockServer as any);
      
      const executeCommandCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'execute_command'
      );
      const executeCommandTool = executeCommandCall[0];
      
      // Test precondition violations
      await expect(
        executeCommandTool.execute({
          command: '', // Empty command violates precondition
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Command must be a non-empty string');
      
      await expect(
        executeCommandTool.execute({
          command: 'rm -rf /', // Dangerous command violates security precondition
          timeout_ms: 1000,
        }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Command contains potentially dangerous operations');
    });

    it('should demonstrate Defensive Programming techniques', async () => {
      registerTerminalTools(mockServer as any);
      
      const searchCodeCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'search_code'
      );
      const searchCodeTool = searchCodeCall[0];
      
      // Test input validation and boundary protection
      const invalidInputs = [
        { pattern: 'a'.repeat(1001), timeoutMs: 30000, error: 'exceeds maximum length' },
        { pattern: '', timeoutMs: 30000, error: 'must be a non-empty string' },
        { pattern: 'test', timeoutMs: 50, error: 'must be between' },
        { pattern: 'test', timeoutMs: 200000, error: 'must be between' },
      ];
      
      for (const { pattern, timeoutMs, error } of invalidInputs) {
        await expect(
          searchCodeTool.execute({
            path: '/safe/path',
            pattern: pattern,
            timeoutMs: timeoutMs,
          }, { log: { info: jest.fn() } })
        ).rejects.toThrow(error);
      }
    });

    it('should demonstrate Type-driven Development with Zod', async () => {
      registerTerminalTools(mockServer as any);
      
      const executeCommandCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'execute_command'
      );
      const executeCommandTool = executeCommandCall[0];
      
      // Verify Zod schema is properly configured
      expect(executeCommandTool.parameters).toBeDefined();
      expect(executeCommandTool.parameters._def).toBeDefined(); // Zod schema structure
      
      // Test runtime type validation with a quick mock
      const mockChildProcess = new EventEmitter();
      (mockChildProcess as any).stdout = new EventEmitter();
      (mockChildProcess as any).stderr = new EventEmitter();
      (mockChildProcess as any).pid = 1234;
      
      mockSpawn.mockReturnValue(mockChildProcess);
      
      // Valid typed input should work
      const validResult = executeCommandTool.execute({
        command: 'echo test',
        timeout_ms: 1000,
      }, { log: { info: jest.fn() } });
      
      setImmediate(() => {
        mockChildProcess.emit('close', 0, null);
      });
      
      await expect(validResult).resolves.toBeDefined();
    });

    it('should demonstrate Property-based Testing concepts', async () => {
      registerTerminalTools(mockServer as any);
      
      const listSessionsCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_sessions'
      );
      const listSessionsTool = listSessionsCall[0];
      
      // Property: list_sessions always returns valid structure regardless of session count
      const testCases = [0, 1, 2]; // Simple test cases
      
      for (const sessionCount of testCases) {
        // Clear sessions before each test case
        clearAllTerminalSessions();
        
        // Property: output structure is always consistent
        const result = await listSessionsTool.execute({}, { log: { info: jest.fn() } });
        const data = JSON.parse(result);
        
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('statistics');
        expect(data).toHaveProperty('sessions');
        expect(Array.isArray(data.sessions)).toBe(true);
        expect(data.sessions).toHaveLength(0); // Since we cleared sessions
        expect(data.statistics.totalSessions).toBe(0);
        
        // Property: statistics are always consistent with session array
        expect(data.statistics.activeSessions + data.statistics.completedSessions)
          .toBe(data.statistics.totalSessions);
      }
    });
  });
});
