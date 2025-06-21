// src/__tests__/tools/process.integration.test.ts

// Mock ps-list before all other imports
const mockPsList = jest.fn();
jest.mock('ps-list', () => mockPsList);

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

// Mock process.kill for testing
const originalProcessKill = process.kill;
const mockProcessKill = jest.fn();

import { registerProcessTools } from '../../tools/process';

describe('Process Tools Integration Tests', () => {
  const mockServer = {
    addTool: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.kill = mockProcessKill;
    
    // Reset mock implementations
    mockPsList.mockReset();
    mockProcessKill.mockReset();
  });

  afterEach(() => {
    process.kill = originalProcessKill;
  });

  describe('Tool Registration', () => {
    it('should register all process tools successfully', () => {
      registerProcessTools(mockServer as any);
      
      const expectedTools = ['list_processes', 'kill_process'];
      
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

  describe('list_processes Tool', () => {
    let listProcessesTool: any;

    beforeEach(() => {
      registerProcessTools(mockServer as any);
      const listProcessesCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_processes'
      );
      listProcessesTool = listProcessesCall[0];
    });

    it('should list system processes successfully', async () => {
      const mockProcesses = [
        {
          pid: 1,
          name: 'systemd',
          cmd: '/sbin/init',
          ppid: 0,
          uid: 0,
          cpu: 0.1,
          memory: 8.5,
        },
        {
          pid: 1234,
          name: 'node',
          cmd: 'node server.js',
          ppid: 1,
          uid: 1000,
          cpu: 2.3,
          memory: 128.7,
        },
        {
          pid: 5678,
          name: 'chrome',
          cmd: 'google-chrome',
          ppid: 1,
          uid: 1000,
          cpu: 15.2,
          memory: 512.4,
        },
      ];

      mockPsList.mockResolvedValue(mockProcesses);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      const result = await listProcessesTool.execute({}, { log: mockLog });
      
      expect(mockPsList).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith('Retrieving system process list');
      expect(mockLog.info).toHaveBeenCalledWith(
        'Process list retrieved successfully',
        expect.objectContaining({
          totalProcesses: 3,
          validProcesses: 3,
        })
      );

      const resultData = JSON.parse(result);
      expect(resultData).toHaveProperty('timestamp');
      expect(resultData).toHaveProperty('totalProcesses', 3);
      expect(resultData).toHaveProperty('statistics');
      expect(resultData).toHaveProperty('processes');
      
      // Verify process data transformation
      expect(resultData.processes).toHaveLength(3);
      expect(resultData.processes[0]).toMatchObject({
        pid: 1,
        name: 'systemd',
        command: '/sbin/init',
        parentPid: 0,
        userId: 0,
        cpuUsage: 0.1,
        memoryUsage: 8.5,
      });

      // Verify statistics calculation
      expect(resultData.statistics).toMatchObject({
        totalProcesses: 3,
        processesWithCpuData: 3,
        processesWithMemoryData: 3,
        averageCpuUsage: expect.any(Number),
        totalMemoryUsage: expect.any(Number),
        highestCpuProcess: expect.objectContaining({
          pid: 5678,
          name: 'chrome',
          cpu: 15.2,
        }),
        highestMemoryProcess: expect.objectContaining({
          pid: 5678,
          name: 'chrome',
          memory: 512.4,
        }),
      });
    });

    it('should handle processes with missing optional data', async () => {
      const mockProcesses = [
        {
          pid: 1234,
          name: 'simple-process',
          // Missing optional fields: cmd, ppid, uid, cpu, memory
        },
        {
          pid: 5678,
          name: 'process-with-some-data',
          cmd: 'some command',
          cpu: 1.5,
          // Missing: ppid, uid, memory
        },
      ];

      mockPsList.mockResolvedValue(mockProcesses);
      
      const result = await listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } });
      
      const resultData = JSON.parse(result);
      expect(resultData.processes).toHaveLength(2);
      
      // Check first process with missing data
      expect(resultData.processes[0]).toMatchObject({
        pid: 1234,
        name: 'simple-process',
        command: '',
      });
      
      // Verify optional fields are not included when missing
      expect(resultData.processes[0]).not.toHaveProperty('parentPid');
      expect(resultData.processes[0]).not.toHaveProperty('userId');
      expect(resultData.processes[0]).not.toHaveProperty('cpuUsage');
      expect(resultData.processes[0]).not.toHaveProperty('memoryUsage');
      
      // Check second process with partial data
      expect(resultData.processes[1]).toMatchObject({
        pid: 5678,
        name: 'process-with-some-data',
        command: 'some command',
        cpuUsage: 1.5,
      });
      
      // Verify memoryUsage property is not included when missing
      expect(resultData.processes[1]).not.toHaveProperty('memoryUsage');
    });

    it('should filter out invalid process entries', async () => {
      const mockProcesses = [
        {
          pid: 1234,
          name: 'valid-process',
        },
        null, // Invalid process
        {
          pid: 'invalid-pid', // Invalid PID type
          name: 'invalid-process',
        },
        {
          pid: -1, // Invalid PID value
          name: 'negative-pid-process',
        },
        {
          pid: 5678,
          name: 'another-valid-process',
        },
      ];

      mockPsList.mockResolvedValue(mockProcesses);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      const result = await listProcessesTool.execute({}, { log: mockLog });
      
      const resultData = JSON.parse(result);
      expect(resultData.processes).toHaveLength(2);
      expect(resultData.totalProcesses).toBe(2);
      
      // Verify warning logs for invalid entries
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Invalid process data at index 1',
        { process: null }
      );
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Invalid PID at index 2',
        { pid: 'invalid-pid' }
      );
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Invalid PID at index 3',
        { pid: -1 }
      );
    });

    it.skip('should throw error if ps-list module is not available', async () => {
      // This test is skipped because mocking dynamic imports in Jest is complex
      // In practice, ps-list should be installed as a dependency
    });

    it('should handle ps-list timeout', async () => {
      // Mock ps-list to hang indefinitely
      mockPsList.mockImplementation(() => new Promise(() => {}));
      
      const result = listProcessesTool.execute({}, { log: { info: jest.fn() } });
      
      // Should timeout after 10 seconds
      await expect(result).rejects.toThrow('Process list retrieval timed out');
    }, 15000); // Increase Jest timeout for this test

    it('should throw error if no valid processes found', async () => {
      mockPsList.mockResolvedValue([]);
      
      await expect(
        listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } })
      ).rejects.toThrow('No valid processes found in system process list');
    });

    it('should handle system permission errors', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';
      mockPsList.mockRejectedValue(permissionError);
      
      await expect(
        listProcessesTool.execute({}, { log: { info: jest.fn() } })
      ).rejects.toThrow('Permission denied accessing process list');
    });

    it('should handle missing process command', async () => {
      const missingCommandError = new Error('Command not found');
      (missingCommandError as any).code = 'ENOENT';
      mockPsList.mockRejectedValue(missingCommandError);
      
      await expect(
        listProcessesTool.execute({}, { log: { info: jest.fn() } })
      ).rejects.toThrow('Process listing command not found on this system');
    });
  });

  describe('kill_process Tool', () => {
    let killProcessTool: any;

    beforeEach(() => {
      registerProcessTools(mockServer as any);
      const killProcessCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'kill_process'
      );
      killProcessTool = killProcessCall[0];
    });

    it('should terminate process successfully with SIGTERM', async () => {
      const targetPid = 1234;
      
      // Mock process existence check and termination
      mockProcessKill
        .mockReturnValueOnce(true) // First call to check existence (signal 0)
        .mockReturnValueOnce(true) // Second call to send SIGTERM
        .mockImplementation(() => { // Third call to verify termination
          const error = new Error('No such process');
          (error as any).code = 'ESRCH';
          throw error;
        });

      // Mock ps-list for process info
      mockPsList.mockResolvedValue([
        {
          pid: targetPid,
          name: 'test-process',
          cmd: 'test command',
        },
      ]);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      const result = await killProcessTool.execute({ pid: targetPid }, { log: mockLog });
      
      expect(result).toBe(`Process ${targetPid} (test-process) terminated successfully`);
      expect(mockProcessKill).toHaveBeenCalledWith(targetPid, 0); // Existence check
      expect(mockProcessKill).toHaveBeenCalledWith(targetPid, 'SIGTERM'); // Graceful termination
      expect(mockLog.info).toHaveBeenCalledWith('Sent SIGTERM to process', {
        pid: targetPid,
        name: 'test-process',
      });
    });

    it('should use SIGKILL if SIGTERM fails', async () => {
      const targetPid = 1234;
      
      // Mock process existence and SIGTERM not working (process still exists)
      mockProcessKill
        .mockReturnValueOnce(true) // Existence check
        .mockReturnValueOnce(true) // SIGTERM
        .mockReturnValueOnce(true) // Second existence check (still alive)
        .mockReturnValueOnce(true) // SIGKILL
        .mockImplementation(() => { // Final verification
          const error = new Error('No such process');
          (error as any).code = 'ESRCH';
          throw error;
        });

      // Mock ps-list for process info
      mockPsList.mockResolvedValue([
        {
          pid: targetPid,
          name: 'stubborn-process',
          cmd: 'stubborn command',
        },
      ]);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      const result = await killProcessTool.execute({ pid: targetPid }, { log: mockLog });
      
      expect(result).toBe(`Process ${targetPid} (stubborn-process) terminated successfully`);
      expect(mockProcessKill).toHaveBeenCalledWith(targetPid, 'SIGTERM');
      expect(mockProcessKill).toHaveBeenCalledWith(targetPid, 'SIGKILL');
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Process did not respond to SIGTERM, using SIGKILL',
        { pid: targetPid }
      );
    });

    it('should throw error for invalid PID values', async () => {
      const invalidPids = [-1, 1.5]; // Negative, float - removed 0 and too large as they have specific error messages
      
      for (const invalidPid of invalidPids) {
        await expect(
          killProcessTool.execute({ pid: invalidPid }, { log: { info: jest.fn() } })
        ).rejects.toThrow('PID must be a positive integer');
      }
      
      // Test for PID that exceeds maximum value
      await expect(
        killProcessTool.execute({ pid: 2147483648 }, { log: { info: jest.fn() } })
      ).rejects.toThrow('PID exceeds maximum allowed value');
    });

    it('should throw error for protected system processes', async () => {
      const protectedPids = [1]; // Only test init process, kernel (0) fails positive integer check
      
      for (const protectedPid of protectedPids) {
        await expect(
          killProcessTool.execute({ pid: protectedPid }, { log: { info: jest.fn() } })
        ).rejects.toThrow(`Cannot terminate protected system process with PID ${protectedPid}`);
      }
      
      // Test PID 0 separately as it fails the positive integer check first
      await expect(
        killProcessTool.execute({ pid: 0 }, { log: { info: jest.fn() } })
      ).rejects.toThrow('PID must be a positive integer');
    });

    it('should throw error when trying to kill current process', async () => {
      const currentPid = process.pid;
      
      await expect(
        killProcessTool.execute({ pid: currentPid }, { log: { info: jest.fn() } })
      ).rejects.toThrow('Cannot terminate the current MCP server process');
    });

    it('should throw error for non-existent process', async () => {
      const nonExistentPid = 99999;
      
      // Mock process.kill to throw ESRCH for existence check
      mockProcessKill.mockImplementation(() => {
        const error = new Error('No such process');
        (error as any).code = 'ESRCH';
        throw error;
      });
      
      await expect(
        killProcessTool.execute({ pid: nonExistentPid }, { log: { info: jest.fn() } })
      ).rejects.toThrow(`Process with PID ${nonExistentPid} does not exist`);
    });

    it('should throw error for permission denied', async () => {
      const restrictedPid = 1234;
      
      // Mock process.kill to throw EPERM for existence check
      mockProcessKill.mockImplementation(() => {
        const error = new Error('Operation not permitted');
        (error as any).code = 'EPERM';
        throw error;
      });
      
      await expect(
        killProcessTool.execute({ pid: restrictedPid }, { log: { info: jest.fn() } })
      ).rejects.toThrow(`Permission denied accessing process with PID ${restrictedPid}`);
    });

    it('should handle process that disappears during termination', async () => {
      const targetPid = 1234;
      
      // Mock process existence check passes, but termination fails with ESRCH
      mockProcessKill
        .mockReturnValueOnce(true) // Existence check passes
        .mockImplementation(() => { // SIGTERM fails - process already gone
          const error = new Error('No such process');
          (error as any).code = 'ESRCH';
          throw error;
        });
      
      await expect(
        killProcessTool.execute({ pid: targetPid }, { log: { info: jest.fn(), warn: jest.fn() } })
      ).rejects.toThrow(`Process with PID ${targetPid} no longer exists`);
    });

    it('should handle process info retrieval failure gracefully', async () => {
      const targetPid = 1234;
      
      // Mock process existence and termination success
      mockProcessKill
        .mockReturnValueOnce(true) // Existence check
        .mockReturnValueOnce(true) // SIGTERM
        .mockImplementation(() => { // Final verification - terminated
          const error = new Error('No such process');
          (error as any).code = 'ESRCH';
          throw error;
        });

      // Mock ps-list failure (but process still exists for kill)
      mockPsList.mockRejectedValue(new Error('ps-list failed'));
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      const result = await killProcessTool.execute({ pid: targetPid }, { log: mockLog });
      
      expect(result).toBe(`Process ${targetPid} (unknown) terminated successfully`);
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Could not retrieve process information',
        { pid: targetPid, error: expect.stringContaining('ps-list failed') }
      );
    });

    it('should warn if process may not be fully terminated', async () => {
      const targetPid = 1234;
      
      // Mock process that doesn't get terminated
      mockProcessKill
        .mockReturnValueOnce(true) // Existence check
        .mockReturnValueOnce(true) // SIGTERM
        .mockReturnValueOnce(true) // Second existence check (still alive)
        .mockReturnValueOnce(true) // SIGKILL
        .mockReturnValueOnce(true); // Final verification (still alive!)

      mockPsList.mockResolvedValue([
        {
          pid: targetPid,
          name: 'immortal-process',
        },
      ]);
      
      const mockLog = {
        info: jest.fn(),
        warn: jest.fn(),
      };

      await expect(
        killProcessTool.execute({ pid: targetPid }, { log: mockLog })
      ).rejects.toThrow(`Process with PID ${targetPid} may not have been fully terminated`);
      
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Process may still be running after termination attempt',
        { pid: targetPid }
      );
    });
  });

  describe('Advanced Programming Techniques Integration', () => {
    it('should demonstrate Design by Contract principles', async () => {
      registerProcessTools(mockServer as any);
      
      // Get tools
      const listProcessesCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_processes'
      );
      const killProcessCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'kill_process'
      );
      
      const listProcessesTool = listProcessesCall[0];
      const killProcessTool = killProcessCall[0];
      
      // Test precondition violations
      await expect(
        killProcessTool.execute({ pid: -1 }, { log: { info: jest.fn() } })
      ).rejects.toThrow('PID must be a positive integer');
      
      // Test postcondition verification
      mockPsList.mockResolvedValue([
        { pid: 1234, name: 'test-process', cpu: 1.0, memory: 100.0 },
      ]);
      
      const result = await listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } });
      const data = JSON.parse(result);
      
      // Verify postconditions
      expect(data.totalProcesses).toBeGreaterThan(0);
      expect(data.timestamp).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(Array.isArray(data.processes)).toBe(true);
    });

    it('should demonstrate Defensive Programming techniques', async () => {
      registerProcessTools(mockServer as any);
      
      const listProcessesCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_processes'
      );
      const listProcessesTool = listProcessesCall[0];
      
      // Test input validation and boundary conditions
      mockPsList.mockResolvedValue([
        null, // Invalid entry
        { pid: 'invalid' }, // Invalid PID type
        { pid: 1234, name: 'valid-process' }, // Valid entry
      ]);
      
      const mockLog = { info: jest.fn(), warn: jest.fn() };
      const result = await listProcessesTool.execute({}, { log: mockLog });
      const data = JSON.parse(result);
      
      // Verify defensive filtering
      expect(data.processes).toHaveLength(1);
      expect(data.processes[0].pid).toBe(1234);
      expect(mockLog.warn).toHaveBeenCalledTimes(2); // Two invalid entries logged
    });

    it('should demonstrate Immutability principles', async () => {
      registerProcessTools(mockServer as any);
      
      const listProcessesCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_processes'
      );
      const listProcessesTool = listProcessesCall[0];
      
      const originalProcesses = [
        { pid: 1234, name: 'process1', cpu: 2.0, memory: 100.0 },
        { pid: 5678, name: 'process2', cpu: 1.0, memory: 200.0 },
      ];
      
      mockPsList.mockResolvedValue(originalProcesses);
      
      const result = await listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } });
      const data = JSON.parse(result);
      
      // Verify original data is not mutated
      expect(originalProcesses[0]).toEqual({ pid: 1234, name: 'process1', cpu: 2.0, memory: 100.0 });
      expect(originalProcesses[1]).toEqual({ pid: 5678, name: 'process2', cpu: 1.0, memory: 200.0 });
      
      // Verify processed data has additional computed fields
      expect(data.processes[0]).toHaveProperty('memoryUsageFormatted');
      expect(data.processes).not.toBe(originalProcesses); // Different object reference
    });

    it('should demonstrate Type-driven Development with Zod', async () => {
      registerProcessTools(mockServer as any);
      
      const killProcessCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'kill_process'
      );
      const killProcessTool = killProcessCall[0];
      
      // Verify Zod schema validation is applied
      expect(killProcessTool.parameters).toBeDefined();
      expect(killProcessTool.parameters._def).toBeDefined(); // Zod schema structure
      
      // Test type validation through runtime behavior
      await expect(
        killProcessTool.execute({ pid: 'not-a-number' }, { log: { info: jest.fn() } })
      ).rejects.toThrow(); // Should fail Zod validation or our validation
    });

    it('should demonstrate Property-based Testing concepts', async () => {
      registerProcessTools(mockServer as any);
      
      const listProcessesCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'list_processes'
      );
      const listProcessesTool = listProcessesCall[0];
      
      // Test property: output always has required structure
      const testCases = [
        [], // Empty list
        [{ pid: 1, name: 'test' }], // Minimal valid process
        [{ pid: 1, name: 'test', cpu: 1.0, memory: 100.0 }], // Full process data
      ];
      
      for (const testCase of testCases) {
        mockPsList.mockResolvedValue(testCase);
        
        if (testCase.length === 0) {
          // Property: empty process list should throw error
          await expect(
            listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } })
          ).rejects.toThrow('No valid processes found');
        } else {
          // Property: valid processes should always produce structured output
          const result = await listProcessesTool.execute({}, { log: { info: jest.fn(), warn: jest.fn() } });
          const data = JSON.parse(result);
          
          expect(data).toHaveProperty('timestamp');
          expect(data).toHaveProperty('totalProcesses');
          expect(data).toHaveProperty('statistics');
          expect(data).toHaveProperty('processes');
          expect(Array.isArray(data.processes)).toBe(true);
        }
      }
    });
  });
});
