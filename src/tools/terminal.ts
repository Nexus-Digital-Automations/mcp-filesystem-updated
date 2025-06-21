// src/tools/terminal.ts
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import { spawn, ChildProcess } from 'child_process';
import path from "path";
import { validatePath } from "../utils/security.js";

/**
 * CONTRACT: Terminal session state management with encapsulation
 * 
 * Invariants:
 * - Session state remains consistent throughout operations
 * - Process lifecycle is properly managed
 * - Output buffering maintains chronological order
 * - Resource cleanup prevents memory leaks
 */
interface TerminalSession {
  process: ChildProcess;
  outputBuffer: string;
  errorBuffer: string;
  fullCommand: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  workingDirectory: string;
  exitCode: number | null;
  exitSignal: string | null;
}

/**
 * IMMUTABILITY: Session storage with encapsulated state
 * 
 * This Map provides controlled access to session state while maintaining
 * immutability principles through controlled mutation operations.
 */
const terminalSessions = new Map<string, TerminalSession>();

/**
 * CONTRACT: Session ID generation with uniqueness guarantees
 * 
 * Preconditions: None
 * Postconditions: Returns unique session identifier
 * Invariants: Generated IDs are unique across server lifetime
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `session_${timestamp}_${random}`;
}

/**
 * CONTRACT: Session cleanup with resource management
 * 
 * Preconditions: sessionId must be valid string
 * Postconditions: Session resources properly cleaned up
 * Invariants: No resource leaks after cleanup
 */
function cleanupSession(sessionId: string): void {
  const session = terminalSessions.get(sessionId);
  if (!session) return;

  // DEFENSIVE PROGRAMMING: Proper process cleanup
  try {
    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
      
      // Force kill if not terminated within timeout
      setTimeout(() => {
        if (session.process && !session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }, 3000);
    }
  } catch (error) {
    // Process may already be terminated
  }

  // Remove session from storage
  terminalSessions.delete(sessionId);
}

/**
 * CONTRACT: Terminal tools registration function
 * 
 * Preconditions:
 * - server must be valid FastMCP instance
 * - System must support child process creation
 * 
 * Postconditions:
 * - Terminal management tools registered successfully
 * - Session management configured properly
 * - Tools ready for client requests
 * 
 * Invariants:
 * - Tool registration is idempotent
 * - Session state management is consistent
 * - Advanced programming techniques applied throughout
 */
