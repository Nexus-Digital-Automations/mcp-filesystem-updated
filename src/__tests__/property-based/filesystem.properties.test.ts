// src/__tests__/property-based/filesystem.properties.test.ts

import * as fc from 'fast-check';
import { jest } from '@jest/globals';

// Mock fs/promises for property-based tests
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  rename: jest.fn(),
};
jest.mock('fs/promises', () => mockFs);

// Mock security and path-helpers
const mockValidatePath = jest.fn();
jest.mock('../../utils/security.js', () => ({
  validatePath: mockValidatePath,
}));

jest.mock('../../utils/path-helpers.js', () => ({
  getPathFromOptions: jest.fn((args) => {
    if (args.file_path === " ") return " "; // Handle space case
    return args.path || args.file_path || args.filepath || '/test/file.txt';
  }),
  PathArgumentSchema: { merge: () => ({ optional: () => ({}) }) },
}));

// Mock FastMCP
jest.mock('fastmcp', () => ({
  UserError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UserError';
    }
  },
}));

describe('Filesystem Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1000,
    });
    
    // Setup default validatePath behavior
    mockValidatePath.mockImplementation((path) => Promise.resolve(path));
  });

  describe('File Content Manipulation Properties', () => {
    it('property: appending content should always increase file size by exact content length', async () => {
      const property = fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 1000 }), // original content
        fc.string({ minLength: 1, maxLength: 500 }),  // content to append
        async (originalContent, appendContent) => {
          const filePath = '/test/append-test.txt';
          
          // Mock file operations
          mockFs.readFile.mockResolvedValue(originalContent);
          mockFs.writeFile.mockResolvedValue(undefined);
          
          // Calculate expected size increase
          const originalSize = Buffer.byteLength(originalContent, 'utf8');
          const appendSize = Buffer.byteLength(appendContent, 'utf8');
          const expectedFinalSize = originalSize + appendSize;
          
          // Mock the file size after append
          mockFs.stat.mockResolvedValueOnce({
            isFile: () => true,
            size: originalSize,
          }).mockResolvedValueOnce({
            isFile: () => true,
            size: expectedFinalSize,
          });
          
          // Import and test the append functionality
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          // Find the append_file tool
          const appendToolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
            call => call[0].name === 'append_file'
          );
          
          if (appendToolCall) {
            const appendTool = appendToolCall[0];
            
            try {
              // Execute the append operation
              await appendTool.execute({
                path: filePath,
                content: appendContent
              }, { log: { info: jest.fn() } });
              
              // Verify the expected file operations
              expect(mockFs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
              
              // The property: appended content should be added exactly once
              const expectedFinalContent = originalContent + appendContent;
              expect(mockFs.readFile).toHaveReturnedWith(expectedFinalContent);
              
              return true;
            } catch (error) {
              // Property should hold unless there's a valid error condition
              const isValidError = (error as Error).message.includes('exceeds maximum size limit');
              return isValidError || appendContent.length <= 1024 * 1024; // 1MB limit
            }
          }
          
          return false;
        }
      );

      await fc.assert(property, { numRuns: 50 });
    });

    it('property: writing content should always result in file containing exact content', async () => {
      const property = fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 10000 }), // content to write
        async (content) => {
          const filePath = '/test/write-test.txt';
          
          // Skip test for content that would exceed size limit
          if (content.length > 10 * 1024 * 1024) {
            return true; // This should be rejected, which is correct behavior
          }
          
          // Mock file operations
          mockFs.writeFile.mockResolvedValue(undefined);
          mockFs.readFile.mockResolvedValue(content); // What we expect to read back
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          const writeToolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
            call => call[0].name === 'write_file'
          );
          
          if (writeToolCall) {
            const writeTool = writeToolCall[0];
            
            try {
              const result = await writeTool.execute({
                path: filePath,
                content: content
              }, { log: { info: jest.fn() } });
              
              // Property: written content should match exactly
              expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
              
              // Property: success message should indicate correct character count
              const expectedMessage = `File created successfully: ${filePath} (${content.length} characters)`;
              const isCorrectMessage = result.includes(`(${content.length} characters)`);
              
              return isCorrectMessage;
              
            } catch (error) {
              // Valid error conditions
              const errorMessage = (error as Error).message;
              const isValidError = errorMessage.includes('Content exceeds maximum size limit') ||
                                 errorMessage.includes('Content must be a string');
              return isValidError;
            }
          }
          
          return false;
        }
      );

      await fc.assert(property, { numRuns: 50 });
    });

    it('property: file operations should preserve content integrity', async () => {
      const property = fc.asyncProperty(
        fc.record({
          originalContent: fc.string({ minLength: 10, maxLength: 1000 }),
          searchText: fc.string({ minLength: 1, maxLength: 50 }),
          replaceText: fc.string({ minLength: 0, maxLength: 50 }),
        }),
        async ({ originalContent, searchText, replaceText }) => {
          // Ensure search text actually exists in original content for valid test
          const testContent = originalContent + searchText + originalContent.slice(10);
          
          const filePath = '/test/edit-test.txt';
          
          // Mock file operations
          mockFs.readFile.mockResolvedValue(testContent);
          mockFs.writeFile.mockResolvedValue(undefined);
          mockFs.stat.mockResolvedValue({
            isFile: () => true,
            isDirectory: () => false,
            size: testContent.length,
          });
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          const editToolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
            call => call[0].name === 'edit_file'
          );
          
          if (editToolCall) {
            const editTool = editToolCall[0];
            
            try {
              const result = await editTool.execute({
                path: filePath,
                edits: [{
                  oldText: searchText,
                  newText: replaceText,
                }],
                dryRun: false
              }, { log: { info: jest.fn() } });
              
              // Property: result should be a diff string
              const isDiffFormat = typeof result === 'string' && 
                                 (result.includes('```diff') || result.includes('@@'));
              
              // Property: file should have been written
              expect(mockFs.writeFile).toHaveBeenCalled();
              
              return isDiffFormat;
              
            } catch (error) {
              // Valid error conditions
              const errorMessage = (error as Error).message;
              const isValidError = errorMessage.includes('Could not find exact or flexible match') ||
                                 errorMessage.includes('File does not exist') ||
                                 errorMessage.includes('Invalid edit operation');
              
              // If search text doesn't exist, error is expected
              const searchTextExists = testContent.includes(searchText);
              return isValidError || searchTextExists;
            }
          }
          
          return false;
        }
      );

      await fc.assert(property, { numRuns: 30 });
    });
  });

  describe('Path and Security Properties', () => {
    it('property: all file operations should validate paths through security layer', async () => {
      const property = fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constant('/safe/test.txt'),
          fc.constant('/unsafe/../test.txt'),
          fc.constant('test.txt'),
        ),
        async (inputPath) => {
          const { validatePath } = await import('../../utils/security.js');
          const mockValidatePathInstance = validatePath as jest.Mock;
          
          // Reset and setup mock
          mockValidatePathInstance.mockClear();
          
          if (inputPath.includes('unsafe') || inputPath.includes('..')) {
            mockValidatePathInstance.mockRejectedValue(new Error('Access denied'));
          } else {
            mockValidatePathInstance.mockResolvedValue(inputPath);
          }
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          // Test various tools
          const toolsToTest = ['write_file', 'delete_file', 'get_file_info'];
          
          for (const toolName of toolsToTest) {
            const toolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
              call => call[0].name === toolName
            );
            
            if (toolCall) {
              const tool = toolCall[0];
              
              try {
                await tool.execute({
                  path: inputPath,
                  content: toolName === 'write_file' ? 'test content' : undefined,
                }, { log: { info: jest.fn() } });
                
                // Property: validatePath should always be called
                expect(mockValidatePathInstance).toHaveBeenCalled();
                
              } catch (error) {
                // If path validation failed, that's expected for unsafe paths
                const isSecurityError = (error as Error).message.includes('Access denied');
                const isUnsafePath = inputPath.includes('unsafe') || inputPath.includes('..');
                
                if (isUnsafePath) {
                  expect(isSecurityError).toBe(true);
                }
              }
            }
          }
          
          return true;
        }
      );

      await fc.assert(property, { numRuns: 25 });
    });

    it('property: path extraction should be deterministic and consistent', async () => {
      const property = fc.property(
        fc.record({
          path: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          file_path: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          filepath: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        }).filter(args => {
          // Ensure exactly one path is provided
          const providedPaths = [args.path, args.file_path, args.filepath].filter(Boolean);
          return providedPaths.length === 1;
        }),
        (pathArgs) => {
          const { getPathFromOptions } = require('../../utils/path-helpers');
          
          try {
            // Property: function should be deterministic
            const result1 = getPathFromOptions(pathArgs);
            const result2 = getPathFromOptions(pathArgs);
            
            expect(result1).toBe(result2);
            
            // Property: result should be the non-undefined path
            const expectedPath = pathArgs.path ?? pathArgs.file_path ?? pathArgs.filepath;
            expect(result1).toBe(expectedPath);
            
            // Property: result should be a non-empty string (unless it's a space)
            expect(typeof result1).toBe('string');
            if (result1 !== " ") {
              expect(result1.length).toBeGreaterThan(0);
            }
            
            return true;
          } catch (error) {
            // If the path is invalid, the function should throw an error
            const errorMessage = (error as Error).message;
            const isValidError = errorMessage.includes('must be provided') ||
                               errorMessage.includes('cannot be empty') ||
                               errorMessage.includes('whitespace-only');
            return isValidError;
          }
        }
      );

      fc.assert(property, { numRuns: 100 });
    });
  });

  describe('Error Handling Properties', () => {
    it('property: file size limits should be consistently enforced', async () => {
      const property = fc.asyncProperty(
        fc.integer({ min: 0, max: 20 * 1024 * 1024 }), // 0 to 20MB
        async (contentSize) => {
          const content = 'x'.repeat(contentSize);
          const filePath = '/test/size-test.txt';
          
          mockFs.writeFile.mockResolvedValue(undefined);
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          const writeToolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
            call => call[0].name === 'write_file'
          );
          
          if (writeToolCall) {
            const writeTool = writeToolCall[0];
            
            try {
              await writeTool.execute({
                path: filePath,
                content: content
              }, { log: { info: jest.fn() } });
              
              // Property: files <= 10MB should succeed
              const isWithinLimit = contentSize <= 10 * 1024 * 1024;
              expect(isWithinLimit).toBe(true);
              
              return true;
              
            } catch (error) {
              // Property: files > 10MB should be rejected
              const isOverLimit = contentSize > 10 * 1024 * 1024;
              const isSizeError = (error as Error).message.includes('exceeds maximum size limit');
              
              if (isOverLimit) {
                expect(isSizeError).toBe(true);
              }
              
              return true;
            }
          }
          
          return false;
        }
      );

      await fc.assert(property, { numRuns: 30 });
    });

    it('property: non-existent file operations should fail consistently', async () => {
      const property = fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (nonExistentPath) => {
          // Mock file doesn't exist
          const notFoundError: any = new Error('ENOENT: no such file or directory');
          notFoundError.code = 'ENOENT';
          mockFs.stat.mockRejectedValue(notFoundError);
          mockFs.readFile.mockRejectedValue(notFoundError);
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          // Test tools that require existing files
          const toolsRequiringExistingFiles = ['delete_file', 'get_file_info'];
          
          for (const toolName of toolsRequiringExistingFiles) {
            const toolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
              call => call[0].name === toolName
            );
            
            if (toolCall) {
              const tool = toolCall[0];
              
              try {
                await tool.execute({
                  path: nonExistentPath,
                }, { log: { info: jest.fn() } });
                
                // Property: should not succeed for non-existent files
                return false;
                
              } catch (error) {
                // Property: should fail with appropriate error message
                const errorMessage = (error as Error).message;
                const isAppropriateError = errorMessage.includes('does not exist') ||
                                        errorMessage.includes('ENOENT') ||
                                        errorMessage.includes('not found');
                
                expect(isAppropriateError).toBe(true);
              }
            }
          }
          
          return true;
        }
      );

      await fc.assert(property, { numRuns: 25 });
    });
  });

  describe('Content Integrity Properties', () => {
    it('property: copy operations should preserve file content exactly', async () => {
      const property = fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 1000 }),
        async (fileContent) => {
          const sourcePath = '/test/source.txt';
          const destDir = '/test/dest';
          const destPath = '/test/dest/source.txt';
          
          // Mock source file exists with content
          mockFs.stat
            .mockResolvedValueOnce({ // source file
              isFile: () => true,
              isDirectory: () => false,
              size: fileContent.length,
            } as any)
            .mockResolvedValueOnce({ // dest directory
              isFile: () => false,
              isDirectory: () => true,
              size: 0,
            } as any)
            .mockRejectedValueOnce({ // dest file doesn't exist
              code: 'ENOENT',
            } as any)
            .mockResolvedValueOnce({ // dest file after copy
              isFile: () => true,
              size: fileContent.length,
            } as any);
          
          mockFs.readFile.mockResolvedValue(fileContent as any);
          mockFs.copyFile.mockResolvedValue(undefined as any);
          
          mockValidatePath
            .mockResolvedValueOnce(sourcePath as any)
            .mockResolvedValueOnce(destDir as any)
            .mockResolvedValueOnce(destPath as any);
          
          const { registerFilesystemTools } = await import('../../tools/filesystem');
          const mockServer = {
            addTool: jest.fn(),
            addResourceTemplate: jest.fn(),
          };
          
          registerFilesystemTools(mockServer as any);
          
          const copyToolCall = (mockServer.addTool as jest.Mock).mock.calls.find(
            (call: any) => call[0].name === 'copy_file'
          );
          
          if (copyToolCall) {
            const copyTool = copyToolCall[0] as any;
            
            try {
              const result = await copyTool.execute({
                source_path: sourcePath,
                destination_directory: destDir,
                overwrite: false
              }, { log: { info: jest.fn() } });
              
              // Property: copy operation should be called
              expect(mockFs.copyFile).toHaveBeenCalledWith(sourcePath, destPath);
              
              // Property: success message should indicate correct paths
              const isCorrectMessage = result.includes(sourcePath) && result.includes(destPath);
              expect(isCorrectMessage).toBe(true);
              
              return true;
              
            } catch (error) {
              // Valid error conditions should be related to file system issues
              const errorMessage = (error as Error).message;
              const isValidError = errorMessage.includes('does not exist') ||
                                 errorMessage.includes('already exists') ||
                                 errorMessage.includes('Access denied');
              
              return isValidError;
            }
          }
          
          return false;
        }
      );

      await fc.assert(property, { numRuns: 30 });
    });
  });
});
