// src/tools/process.ts
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";

/**
 * CONTRACT: Process management tools registration function
 * 
 * Preconditions:
 * - server must be valid FastMCP instance
 * - System must support process listing and termination
 * 
 * Postconditions:
 * - Process management tools registered successfully
 * - Tools ready for client requests with advanced programming techniques
 * 
 * Invariants:
 * - Tool registration is idempotent
 * - Security validation applied consistently
 * - Cross-platform compatibility maintained
 */
export function registerProcessTools(server: FastMCP) {
  
  // TOOL: list_processes - System process listing with resource usage monitoring
  server.addTool({
    name: "list_processes",
    description: `List all running processes. Returns process information including PID, command name, CPU usage, and memory usage.`,
    parameters: z.object({}),
    execute: async (args, { log }) => {
      try {
        // DEFENSIVE PROGRAMMING: Dynamic import with error handling
        let psList;
        try {
          const psListModule = await import('ps-list');
          psList = psListModule.default;
        } catch (importError: any) {
          throw new UserError('ps-list module is not available. Install it with: npm install ps-list');
        }

        // TYPE-DRIVEN DEVELOPMENT: Type validation for process list
        if (typeof psList !== 'function') {
          throw new UserError('ps-list module is not properly configured');
        }

        log.info('Retrieving system process list');
        
        // DEFENSIVE PROGRAMMING: Get process list with timeout
        const processListPromise = psList();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Process list retrieval timed out')), 10000);
        });
        
        const processes = await Promise.race([processListPromise, timeoutPromise]) as Array<{
          pid: number;
          name: string;
          cmd?: string;
          ppid?: number;
          uid?: number;
          cpu?: number;
          memory?: number;
        }>;

        // DEFENSIVE PROGRAMMING: Validate process list structure
        if (!Array.isArray(processes)) {
          throw new UserError('Invalid process list format returned by system');
        }

        // IMMUTABILITY: Transform process data with pure functions
        const formattedProcesses = processes.map((proc, index) => {
          // DEFENSIVE PROGRAMMING: Validate individual process data
          if (!proc || typeof proc !== 'object') {
            log.warn(`Invalid process data at index ${index}`, { process: proc });
            return null;
          }

          if (typeof proc.pid !== 'number' || proc.pid <= 0) {
            log.warn(`Invalid PID at index ${index}`, { pid: proc.pid });
            return null;
          }

          // Build process object with only defined properties
          const processData: any = {
            pid: proc.pid,
            name: typeof proc.name === 'string' ? proc.name : 'unknown',
            command: typeof proc.cmd === 'string' ? proc.cmd : '',
          };

          // Only add optional properties if they have valid values
          if (typeof proc.ppid === 'number') {
            processData.parentPid = proc.ppid;
          }
          
          if (typeof proc.uid === 'number') {
            processData.userId = proc.uid;
          }
          
          if (typeof proc.cpu === 'number') {
            processData.cpuUsage = Number(proc.cpu.toFixed(2));
          }
          
          if (typeof proc.memory === 'number') {
            processData.memoryUsage = Number(proc.memory.toFixed(2));
            processData.memoryUsageFormatted = formatMemory(proc.memory);
          }

          return processData;
        }).filter(proc => proc !== null); // Remove invalid entries

        // CONTRACT: Postcondition verification
        const validProcessCount = formattedProcesses.length;
        if (validProcessCount === 0) {
          throw new UserError('No valid processes found in system process list');
        }

        // IMMUTABILITY: Sort processes by PID for consistent output
        const sortedProcesses = [...formattedProcesses].sort((a, b) => a!.pid - b!.pid);

        // Generate summary statistics
        const stats = calculateProcessStats(sortedProcesses);

        const result = {
          timestamp: new Date().toISOString(),
          totalProcesses: validProcessCount,
          statistics: stats,
          processes: sortedProcesses
        };

        log.info('Process list retrieved successfully', {
          totalProcesses: validProcessCount,
          validProcesses: validProcessCount,
          stats
        });

        return JSON.stringify(result, null, 2);

      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        
        // DEFENSIVE PROGRAMMING: Handle specific system errors
        if (error.code === 'EACCES') {
          throw new UserError('Permission denied accessing process list. Administrator privileges may be required.');
        }
        
        if (error.code === 'ENOENT') {
          throw new UserError('Process listing command not found on this system.');
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to retrieve process list: ${errorMessage}`);
      }
    },
  });

  // TOOL: kill_process - Safe process termination with comprehensive validation
  server.addTool({
    name: "kill_process",
    description: `Terminate a running process by PID. Use with caution as this will forcefully terminate the specified process.`,
    parameters: z.object({
      pid: z.number().int().positive().describe('The Process ID (PID) of the process to terminate')
    }),
    execute: async (args, { log }) => {
      const { pid } = args;

      // DEFENSIVE PROGRAMMING: PID validation
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new UserError('PID must be a positive integer');
      }

      if (pid > 2147483647) { // Max 32-bit signed integer
        throw new UserError('PID exceeds maximum allowed value');
      }

      // SECURITY BOUNDARY: Protect critical system processes
      const protectedPids = [1]; // init process (PID 0 already filtered out by positive integer check)
      if (protectedPids.includes(pid)) {
        throw new UserError(`Cannot terminate protected system process with PID ${pid}`);
      }

      // DEFENSIVE PROGRAMMING: Check if current process
      if (pid === process.pid) {
        throw new UserError('Cannot terminate the current MCP server process');
      }

      try {
        log.info('Attempting to terminate process', { pid });

        // CONTRACT: Verify process exists before termination
        let processExists = false;
        let processInfo: any = null;

        try {
          // Check if process exists using kill signal 0 (no-op signal)
          process.kill(pid, 0);
          processExists = true;

          // Try to get process information for logging
          try {
            const psListModule = await import('ps-list');
            const psList = psListModule.default;
            const processes = await psList();
            processInfo = processes.find(p => p.pid === pid);
          } catch (psError) {
            // Process info retrieval failed, but process exists
            log.warn('Could not retrieve process information', { pid, error: String(psError) });
          }

        } catch (checkError: any) {
          if (checkError.code === 'ESRCH') {
            throw new UserError(`Process with PID ${pid} does not exist`);
          }
          if (checkError.code === 'EPERM') {
            throw new UserError(`Permission denied accessing process with PID ${pid}`);
          }
          throw checkError;
        }

        // CONTRACT: Precondition verification
        if (!processExists) {
          throw new UserError(`Process with PID ${pid} does not exist`);
        }

        // Store process info for verification
        const processName = processInfo?.name || 'unknown';
        const processCommand = processInfo?.cmd || '';

        // DEFENSIVE PROGRAMMING: Attempt graceful termination first (SIGTERM)
        try {
          process.kill(pid, 'SIGTERM');
          log.info('Sent SIGTERM to process', { pid, name: processName });

          // Wait a moment to see if process terminates gracefully
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check if process still exists
          try {
            process.kill(pid, 0);
            // Process still exists, use SIGKILL as fallback
            log.warn('Process did not respond to SIGTERM, using SIGKILL', { pid });
            process.kill(pid, 'SIGKILL');
          } catch (recheckError: any) {
            if (recheckError.code === 'ESRCH') {
              // Process terminated gracefully
              log.info('Process terminated gracefully with SIGTERM', { pid });
            } else {
              throw recheckError;
            }
          }

        } catch (killError: any) {
          if (killError.code === 'ESRCH') {
            throw new UserError(`Process with PID ${pid} no longer exists`);
          }
          if (killError.code === 'EPERM') {
            throw new UserError(`Permission denied terminating process with PID ${pid}. Administrator privileges may be required.`);
          }
          throw killError;
        }

        // CONTRACT: Postcondition verification
        try {
          // Wait a moment for termination to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify process is terminated
          process.kill(pid, 0);
          
          // If we reach here, process still exists
          log.warn('Process may still be running after termination attempt', { pid });
          throw new UserError(`Process with PID ${pid} may not have been fully terminated. Check process status.`);
          
        } catch (verifyError: any) {
          if (verifyError.code === 'ESRCH') {
            // Process successfully terminated
            log.info('Process terminated successfully', {
              pid,
              name: processName,
              command: processCommand
            });
            
            return `Process ${pid} (${processName}) terminated successfully`;
          }
          
          // Re-throw verification errors
          throw verifyError;
        }

      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }

        // DEFENSIVE PROGRAMMING: Handle platform-specific errors
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          throw new UserError(`Permission denied terminating process with PID ${pid}. Administrator privileges may be required.`);
        }

        if (error.code === 'ESRCH') {
          throw new UserError(`Process with PID ${pid} does not exist or has already been terminated`);
        }

        if (error.code === 'EINVAL') {
          throw new UserError(`Invalid signal or PID specified: ${pid}`);
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to terminate process: ${errorMessage}`);
      }
    },
  });
}

