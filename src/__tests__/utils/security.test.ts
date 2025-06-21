// src/__tests__/utils/security.test.ts

import { jest } from '@jest/globals';

// Mock the fs/promises module BEFORE imports
const mockFs = {
  stat: jest.fn(),
  realpath: jest.fn(),
};
jest.mock('fs/promises', () => mockFs);

// Mock os module
const mockOs = {
  homedir: jest.fn(() => '/home/testuser'),
};
jest.mock('os', () => mockOs);

// Mock process.argv to control allowedDirectories
const originalArgv = process.argv;
const mockExit = jest.fn();
const mockConsoleError = jest.fn();

beforeAll(() => {
  // Mock process.exit to prevent test termination
  process.exit = mockExit as any;
  console.error = mockConsoleError;
});

afterAll(() => {
  // Restore original process.argv and console.error
  process.argv = originalArgv;
  console.error = console.error;
});

describe('Security Module', () => {
  let validatePath: any;
  let validatePaths: any;
  let getSecurityContext: any;
  let allowedDirectories: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockFs.stat.mockClear();
    mockFs.realpath.mockClear();
    mockOs.homedir.mockClear();
    mockExit.mockClear();
    mockConsoleError.mockClear();

    // Mock process.argv for this test
    process.argv = ['node', 'script.js', '/safe/directory'];
    
    // Clear module cache to re-import with new process.argv
    jest.resetModules();
  });

  describe('validatePath', () => {
    beforeEach(async () => {
      // Mock that the allowed directory exists and is a directory
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      
      // Re-import module to get fresh instance with current process.argv
      const securityModule = await import('../../utils/security');
      validatePath = securityModule.validatePath;
      validatePaths = securityModule.validatePaths;
      getSecurityContext = securityModule.getSecurityContext;
      allowedDirectories = securityModule.allowedDirectories;
    });

    // Test successful path validation
    it('should allow a valid path within the allowed directory', async () => {
      const safePath = '/safe/directory/file.txt';
      mockFs.realpath.mockResolvedValue(safePath);
      
      const result = await validatePath(safePath);
      expect(result).toBe(safePath);
      expect(mockFs.realpath).toHaveBeenCalledWith(safePath);
    });

    it('should allow a subdirectory within the allowed directory', async () => {
      const safePath = '/safe/directory/subdir/file.txt';
      mockFs.realpath.mockResolvedValue(safePath);
      
      const result = await validatePath(safePath);
      expect(result).toBe(safePath);
    });

    // Test security boundary violations
    it('should deny a path outside the allowed directory', async () => {
      const unsafePath = '/unsafe/directory/file.txt';
      
      await expect(validatePath(unsafePath)).rejects.toThrow(
        'Access denied - path outside allowed directories: /unsafe/directory/file.txt not in [/safe/directory]'
      );
    });

    it('should deny a path that uses traversal (../) to escape', async () => {
      const traversalPath = '/safe/directory/../unsafe/file.txt';
      
      await expect(validatePath(traversalPath)).rejects.toThrow(
        'Access denied - path outside allowed directories'
      );
    });

    // Test input validation (defensive programming)
    it('should deny a path containing null bytes', async () => {
      const nullBytePath = '/safe/directory/file\0.txt';
      
      await expect(validatePath(nullBytePath)).rejects.toThrow(
        'Path cannot contain null characters.'
      );
    });

    it('should deny empty path', async () => {
      await expect(validatePath('')).rejects.toThrow(
        'Path must be a non-empty string.'
      );
    });

    it('should deny whitespace-only path', async () => {
      await expect(validatePath('   ')).rejects.toThrow(
        'Path must be a non-empty string.'
      );
    });

    it('should deny non-string path', async () => {
      await expect(validatePath(123 as any)).rejects.toThrow(
        'Path must be a non-empty string.'
      );
    });

    it('should deny path exceeding maximum length', async () => {
      const longPath = '/safe/directory/' + 'a'.repeat(5000);
      
      await expect(validatePath(longPath)).rejects.toThrow(
        'Path exceeds maximum allowed length (4096 characters).'
      );
    });

    // Test symlink security (critical security test)
    it('should deny a symlink pointing outside allowed directories', async () => {
      const symlinkInSafeDir = '/safe/directory/symlink-to-danger';
      const targetInUnsafeDir = '/unsafe/directory/secret.txt';

      // First call to realpath (for the symlink) resolves to unsafe target
      mockFs.realpath.mockResolvedValue(targetInUnsafeDir);

      await expect(validatePath(symlinkInSafeDir)).rejects.toThrow(
        'Access denied - symlink target outside allowed directories'
      );
    });

    it('should allow a symlink pointing within allowed directories', async () => {
      const symlinkInSafeDir = '/safe/directory/symlink-to-safe';
      const targetInSafeDir = '/safe/directory/other/file.txt';

      mockFs.realpath.mockResolvedValue(targetInSafeDir);

      const result = await validatePath(symlinkInSafeDir);
      expect(result).toBe(targetInSafeDir);
    });

    // Test new file creation (ENOENT handling)
    it('should allow creating a new file in an allowed directory', async () => {
      const newFilePath = '/safe/directory/new-file.txt';
      const parentDir = '/safe/directory';

      // realpath on the new file fails (doesn't exist)
      mockFs.realpath.mockImplementation((p) => {
        if (p === newFilePath) {
          const error: any = new Error('ENOENT: no such file or directory');
          error.code = 'ENOENT';
          return Promise.reject(error);
        }
        // realpath on parent directory succeeds
        if (p === parentDir) {
          return Promise.resolve(parentDir);
        }
        return Promise.reject(new Error('Unexpected path in test'));
      });

      const result = await validatePath(newFilePath);
      expect(result).toBe(newFilePath);
    });

    it('should deny creating a new file when parent directory is outside allowed directories', async () => {
      const newFilePath = '/unsafe/directory/new-file.txt';
      const parentDir = '/unsafe/directory';

      // realpath on the new file fails (doesn't exist)
      mockFs.realpath.mockImplementation((p) => {
        if (p === newFilePath) {
          const error: any = new Error('ENOENT: no such file or directory');
          error.code = 'ENOENT';
          return Promise.reject(error);
        }
        // realpath on parent directory succeeds but it's outside allowed dirs
        if (p === parentDir) {
          return Promise.resolve(parentDir);
        }
        return Promise.reject(new Error('Unexpected path in test'));
      });

      await expect(validatePath(newFilePath)).rejects.toThrow(
        'Access denied - path outside allowed directories'
      );
    });

    it('should deny creating a new file when parent directory does not exist', async () => {
      const newFilePath = '/safe/directory/nonexistent/new-file.txt';
      const parentDir = '/safe/directory/nonexistent';

      // Both the file and parent directory don't exist
      mockFs.realpath.mockImplementation((p) => {
        const error: any = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      await expect(validatePath(newFilePath)).rejects.toThrow(
        'Parent directory does not exist: /safe/directory/nonexistent'
      );
    });

    // Test home directory expansion
    it('should expand home directory (~) correctly', async () => {
      process.argv = ['node', 'script.js', '~/safe'];
      
      // Re-import to get updated allowedDirectories with home expansion
      jest.resetModules();
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      
      const securityModule = await import('../../utils/security');
      const validatePathWithHome = securityModule.validatePath;
      
      const homeFilePath = '~/safe/file.txt';
      const expandedPath = '/home/testuser/safe/file.txt';
      
      mockFs.realpath.mockResolvedValue(expandedPath);
      
      const result = await validatePathWithHome(homeFilePath);
      expect(result).toBe(expandedPath);
    });

    // Test relative path resolution
    it('should resolve relative paths correctly', async () => {
      // Mock process.cwd() for relative path resolution
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => '/safe/directory');
      
      const relativePath = './file.txt';
      const resolvedPath = '/safe/directory/file.txt';
      
      mockFs.realpath.mockResolvedValue(resolvedPath);
      
      const result = await validatePath(relativePath);
      expect(result).toBe(resolvedPath);
      
      // Restore original cwd
      process.cwd = originalCwd;
    });

    // Test error handling
    it('should handle filesystem errors gracefully', async () => {
      const testPath = '/safe/directory/error-file.txt';
      
      mockFs.realpath.mockRejectedValue(new Error('Permission denied'));
      
      await expect(validatePath(testPath)).rejects.toThrow(
        'Path validation failed: Permission denied'
      );
    });
  });

  describe('validatePaths (batch validation)', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      
      const securityModule = await import('../../utils/security');
      validatePaths = securityModule.validatePaths;
    });

    it('should validate multiple valid paths', async () => {
      const paths = [
        '/safe/directory/file1.txt',
        '/safe/directory/file2.txt',
        '/safe/directory/subdir/file3.txt'
      ];
      
      mockFs.realpath.mockImplementation((path) => Promise.resolve(path));
      
      const results = await validatePaths(paths);
      expect(results).toEqual(paths);
      expect(results).toHaveLength(paths.length);
    });

    it('should reject if any path is invalid', async () => {
      const paths = [
        '/safe/directory/file1.txt',
        '/unsafe/directory/file2.txt', // This one is outside allowed dirs
        '/safe/directory/file3.txt'
      ];
      
      await expect(validatePaths(paths)).rejects.toThrow(
        'Batch path validation failed'
      );
    });

    it('should reject non-array input', async () => {
      await expect(validatePaths('not an array' as any)).rejects.toThrow(
        'Paths must be provided as an array'
      );
    });

    it('should reject empty array', async () => {
      await expect(validatePaths([])).rejects.toThrow(
        'At least one path must be provided'
      );
    });

    it('should reject too many paths', async () => {
      const tooManyPaths = Array(101).fill('/safe/directory/file.txt');
      
      await expect(validatePaths(tooManyPaths)).rejects.toThrow(
        'Too many paths provided (maximum 100 allowed)'
      );
    });

    it('should reject array with non-string elements', async () => {
      const pathsWithNonString = ['/safe/directory/file1.txt', 123, '/safe/directory/file3.txt'];
      
      await expect(validatePaths(pathsWithNonString as any)).rejects.toThrow(
        'Batch path validation failed: Path at index 1 must be a string'
      );
    });
  });

  describe('getSecurityContext', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      
      const securityModule = await import('../../utils/security');
      getSecurityContext = securityModule.getSecurityContext;
    });

    it('should return immutable security context', () => {
      const context = getSecurityContext();
      
      expect(context).toHaveProperty('allowedDirectories');
      expect(context).toHaveProperty('totalAllowedDirectories');
      expect(context).toHaveProperty('securityEnabled');
      
      expect(context.allowedDirectories).toBeInstanceOf(Array);
      expect(context.totalAllowedDirectories).toBe(context.allowedDirectories.length);
      expect(context.securityEnabled).toBe(true);
      
      // Test immutability
      expect(() => {
        (context as any).allowedDirectories = [];
      }).toThrow();
      
      expect(() => {
        (context.allowedDirectories as any).push('/new/dir');
      }).toThrow();
    });

    it('should show correct directory count', () => {
      const context = getSecurityContext();
      expect(context.totalAllowedDirectories).toBeGreaterThan(0);
      expect(context.totalAllowedDirectories).toBe(context.allowedDirectories.length);
    });
  });

  describe('Module initialization', () => {
    it('should handle missing command line arguments', async () => {
      // Set empty argv to trigger error handling
      process.argv = ['node', 'script.js']; // No directory arguments
      
      jest.resetModules();
      
      // The module should call process.exit(1) during import
      await import('../../utils/security');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Usage: mcp-server-filesystem <allowed-directory> [additional-directories...]'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should validate allowed directories on startup', async () => {
      process.argv = ['node', 'script.js', '/valid/directory'];
      
      // Mock directory exists and is valid
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      
      jest.resetModules();
      
      // Should not throw or exit
      const securityModule = await import('../../utils/security');
      expect(securityModule.allowedDirectories).toContain('/valid/directory');
    });

    it('should exit if allowed directory does not exist', async () => {
      process.argv = ['node', 'script.js', '/nonexistent/directory'];
      
      // Mock directory does not exist
      const notFoundError: any = new Error('ENOENT: no such file or directory');
      notFoundError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(notFoundError);
      
      jest.resetModules();
      
      // Import will trigger the validation
      await import('../../utils/security');
      
      // Should have logged error and exited
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing allowed directory "/nonexistent/directory"')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit if allowed path is not a directory', async () => {
      process.argv = ['node', 'script.js', '/some/file.txt'];
      
      // Mock path exists but is not a directory
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      
      jest.resetModules();
      
      await import('../../utils/security');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error: The specified allowed path "/some/file.txt" is not a directory.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Path normalization and expansion utilities', () => {
    beforeEach(async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      jest.resetModules();
    });

    it('should handle multiple allowed directories', async () => {
      process.argv = ['node', 'script.js', '/dir1', '/dir2', '~/dir3'];
      
      const securityModule = await import('../../utils/security');
      const allowedDirs = securityModule.allowedDirectories;
      
      expect(allowedDirs).toHaveLength(3);
      expect(allowedDirs).toContain('/dir1');
      expect(allowedDirs).toContain('/dir2');
      expect(allowedDirs).toContain('/home/testuser/dir3'); // Expanded home
    });

    it('should normalize paths in allowed directories', async () => {
      process.argv = ['node', 'script.js', '/dir1//subdir/../final'];
      
      const securityModule = await import('../../utils/security');
      const allowedDirs = securityModule.allowedDirectories;
      
      // Should be normalized to remove double slashes and resolve ../
      expect(allowedDirs[0]).toBe('/dir1/final');
    });
  });
});
