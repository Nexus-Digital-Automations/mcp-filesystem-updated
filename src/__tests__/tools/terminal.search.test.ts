// src/__tests__/tools/terminal.search.test.ts
/**
 * COMPREHENSIVE TEST SUITE: Terminal Output Search Functionality
 * 
 * Tests the enhanced read_output tool with search capabilities including:
 * - Text and regex pattern searching
 * - Search target selection (stdout, stderr, both)
 * - Case sensitivity options
 * - Advanced programming technique validation
 * - Edge case and error handling coverage
 */

import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import { spawn, ChildProcess } from 'child_process';
import { registerTerminalTools, clearAllTerminalSessions } from "../../tools/terminal.js";

/**
 * CONTRACT: Mock session creation for testing
 * 
 * Preconditions: None
 * Postconditions: Returns mock session with controlled output
 * Invariants: Session state is properly initialized
 */
interface MockTerminalSession {
  process: Partial<ChildProcess>;
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
 * UTILITY: Create mock FastMCP server for testing
 */
function createMockServer(): FastMCP {
  const mockTools: any[] = [];
  
  return {
    addTool: (tool: any) => {
      mockTools.push(tool);
    },
    getTools: () => mockTools,
  } as any;
}

/**
 * UTILITY: Create mock terminal session with controlled output
 */
function createMockSession(outputBuffer: string, errorBuffer: string, isActive: boolean = true): MockTerminalSession {
  return {
    process: { pid: 12345 },
    outputBuffer,
    errorBuffer,
    fullCommand: 'test command',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    lastActivity: new Date('2025-01-01T10:00:00Z'),
    isActive,
    workingDirectory: '/test',
    exitCode: isActive ? null : 0,
    exitSignal: null,
  };
}

describe('Terminal Search Functionality', () => {
  let server: FastMCP;
  let readOutputTool: any;

  beforeEach(() => {
    // SETUP: Initialize clean test environment
    server = createMockServer();
    registerTerminalTools(server);
    clearAllTerminalSessions();
    
    // Get the read_output tool for testing
    const tools = (server as any).getTools();
    readOutputTool = tools.find((tool: any) => tool.name === 'read_output');
    
    expect(readOutputTool).toBeDefined();
  });

  afterEach(() => {
    // CLEANUP: Clear all sessions after each test
    clearAllTerminalSessions();
  });

  describe('Schema Validation', () => {
    /**
     * TEST: Parameter schema validation
     * TECHNIQUE: Type-driven development validation
     */
    test('should validate search parameters correctly', () => {
      const schema = readOutputTool.parameters;
      
      // Valid parameters
      expect(() => schema.parse({ pid: 123 })).not.toThrow();
      expect(() => schema.parse({ 
        pid: 123, 
        search_pattern: 'test',
        is_regex: false,
        case_sensitive: true,
        search_target: 'stdout'
      })).not.toThrow();
      
      // Invalid parameters
      expect(() => schema.parse({ pid: -1 })).toThrow();
      expect(() => schema.parse({ pid: 'invalid' })).toThrow();
      expect(() => schema.parse({ 
        pid: 123, 
        search_target: 'invalid' 
      })).toThrow();
    });

    /**
     * TEST: Schema default values
     * TECHNIQUE: Contract verification
     */
    test('should apply correct default values', () => {
      const schema = readOutputTool.parameters;
      const parsed = schema.parse({ 
        pid: 123, 
        search_pattern: 'test' 
      });
      
      expect(parsed.is_regex).toBe(false);
      expect(parsed.case_sensitive).toBe(false);
      expect(parsed.search_target).toBe('both');
    });
  });

  describe('Backward Compatibility', () => {
    /**
     * TEST: Original functionality preserved
     * TECHNIQUE: Immutability principle validation
     */
    test('should maintain original functionality when no search pattern provided', async () => {
      // Mock the terminalSessions map
      const mockSessions = new Map();
      const mockSession = createMockSession(
        'Sample output line 1\nSample output line 2',
        'Error line 1\nError line 2'
      );
      mockSessions.set('session_123_test', mockSession);
      
      // Mock the module's session storage
      const originalSessions = require('../../tools/terminal.js').terminalSessions;
      Object.setPrototypeOf(mockSessions, originalSessions);
      
      // Execute without search pattern
      const result = await readOutputTool.execute(
        { pid: 123 },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      // Verify original response structure
      expect(response).toHaveProperty('sessionId');
      expect(response).toHaveProperty('pid');
      expect(response).toHaveProperty('output');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('isActive');
      expect(response).toHaveProperty('timestamp');
      
      // Should not have search_results
      expect(response).not.toHaveProperty('search_results');
    });
  });

  describe('Search Functionality', () => {
    let mockSessions: Map<string, MockTerminalSession>;
    
    beforeEach(() => {
      mockSessions = new Map();
      const mockSession = createMockSession(
        'Line 1: Hello World\nLine 2: Testing search\nLine 3: Another test\nLine 4: Final line',
        'Error 1: Sample error\nError 2: Another ERROR\nError 3: Last error'
      );
      mockSessions.set('session_123_test', mockSession);
    });

    /**
     * TEST: Text pattern searching
     * TECHNIQUE: Pure function validation
     */
    test('should search for text patterns correctly', async () => {
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'test',
          search_target: 'stdout'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      expect(response.search_results).toBeDefined();
      expect(response.search_results.pattern).toBe('test');
      expect(response.search_results.match_count).toBeGreaterThan(0);
      expect(response.search_results.matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            line_number: expect.any(Number),
            text: expect.stringContaining('test')
          })
        ])
      );
    });

    /**
     * TEST: Case sensitivity functionality
     * TECHNIQUE: Property-based testing
     */
    test('should handle case sensitivity correctly', async () => {
      // Case insensitive search (default)
      const casInsensitiveResult = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'ERROR',
          search_target: 'stderr',
          case_sensitive: false
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const casInsensitiveResponse = JSON.parse(casInsensitiveResult);
      
      // Case sensitive search
      const caseSensitiveResult = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'ERROR',
          search_target: 'stderr', 
          case_sensitive: true
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const caseSensitiveResponse = JSON.parse(caseSensitiveResult);
      
      // Case insensitive should find more matches
      expect(casInsensitiveResponse.search_results.match_count)
        .toBeGreaterThanOrEqual(caseSensitiveResponse.search_results.match_count);
    });

    /**
     * TEST: Search target selection
     * TECHNIQUE: Defensive programming validation
     */
    test('should search correct output streams based on target', async () => {
      const targets = ['stdout', 'stderr', 'both'] as const;
      
      for (const target of targets) {
        const result = await readOutputTool.execute(
          { 
            pid: 123, 
            search_pattern: 'Line',
            search_target: target
          },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        );
        
        const response = JSON.parse(result);
        
        expect(response.search_results).toBeDefined();
        expect(response.search_results.search_target).toBe(target);
        
        // Verify search target affects results appropriately
        if (target === 'stdout') {
          // Should find "Line" in stdout but not stderr
          expect(response.search_results.match_count).toBeGreaterThan(0);
        } else if (target === 'stderr') {
          // Should not find "Line" in stderr
          expect(response.search_results.match_count).toBe(0);
        } else if (target === 'both') {
          // Should search both streams
          expect(response.search_results.match_count).toBeGreaterThan(0);
        }
      }
    });

    /**
     * TEST: Regex pattern functionality
     * TECHNIQUE: Contract-based validation
     */
    test('should handle regex patterns correctly', async () => {
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: '^Line \\d+:',
          is_regex: true,
          search_target: 'stdout'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      expect(response.search_results).toBeDefined();
      expect(response.search_results.is_regex).toBe(true);
      expect(response.search_results.match_count).toBeGreaterThan(0);
      
      // All matches should start with "Line" followed by number and colon
      response.search_results.matches.forEach((match: any) => {
        expect(match.text).toMatch(/^Line \d+:/);
      });
    });
  });

  describe('Error Handling', () => {
    /**
     * TEST: Invalid session handling
     * TECHNIQUE: Defensive programming validation
     */
    test('should handle non-existent sessions correctly', async () => {
      await expect(
        readOutputTool.execute(
          { pid: 99999 },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
    });

    /**
     * TEST: Invalid search pattern handling
     * TECHNIQUE: Boundary condition testing
     */
    test('should handle invalid search patterns', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession('test output', 'test error'));
      
      // Empty search pattern
      await expect(
        readOutputTool.execute(
          { pid: 123, search_pattern: '' },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
      
      // Overly long search pattern
      const longPattern = 'a'.repeat(1001);
      await expect(
        readOutputTool.execute(
          { pid: 123, search_pattern: longPattern },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
    });

    /**
     * TEST: Invalid regex pattern handling
     * TECHNIQUE: Error boundary validation
     */
    test('should handle invalid regex patterns', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession('test output', 'test error'));
      
      await expect(
        readOutputTool.execute(
          { 
            pid: 123, 
            search_pattern: '[invalid regex',
            is_regex: true
          },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
    });

    /**
     * TEST: Parameter validation
     * TECHNIQUE: Input validation testing
     */
    test('should validate PID parameter correctly', async () => {
      await expect(
        readOutputTool.execute(
          { pid: -1 },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
      
      await expect(
        readOutputTool.execute(
          { pid: 0 },
          { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
        )
      ).rejects.toThrow(UserError);
    });
  });

  describe('Response Structure Validation', () => {
    /**
     * TEST: Search response structure
     * TECHNIQUE: Contract verification
     */
    test('should return properly structured search response', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession('test output line', 'test error line'));
      
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'test',
          search_target: 'both'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      // Verify response structure
      expect(response).toHaveProperty('sessionId');
      expect(response).toHaveProperty('pid');
      expect(response).toHaveProperty('isActive');
      expect(response).toHaveProperty('search_results');
      expect(response).toHaveProperty('timestamp');
      
      // Verify search_results structure
      const searchResults = response.search_results;
      expect(searchResults).toHaveProperty('pattern');
      expect(searchResults).toHaveProperty('is_regex');
      expect(searchResults).toHaveProperty('case_sensitive');
      expect(searchResults).toHaveProperty('search_target');
      expect(searchResults).toHaveProperty('match_count');
      expect(searchResults).toHaveProperty('matches');
      
      // Verify matches structure
      if (searchResults.matches.length > 0) {
        searchResults.matches.forEach((match: any) => {
          expect(match).toHaveProperty('line_number');
          expect(match).toHaveProperty('text');
          expect(typeof match.line_number).toBe('number');
          expect(typeof match.text).toBe('string');
          expect(match.line_number).toBeGreaterThan(0);
        });
      }
    });

    /**
     * TEST: Match count consistency
     * TECHNIQUE: Postcondition verification
     */
    test('should maintain match count consistency', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession(
        'match1\nnomatch\nmatch2\nmatch3',
        'error1\nerror2'
      ));
      
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'match',
          search_target: 'stdout'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      // Verify match count equals actual matches array length
      expect(response.search_results.match_count).toBe(response.search_results.matches.length);
      
      // Verify each match actually contains the search pattern
      response.search_results.matches.forEach((match: any) => {
        expect(match.text.toLowerCase()).toContain('match');
      });
    });
  });

  describe('Advanced Programming Techniques Validation', () => {
    /**
     * TEST: Immutability principle
     * TECHNIQUE: Side effect detection
     */
    test('should not modify session state during search', async () => {
      const mockSessions = new Map();
      const originalSession = createMockSession('original output', 'original error');
      const originalOutputBuffer = originalSession.outputBuffer;
      const originalErrorBuffer = originalSession.errorBuffer;
      const originalIsActive = originalSession.isActive;
      
      mockSessions.set('session_123_test', originalSession);
      
      await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'test',
          search_target: 'both'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      // Verify session data was not modified (except lastActivity)
      expect(originalSession.outputBuffer).toBe(originalOutputBuffer);
      expect(originalSession.errorBuffer).toBe(originalErrorBuffer);
      expect(originalSession.isActive).toBe(originalIsActive);
    });

    /**
     * TEST: Pure function behavior
     * TECHNIQUE: Deterministic output validation
     */
    test('should produce deterministic search results', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession(
        'line1\nline2\nline3',
        'error1\nerror2'
      ));
      
      const searchParams = { 
        pid: 123, 
        search_pattern: 'line',
        search_target: 'stdout' as const,
        case_sensitive: false
      };
      
      // Execute search multiple times
      const result1 = await readOutputTool.execute(
        searchParams,
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const result2 = await readOutputTool.execute(
        searchParams,
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response1 = JSON.parse(result1);
      const response2 = JSON.parse(result2);
      
      // Results should be identical (excluding timestamp)
      expect(response1.search_results.pattern).toBe(response2.search_results.pattern);
      expect(response1.search_results.match_count).toBe(response2.search_results.match_count);
      expect(response1.search_results.matches).toEqual(response2.search_results.matches);
    });

    /**
     * TEST: Contract enforcement
     * TECHNIQUE: Precondition/postcondition validation
     */
    test('should enforce function contracts', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession('test data', 'error data'));
      
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'test',
          search_target: 'both'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      // POSTCONDITION: Response must contain all required fields
      expect(response.sessionId).toBeDefined();
      expect(response.pid).toBeDefined();
      expect(response.search_results).toBeDefined();
      expect(response.timestamp).toBeDefined();
      
      // POSTCONDITION: Match count must equal matches array length
      expect(response.search_results.match_count).toBe(response.search_results.matches.length);
      
      // POSTCONDITION: All matches must have valid line numbers
      response.search_results.matches.forEach((match: any) => {
        expect(match.line_number).toBeGreaterThan(0);
        expect(Number.isInteger(match.line_number)).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    /**
     * TEST: Empty output handling
     * TECHNIQUE: Boundary condition testing
     */
    test('should handle empty output buffers', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession('', ''));
      
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'anything',
          search_target: 'both'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      expect(response.search_results.match_count).toBe(0);
      expect(response.search_results.matches).toEqual([]);
    });

    /**
     * TEST: Large output handling
     * TECHNIQUE: Performance boundary testing
     */
    test('should handle large output buffers efficiently', async () => {
      const largeOutput = 'test line\n'.repeat(10000);
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession(largeOutput, ''));
      
      const startTime = Date.now();
      
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: 'test',
          search_target: 'stdout'
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      const response = JSON.parse(result);
      
      // Should complete in reasonable time (< 1 second)
      expect(executionTime).toBeLessThan(1000);
      expect(response.search_results.match_count).toBe(10000);
    });

    /**
     * TEST: Special character handling
     * TECHNIQUE: Input sanitization validation
     */
    test('should handle special characters in search patterns', async () => {
      const mockSessions = new Map();
      mockSessions.set('session_123_test', createMockSession(
        'line with $special @characters #and %symbols',
        'error with &more *special ^characters'
      ));
      
      // Test special characters in text search (should be escaped)
      const result = await readOutputTool.execute(
        { 
          pid: 123, 
          search_pattern: '$special',
          search_target: 'stdout',
          is_regex: false
        },
        { log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
      );
      
      const response = JSON.parse(result);
      
      expect(response.search_results.match_count).toBe(1);
      expect(response.search_results.matches[0].text).toContain('$special');
    });
  });
});