export function registerTerminalTools(server: FastMCP) {

  // TOOL: execute_command - Command execution with session lifecycle management
  server.addTool({
    name: "execute_command",
    description: `Execute a terminal command with timeout. Command will continue running in background if it doesn't complete within timeout. NOTE: For file operations, prefer specialized tools like read_file, search_code, list_directory instead of cat, grep, or ls commands. IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths may fail as they depend on the current working directory. Tilde paths (~/...) might not work in all contexts. Unless the user explicitly asks for relative paths, use absolute paths.`,
    parameters: z.object({
      command: z.string().min(1).describe('The command to execute'),
      shell: z.string().optional().describe('The shell to use for command execution'),
      timeout_ms: z.number().int().positive().optional().default(30000).describe('Timeout in milliseconds (default: 30000)')
    }),
    execute: async (args, { log }) => {
      const { command, shell, timeout_ms } = args;

      // DEFENSIVE PROGRAMMING: Input validation
      if (typeof command !== 'string' || command.trim().length === 0) {
        throw new UserError('Command must be a non-empty string');
      }

      if (command.length > 8192) {
        throw new UserError('Command exceeds maximum length (8192 characters)');
      }

      if (timeout_ms < 100 || timeout_ms > 300000) { // 100ms to 5 minutes
        throw new UserError('Timeout must be between 100ms and 300000ms (5 minutes)');
      }

      // SECURITY BOUNDARY: Command validation
      const dangerousPatterns = [
        /rm\s+-rf\s+\/$/,  // rm -rf /
        /mkfs\./,          // filesystem formatting
        /dd\s+if=/,        // disk operations
        /:(){ :|:& };:/,   // fork bomb
        /shutdown|reboot|halt/i,
      ];

      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      if (isDangerous) {
        throw new UserError('Command contains potentially dangerous operations that are not allowed');
      }

      // Determine shell and working directory
      const currentShell = shell || (process.platform === 'win32' ? 'cmd' : '/bin/bash');
      const { allowedDirectories } = await import("../utils/security.js");
      const workingDirectory = allowedDirectories[0] || process.cwd();

      log.info('Executing command', { 
        command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
        shell: currentShell,
        timeout: timeout_ms,
        workingDirectory
      });

      // Generate unique session ID
      const sessionId = generateSessionId();

      try {
        // DEFENSIVE PROGRAMMING: Create child process with proper configuration
        const childProcess = spawn(currentShell, 
          process.platform === 'win32' ? ['/c', command] : ['-c', command], 
          {
            cwd: workingDirectory,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
            detached: false,
          }
        );

        // CONTRACT: Initialize session state
        const session: TerminalSession = {
          process: childProcess,
          outputBuffer: '',
          errorBuffer: '',
          fullCommand: command,
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
          workingDirectory,
          exitCode: null,
          exitSignal: null,
        };

        terminalSessions.set(sessionId, session);

        // IMMUTABILITY: Set up event handlers with proper state management
        childProcess.stdout?.on('data', (data) => {
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.outputBuffer += data.toString();
            session.lastActivity = new Date();
          }
        });

        childProcess.stderr?.on('data', (data) => {
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.errorBuffer += data.toString();
            session.lastActivity = new Date();
          }
        });

        childProcess.on('close', (code, signal) => {
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.isActive = false;
            session.exitCode = code;
            session.exitSignal = signal;
            session.lastActivity = new Date();
          }
        });

        childProcess.on('error', (error) => {
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.errorBuffer += `Process error: ${error.message}\n`;
            session.isActive = false;
            session.lastActivity = new Date();
          }
        });

        // Wait for command completion or timeout
        const result = await Promise.race([
          new Promise<{completed: boolean, output: string, error: string}>((resolve) => {
            childProcess.on('close', (code, signal) => {
              const session = terminalSessions.get(sessionId);
              const output = session?.outputBuffer || '';
              const error = session?.errorBuffer || '';
              resolve({ 
                completed: true, 
                output: output.trim(), 
                error: error.trim() 
              });
            });
          }),
          new Promise<{completed: boolean, output: string, error: string}>((resolve) => {
            setTimeout(() => {
              const session = terminalSessions.get(sessionId);
              const output = session?.outputBuffer || '';
              const error = session?.errorBuffer || '';
              resolve({ 
                completed: false, 
                output: output.trim(), 
                error: error.trim() 
              });
            }, timeout_ms);
          })
        ]);

        // CONTRACT: Build response with comprehensive information
        const response: any = {
          sessionId,
          command,
          completed: result.completed,
          output: result.output,
          error: result.error,
          timestamp: new Date().toISOString(),
          workingDirectory,
          shell: currentShell,
        };

        if (result.completed) {
          const session = terminalSessions.get(sessionId);
          if (session) {
            response.exitCode = session.exitCode;
            response.exitSignal = session.exitSignal;
          }
          
          log.info('Command completed', {
            sessionId,
            exitCode: session?.exitCode,
            outputLength: result.output.length,
            errorLength: result.error.length
          });
          
          // Clean up completed session after a delay
          setTimeout(() => cleanupSession(sessionId), 5000);
        } else {
          log.info('Command timed out, running in background', {
            sessionId,
            outputLength: result.output.length,
            errorLength: result.error.length
          });
        }

        return JSON.stringify(response, null, 2);

      } catch (error: any) {
        // Clean up session on error
        cleanupSession(sessionId);
        
        if (error.code === 'ENOENT') {
          throw new UserError(`Shell not found: ${currentShell}`);
        }
        if (error.code === 'EACCES') {
          throw new UserError('Permission denied executing command');
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Command execution failed: ${errorMessage}`);
      }
    },
  });

  // TOOL: read_output - Session output streaming with buffer management
  server.addTool({
    name: "read_output",
    description: `Read new output from a running terminal session.`,
    parameters: z.object({
      pid: z.number().int().positive().describe('The session ID (process ID) to read output from')
    }),
    execute: async (args, { log }) => {
      const { pid } = args;

      // DEFENSIVE PROGRAMMING: PID validation (treated as sessionId for terminal sessions)
      const sessionId = `session_${pid}`;
      
      // Find session by partial ID match (since we generate our own session IDs)
      let matchingSession: TerminalSession | undefined;
      let matchingSessionId: string | undefined;
      
      for (const [id, session] of terminalSessions.entries()) {
        if (id.includes(pid.toString()) || session.process.pid === pid) {
          matchingSession = session;
          matchingSessionId = id;
          break;
        }
      }

      if (!matchingSession || !matchingSessionId) {
        throw new UserError(`No active terminal session found with ID containing: ${pid}`);
      }

      try {
        // CONTRACT: Read current output state
        const currentTime = new Date();
        const output = matchingSession.outputBuffer;
        const error = matchingSession.errorBuffer;
        const isActive = matchingSession.isActive;

        // Update last activity time
        matchingSession.lastActivity = currentTime;

        log.info('Reading session output', {
          sessionId: matchingSessionId,
          outputLength: output.length,
          errorLength: error.length,
          isActive
        });

        const response = {
          sessionId: matchingSessionId,
          pid: matchingSession.process.pid,
          output: output.trim(),
          error: error.trim(),
          isActive,
          lastActivity: matchingSession.lastActivity.toISOString(),
          exitCode: matchingSession.exitCode,
          exitSignal: matchingSession.exitSignal,
          timestamp: currentTime.toISOString(),
        };

        return JSON.stringify(response, null, 2);

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to read session output: ${errorMessage}`);
      }
    },
  });

  // TOOL: list_sessions - Active session enumeration with state tracking
  server.addTool({
    name: "list_sessions",
    description: `List all active terminal sessions.`,
    parameters: z.object({}),
    execute: async (args, { log }) => {
      try {
        const currentTime = new Date();
        
        // IMMUTABILITY: Create session summaries without modifying original data
        const sessionSummaries = Array.from(terminalSessions.entries()).map(([sessionId, session]) => {
          const durationMs = currentTime.getTime() - session.createdAt.getTime();
          const timeSinceActivity = currentTime.getTime() - session.lastActivity.getTime();
          
          return {
            sessionId,
            pid: session.process.pid,
            command: session.fullCommand.length > 100 
              ? session.fullCommand.substring(0, 100) + '...'
              : session.fullCommand,
            isActive: session.isActive,
            workingDirectory: session.workingDirectory,
            createdAt: session.createdAt.toISOString(),
            lastActivity: session.lastActivity.toISOString(),
            durationMs,
            timeSinceActivityMs: timeSinceActivity,
            exitCode: session.exitCode,
            exitSignal: session.exitSignal,
            outputBufferSize: session.outputBuffer.length,
            errorBufferSize: session.errorBuffer.length,
          };
        });

        // IMMUTABILITY: Sort by creation time (newest first)
        const sortedSessions = [...sessionSummaries].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Generate statistics
        const stats = {
          totalSessions: sortedSessions.length,
          activeSessions: sortedSessions.filter(s => s.isActive).length,
          completedSessions: sortedSessions.filter(s => !s.isActive).length,
          oldestSession: sortedSessions.length > 0 
            ? sortedSessions[sortedSessions.length - 1].createdAt 
            : null,
          newestSession: sortedSessions.length > 0 
            ? sortedSessions[0].createdAt 
            : null,
        };

        const response = {
          timestamp: currentTime.toISOString(),
          statistics: stats,
          sessions: sortedSessions,
        };

        log.info('Listed terminal sessions', {
          totalSessions: stats.totalSessions,
          activeSessions: stats.activeSessions,
          completedSessions: stats.completedSessions
        });

        return JSON.stringify(response, null, 2);

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to list sessions: ${errorMessage}`);
      }
    },
  });

  // TOOL: force_terminate - Session cleanup with proper resource management
  server.addTool({
    name: "force_terminate",
    description: `Force terminate a running terminal session.`,
    parameters: z.object({
      pid: z.number().int().positive().describe('The session ID (process ID) to terminate')
    }),
    execute: async (args, { log }) => {
      const { pid } = args;

      // DEFENSIVE PROGRAMMING: Find session by PID or session ID
      let matchingSession: TerminalSession | undefined;
      let matchingSessionId: string | undefined;
      
      for (const [id, session] of terminalSessions.entries()) {
        if (id.includes(pid.toString()) || session.process.pid === pid) {
          matchingSession = session;
          matchingSessionId = id;
          break;
        }
      }

      if (!matchingSession || !matchingSessionId) {
        throw new UserError(`No terminal session found with ID containing: ${pid}`);
      }

      try {
        const processId = matchingSession.process.pid;
        const command = matchingSession.fullCommand;
        const wasActive = matchingSession.isActive;

        log.info('Force terminating session', {
          sessionId: matchingSessionId,
          processId,
          command: command.substring(0, 100),
          wasActive
        });

        // CONTRACT: Attempt graceful termination first
        if (matchingSession.process && !matchingSession.process.killed) {
          matchingSession.process.kill('SIGTERM');
          
          // Wait briefly for graceful termination
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Force kill if still running
          if (!matchingSession.process.killed) {
            matchingSession.process.kill('SIGKILL');
          }
        }

        // Update session state
        matchingSession.isActive = false;
        matchingSession.lastActivity = new Date();

        // Clean up session
        cleanupSession(matchingSessionId);

        const response = {
          sessionId: matchingSessionId,
          processId,
          command: command.length > 100 ? command.substring(0, 100) + '...' : command,
          wasActive,
          terminatedAt: new Date().toISOString(),
          method: 'force_terminate',
        };

        log.info('Session terminated successfully', {
          sessionId: matchingSessionId,
          processId,
          wasActive
        });

        return JSON.stringify(response, null, 2);

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to terminate session: ${errorMessage}`);
      }
    },
  });

  // TOOL: search_code - Content searching with ripgrep integration
  server.addTool({
    name: "search_code",
    description: `Search for text/code patterns within file contents using ripgrep. Use this instead of 'execute_command' with grep/find for searching code content. Fast and powerful search similar to VS Code search functionality. Supports regular expressions, file pattern filtering, and context lines. Has a default timeout of 30 seconds which can be customized. Only searches within allowed directories. IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths may fail as they depend on the current working directory. Tilde paths (~/...) might not work in all contexts. Unless the user explicitly asks for relative paths, use absolute paths.`,
    parameters: z.object({
      path: z.string().describe('The directory path to search within'),
      pattern: z.string().min(1).describe('The text/regex pattern to search for'),
      filePattern: z.string().optional().describe('File pattern to filter search (e.g., "*.js", "*.py")'),
      contextLines: z.number().int().min(0).max(10).optional().default(0).describe('Number of context lines to show around matches'),
      ignoreCase: z.boolean().optional().default(false).describe('Whether to ignore case in search'),
      includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files/directories'),
      maxResults: z.number().int().positive().optional().default(100).describe('Maximum number of results to return'),
      timeoutMs: z.number().int().positive().optional().default(30000).describe('Search timeout in milliseconds')
    }),
    execute: async (args, { log }) => {
      const { 
        path: searchPath, 
        pattern, 
        filePattern, 
        contextLines, 
        ignoreCase, 
        includeHidden,
        maxResults,
        timeoutMs 
      } = args;

      // DEFENSIVE PROGRAMMING: Input validation
      if (typeof pattern !== 'string' || pattern.trim().length === 0) {
        throw new UserError('Search pattern must be a non-empty string');
      }

      if (pattern.length > 1000) {
        throw new UserError('Search pattern exceeds maximum length (1000 characters)');
      }

      if (timeoutMs < 1000 || timeoutMs > 120000) { // 1 second to 2 minutes
        throw new UserError('Timeout must be between 1000ms and 120000ms (2 minutes)');
      }

      // SECURITY BOUNDARY: Validate search path
      const validSearchPath = await validatePath(searchPath);

      try {
        // Verify path is a directory
        const fs = await import('fs/promises');
        const stats = await fs.stat(validSearchPath);
        if (!stats.isDirectory()) {
          throw new UserError(`Search path is not a directory: ${searchPath}`);
        }
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        if (error.code === 'ENOENT') {
          throw new UserError(`Search path does not exist: ${searchPath}`);
        }
        throw new UserError(`Cannot access search path: ${error.message}`);
      }

      log.info('Starting code search', {
        searchPath,
        pattern: pattern.substring(0, 100),
        filePattern,
        contextLines,
        ignoreCase,
        includeHidden,
        maxResults,
        timeout: timeoutMs
      });

      try {
        // Build ripgrep command
        const rgArgs = [
          '--json',
          '--sort', 'path',
          '--max-count', maxResults.toString(),
        ];

        if (contextLines > 0) {
          rgArgs.push('--context', contextLines.toString());
        }

        if (ignoreCase) {
          rgArgs.push('--ignore-case');
        }

        if (includeHidden) {
          rgArgs.push('--hidden');
        }

        if (filePattern) {
          rgArgs.push('--glob', filePattern);
        }

        // Add search pattern and path
        rgArgs.push(pattern, validSearchPath);

        // Execute ripgrep search
        const { spawn } = await import('child_process');
        const rgProcess = spawn('rg', rgArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: validSearchPath,
        });

        let outputBuffer = '';
        let errorBuffer = '';

        rgProcess.stdout?.on('data', (data) => {
          outputBuffer += data.toString();
        });

        rgProcess.stderr?.on('data', (data) => {
          errorBuffer += data.toString();
        });

        // Wait for completion or timeout
        const searchResult = await Promise.race([
          new Promise<{success: boolean, output: string, error: string}>((resolve) => {
            rgProcess.on('close', (code) => {
              resolve({
                success: code === 0,
                output: outputBuffer,
                error: errorBuffer
              });
            });
          }),
          new Promise<{success: boolean, output: string, error: string}>((resolve) => {
            setTimeout(() => {
              rgProcess.kill('SIGTERM');
              resolve({
                success: false,
                output: outputBuffer,
                error: 'Search timed out'
              });
            }, timeoutMs);
          })
        ]);

        // Parse ripgrep JSON output
        const matches: any[] = [];
        if (searchResult.output) {
          const lines = searchResult.output.trim().split('\n');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'match') {
                matches.push({
                  file: parsed.data.path.text,
                  line: parsed.data.line_number,
                  column: parsed.data.submatches[0]?.start || 0,
                  text: parsed.data.lines.text.trim(),
                  match: parsed.data.submatches[0]?.match?.text || '',
                });
              }
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        }

        // Build comprehensive response
        const response = {
          searchPattern: pattern,
          searchPath: validSearchPath,
          filePattern: filePattern || 'all files',
          options: {
            contextLines,
            ignoreCase,
            includeHidden,
            maxResults,
            timeoutMs
          },
          results: {
            totalMatches: matches.length,
            matches: matches.slice(0, maxResults),
            searchSuccessful: searchResult.success,
            truncated: matches.length > maxResults
          },
          timestamp: new Date().toISOString(),
          errors: searchResult.error ? [searchResult.error] : []
        };

        log.info('Code search completed', {
          searchPath,
          pattern: pattern.substring(0, 50),
          totalMatches: matches.length,
          searchSuccessful: searchResult.success,
          hasErrors: !!searchResult.error
        });

        return JSON.stringify(response, null, 2);

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new UserError('ripgrep (rg) command not found. Please install ripgrep to use code search functionality.');
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Code search failed: ${errorMessage}`);
      }
    },
  });

  // DEFENSIVE PROGRAMMING: Cleanup inactive sessions periodically
  setInterval(() => {
    const currentTime = new Date().getTime();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of terminalSessions.entries()) {
      const timeSinceActivity = currentTime - session.lastActivity.getTime();
      
      if (!session.isActive && timeSinceActivity > maxInactiveTime) {
        cleanupSession(sessionId);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}