/**
 * UTILITY: Memory formatting function with type safety
 * 
 * CONTRACT: Pure function for memory size formatting
 * Preconditions: bytes must be a non-negative number
 * Postconditions: returns human-readable memory string
 * Invariants: formatting is consistent and deterministic
 */
function formatMemory(bytes: number): string {
  // DEFENSIVE PROGRAMMING: Input validation
  if (typeof bytes !== 'number' || bytes < 0 || !Number.isFinite(bytes)) {
    return 'unknown';
  }

  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  if (i >= sizes.length) {
    return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(2)} ${sizes[sizes.length - 1]}`;
  }
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * UTILITY: Process statistics calculation with immutability
 * 
 * CONTRACT: Pure function for process statistics
 * Preconditions: processes must be valid array of process objects
 * Postconditions: returns comprehensive statistics object
 * Invariants: calculations are deterministic and accurate
 */
function calculateProcessStats(processes: Array<any>): {
  totalProcesses: number;
  processesWithCpuData: number;
  processesWithMemoryData: number;
  averageCpuUsage: number;
  totalMemoryUsage: number;
  highestCpuProcess: { pid: number; name: string; cpu: number } | null;
  highestMemoryProcess: { pid: number; name: string; memory: number } | null;
} {
  // DEFENSIVE PROGRAMMING: Input validation
  if (!Array.isArray(processes)) {
    throw new UserError('Processes must be an array for statistics calculation');
  }

  const validProcesses = processes.filter(p => p && typeof p === 'object' && typeof p.pid === 'number');
  
  if (validProcesses.length === 0) {
    return {
      totalProcesses: 0,
      processesWithCpuData: 0,
      processesWithMemoryData: 0,
      averageCpuUsage: 0,
      totalMemoryUsage: 0,
      highestCpuProcess: null,
      highestMemoryProcess: null,
    };
  }

  // IMMUTABILITY: Use functional programming for calculations
  const processesWithCpu = validProcesses.filter(p => typeof p.cpuUsage === 'number' && p.cpuUsage >= 0);
  const processesWithMemory = validProcesses.filter(p => typeof p.memoryUsage === 'number' && p.memoryUsage >= 0);

  const totalCpu = processesWithCpu.reduce((sum, p) => sum + p.cpuUsage, 0);
  const averageCpu = processesWithCpu.length > 0 ? totalCpu / processesWithCpu.length : 0;

  const totalMemory = processesWithMemory.reduce((sum, p) => sum + p.memoryUsage, 0);

  // Find highest resource usage processes
  const highestCpuProcess = processesWithCpu.length > 0 
    ? processesWithCpu.reduce((max, p) => p.cpuUsage > max.cpuUsage ? p : max)
    : null;

  const highestMemoryProcess = processesWithMemory.length > 0
    ? processesWithMemory.reduce((max, p) => p.memoryUsage > max.memoryUsage ? p : max)
    : null;

  return {
    totalProcesses: validProcesses.length,
    processesWithCpuData: processesWithCpu.length,
    processesWithMemoryData: processesWithMemory.length,
    averageCpuUsage: Number(averageCpu.toFixed(2)),
    totalMemoryUsage: Number(totalMemory.toFixed(2)),
    highestCpuProcess: highestCpuProcess ? {
      pid: highestCpuProcess.pid,
      name: highestCpuProcess.name,
      cpu: highestCpuProcess.cpuUsage
    } : null,
    highestMemoryProcess: highestMemoryProcess ? {
      pid: highestMemoryProcess.pid,
      name: highestMemoryProcess.name,
      memory: highestMemoryProcess.memoryUsage
    } : null,
  };
}
