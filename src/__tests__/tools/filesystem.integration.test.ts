// src/__tests__/tools/filesystem.integration.test.ts

import { jest } from '@jest/globals';

// Mock fs/promises before all other imports
const mockFs = {
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
};
jest.mock('fs/promises', () => mockFs);

// Mock glob
const mockGlob = jest.fn();
jest.mock('glob', () => ({ glob: mockGlob }));

// Mock security module
const mockValidatePath = jest.fn();
const mockValidatePaths = jest.fn();
jest.mock('../../utils/security.js', () => ({
  validatePath: mockValidatePath,
  validatePaths: mockValidatePaths,
  allowedDirectories: ['/safe/'],
}));

// Mock path-helpers
const mockGetPathFromOptions = jest.fn();
jest.mock('../../utils/path-helpers.js', () => ({
  getPathFromOptions: mockGetPathFromOptions,
  validatePathOptions: jest.fn(),
  PathArgumentSchema: { merge: () => ({ optional: () => ({}) }) },
}));

// Mock FastMCP and UserError
const mockUserError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
};

const mockServer = {
  addResourceTemplate: jest.fn(),
  addTool: jest.fn(),
};

jest.mock('fastmcp', () => ({
  UserError: mockUserError,
}));

import { registerFilesystemTools } from '../../tools/filesystem';

describe('Filesystem Tools Integration Tests', () => {
  // In-memory representation of our filesystem for testing
  let memoryFs: { [key: string]: string | { type: 'directory' } } = {};
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset in-memory filesystem
    memoryFs = {
      '/safe/existing-file.txt': 'existing content',
      '/safe/directory/': { type: 'directory' },
      '/safe/directory/subfile.txt': 'subfile content',
    };
    
    // Setup default mock implementations
    mockValidatePath.mockImplementation((path: string) => Promise.resolve(path));
    mockValidatePaths.mockImplementation((paths: string[]) => Promise.resolve(paths));
    mockGetPathFromOptions.mockImplementation((args: any) => 
      args.path || args.file_path || args.filepath || '/safe/default.txt'
    );
    
    // Setup fs mocks
    mockFs.stat.mockImplementation((path: string) => {
      if (memoryFs[path]) {
        const item = memoryFs[path];
        if (typeof item === 'object' && item.type === 'directory') {
          return Promise.resolve({
            isFile: () => false,
            isDirectory: () => true,
            size: 0,
            birthtime: new Date(),
            mtime: new Date(),
            atime: new Date(),
            ctime: new Date(),
            mode: 0o755,
            ino: 123456,
            dev: 2049,
            nlink: 1,
            uid: 1000,
            gid: 1000,
          });
        } else {
          return Promise.resolve({
            isFile: () => true,
            isDirectory: () => false,
            size: typeof item === 'string' ? item.length : 0,
            birthtime: new Date(),
            mtime: new Date(),
            atime: new Date(),
            ctime: new Date(),
            mode: 0o644,
            ino: 123456,
            dev: 2049,
            nlink: 1,
            uid: 1000,
            gid: 1000,
          });
        }
      }
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    
    mockFs.readFile.mockImplementation((path: string) => {
      if (memoryFs[path] && typeof memoryFs[path] === 'string') {
        return Promise.resolve(memoryFs[path]);
      }
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    
    mockFs.writeFile.mockImplementation((path: string, content: string) => {
      memoryFs[path] = content;
      return Promise.resolve();
    });
    
    mockFs.unlink.mockImplementation((path: string) => {
      if (memoryFs[path]) {
        delete memoryFs[path];
        return Promise.resolve();
      }
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    
    mockFs.mkdir.mockImplementation((path: string) => {
      memoryFs[path + '/'] = { type: 'directory' };
      return Promise.resolve();
    });
    
    mockFs.appendFile.mockImplementation((path: string, content: string) => {
      if (memoryFs[path] && typeof memoryFs[path] === 'string') {
        memoryFs[path] = (memoryFs[path] as string) + content;
      } else {
        memoryFs[path] = content;
      }
      return Promise.resolve();
    });
    
    mockFs.copyFile.mockImplementation((src: string, dest: string) => {
      if (memoryFs[src] && typeof memoryFs[src] === 'string') {
        memoryFs[dest] = memoryFs[src];
        return Promise.resolve();
      }
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    
    mockFs.rename.mockImplementation((src: string, dest: string) => {
      if (memoryFs[src]) {
        memoryFs[dest] = memoryFs[src];
        delete memoryFs[src];
        return Promise.resolve();
      }
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      return Promise.reject(error);
    });
    
    mockFs.readdir.mockImplementation((path: string) => {
      // Simple mock - return empty array
      return Promise.resolve([]);
    });
    
    mockFs.realpath.mockImplementation((path: string) => Promise.resolve(path));
  });

  describe('Tool Registration', () => {
    it('should register all filesystem tools successfully', () => {
      registerFilesystemTools(mockServer as any);
      
      // Verify resource template registration
      expect(mockServer.addResourceTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          uriTemplate: "file://{path}",
          name: "File Content Reader",
        })
      );
      
      // Verify tool registrations
      const expectedTools = [
        'write_file',
        'create_directory',
        'get_file_info',
        'list_allowed_directories',
        'read_multiple_files',
        'copy_file',
        'append_file',
        'edit_file',
        'directory_tree',
        'delete_file',
        'rename_file',
        'search_files_and_folders',
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
      
      // Total calls should match expected tools + resource template
      expect(mockServer.addTool).toHaveBeenCalledTimes(expectedTools.length);
      expect(mockServer.addResourceTemplate).toHaveBeenCalledTimes(1);
    });
  });

  describe('write_file Tool', () => {
    let writeFileTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const writeFileCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'write_file'
      );
      writeFileTool = writeFileCall[0];
    });

    it('should create a new file with content', async () => {
      const filePath = '/safe/new-file.txt';
      const content = 'Hello, World!';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      // File doesn't exist initially
      mockFs.stat.mockRejectedValueOnce({
        code: 'ENOENT',
        message: 'File not found'
      });
      
      const result = await writeFileTool.execute({
        path: filePath,
        content: content
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`File created successfully: ${filePath} (${content.length} characters)`);
      expect(memoryFs[filePath]).toBe(content);
      expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
    });

    it('should replace existing file content', async () => {
      const filePath = '/safe/existing-file.txt';
      const newContent = 'New content';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      const result = await writeFileTool.execute({
        path: filePath,
        content: newContent
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`File replaced successfully: ${filePath} (${newContent.length} characters)`);
      expect(memoryFs[filePath]).toBe(newContent);
    });

    it('should reject content exceeding size limit', async () => {
      const filePath = '/safe/large-file.txt';
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(writeFileTool.execute({
        path: filePath,
        content: largeContent
      }, { log: { info: jest.fn() } })).rejects.toThrow('Content exceeds maximum size limit (10MB)');
    });

    it('should validate path through security layer', async () => {
      const filePath = '/unsafe/file.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockRejectedValue(new mockUserError('Access denied'));
      
      await expect(writeFileTool.execute({
        path: filePath,
        content: 'content'
      }, { log: { info: jest.fn() } })).rejects.toThrow('Access denied');
      
      expect(mockValidatePath).toHaveBeenCalledWith(filePath);
    });
  });

  describe('delete_file Tool', () => {
    let deleteFileTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const deleteFileCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'delete_file'
      );
      deleteFileTool = deleteFileCall[0];
    });

    it('should delete an existing file successfully', async () => {
      const filePath = '/safe/existing-file.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      // Verify file exists before deletion
      expect(memoryFs[filePath]).toBeDefined();
      
      const result = await deleteFileTool.execute({
        path: filePath
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`File deleted successfully: ${filePath}`);
      expect(memoryFs[filePath]).toBeUndefined();
      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
    });

    it('should throw error if file does not exist', async () => {
      const filePath = '/safe/non-existent.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(deleteFileTool.execute({
        path: filePath
      }, { log: { info: jest.fn() } })).rejects.toThrow('File does not exist');
    });

    it('should throw error when trying to delete a directory', async () => {
      const dirPath = '/safe/directory';
      
      mockGetPathFromOptions.mockReturnValue(dirPath);
      mockValidatePath.mockResolvedValue(dirPath);
      
      // Mock the directory
      memoryFs[dirPath] = { type: 'directory' };
      
      await expect(deleteFileTool.execute({
        path: dirPath
      }, { log: { info: jest.fn() } })).rejects.toThrow('Cannot delete directory with delete_file tool');
    });
  });

  describe('copy_file Tool', () => {
    let copyFileTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const copyFileCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'copy_file'
      );
      copyFileTool = copyFileCall[0];
    });

    it('should copy file to destination directory', async () => {
      const sourcePath = '/safe/existing-file.txt';
      const destDir = '/safe/directory';
      const expectedDestPath = '/safe/directory/existing-file.txt';
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)  // source validation
        .mockResolvedValueOnce(destDir)     // destination dir validation
        .mockResolvedValueOnce(expectedDestPath); // final destination validation
      
      const result = await copyFileTool.execute({
        source_path: sourcePath,
        destination_directory: destDir,
        overwrite: false
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`File copied successfully from ${sourcePath} to ${expectedDestPath}`);
      expect(memoryFs[expectedDestPath]).toBe(memoryFs[sourcePath]);
      expect(mockFs.copyFile).toHaveBeenCalledWith(sourcePath, expectedDestPath);
    });

    it('should reject copy if destination file exists and overwrite is false', async () => {
      const sourcePath = '/safe/existing-file.txt';
      const destDir = '/safe/directory';
      const expectedDestPath = '/safe/directory/existing-file.txt';
      
      // Destination file already exists
      memoryFs[expectedDestPath] = 'existing dest content';
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)
        .mockResolvedValueOnce(destDir)
        .mockResolvedValueOnce(expectedDestPath);
      
      await expect(copyFileTool.execute({
        source_path: sourcePath,
        destination_directory: destDir,
        overwrite: false
      }, { log: { info: jest.fn() } })).rejects.toThrow('Destination file already exists');
    });

    it('should allow overwrite when overwrite flag is true', async () => {
      const sourcePath = '/safe/existing-file.txt';
      const destDir = '/safe/directory';
      const expectedDestPath = '/safe/directory/existing-file.txt';
      
      // Destination file already exists
      memoryFs[expectedDestPath] = 'existing dest content';
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)
        .mockResolvedValueOnce(destDir)
        .mockResolvedValueOnce(expectedDestPath);
      
      const result = await copyFileTool.execute({
        source_path: sourcePath,
        destination_directory: destDir,
        overwrite: true
      }, { log: { info: jest.fn(), warn: jest.fn() } });
      
      expect(result).toBe(`File copied successfully from ${sourcePath} to ${expectedDestPath}`);
      expect(memoryFs[expectedDestPath]).toBe(memoryFs[sourcePath]);
    });
  });

  describe('append_file Tool', () => {
    let appendFileTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const appendFileCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'append_file'
      );
      appendFileTool = appendFileCall[0];
    });

    it('should append content to existing file', async () => {
      const filePath = '/safe/existing-file.txt';
      const appendContent = '\nNew line';
      const originalContent = memoryFs[filePath] as string;
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      const result = await appendFileTool.execute({
        path: filePath,
        content: appendContent
      }, { log: { info: jest.fn() } });
      
      const expectedFinalContent = originalContent + appendContent;
      expect(memoryFs[filePath]).toBe(expectedFinalContent);
      expect(result).toBe(expectedFinalContent);
      expect(mockFs.appendFile).toHaveBeenCalledWith(filePath, appendContent, 'utf-8');
    });

    it('should create new file if it does not exist', async () => {
      const filePath = '/safe/new-append-file.txt';
      const content = 'First content';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      const result = await appendFileTool.execute({
        path: filePath,
        content: content
      }, { log: { info: jest.fn() } });
      
      expect(memoryFs[filePath]).toBe(content);
      expect(result).toBe(content);
    });

    it('should reject content exceeding size limit', async () => {
      const filePath = '/safe/file.txt';
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(appendFileTool.execute({
        path: filePath,
        content: largeContent
      }, { log: { info: jest.fn() } })).rejects.toThrow('Append content exceeds maximum size limit (1MB)');
    });
  });

  describe('create_directory Tool', () => {
    let createDirectoryTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const createDirCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'create_directory'
      );
      createDirectoryTool = createDirCall[0];
    });

    it('should create new directory', async () => {
      const dirPath = '/safe/new-directory';
      
      mockGetPathFromOptions.mockReturnValue(dirPath);
      mockValidatePath.mockResolvedValue(dirPath);
      
      const result = await createDirectoryTool.execute({
        path: dirPath
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`Directory created successfully: ${dirPath}`);
      expect(memoryFs[dirPath + '/']).toEqual({ type: 'directory' });
      expect(mockFs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should report if directory already exists', async () => {
      const dirPath = '/safe/directory';
      
      mockGetPathFromOptions.mockReturnValue(dirPath);
      mockValidatePath.mockResolvedValue(dirPath);
      
      const result = await createDirectoryTool.execute({
        path: dirPath
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`Directory already exists: ${dirPath}`);
    });

    it('should throw error if path exists but is not a directory', async () => {
      const filePath = '/safe/existing-file.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(createDirectoryTool.execute({
        path: filePath
      }, { log: { info: jest.fn() } })).rejects.toThrow('Path exists but is not a directory');
    });
  });

  describe('get_file_info Tool', () => {
    let getFileInfoTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const getInfoCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'get_file_info'
      );
      getFileInfoTool = getInfoCall[0];
    });

    it('should return detailed file information', async () => {
      const filePath = '/safe/existing-file.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      const result = await getFileInfoTool.execute({
        path: filePath
      }, { log: { info: jest.fn() } });
      
      const info = JSON.parse(result);
      expect(info).toHaveProperty('path', filePath);
      expect(info).toHaveProperty('type', 'file');
      expect(info).toHaveProperty('size');
      expect(info).toHaveProperty('sizeHuman');
      expect(info).toHaveProperty('permissions');
      expect(info).toHaveProperty('timestamps');
      expect(info).toHaveProperty('system');
      expect(info.permissions).toHaveProperty('octal');
      expect(info.permissions).toHaveProperty('user');
      expect(info.permissions).toHaveProperty('group');
      expect(info.permissions).toHaveProperty('others');
    });

    it('should return directory information', async () => {
      const dirPath = '/safe/directory';
      
      mockGetPathFromOptions.mockReturnValue(dirPath);
      mockValidatePath.mockResolvedValue(dirPath);
      
      const result = await getFileInfoTool.execute({
        path: dirPath
      }, { log: { info: jest.fn() } });
      
      const info = JSON.parse(result);
      expect(info.type).toBe('directory');
      expect(info.path).toBe(dirPath);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = '/safe/non-existent.txt';
      
      mockGetPathFromOptions.mockReturnValue(filePath);
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(getFileInfoTool.execute({
        path: filePath
      }, { log: { info: jest.fn() } })).rejects.toThrow('File or directory does not exist');
    });
  });

  describe('read_multiple_files Tool', () => {
    let readMultipleFilesTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const readMultipleCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'read_multiple_files'
      );
      readMultipleFilesTool = readMultipleCall[0];
    });

    it('should read multiple files successfully', async () => {
      const filePaths = ['/safe/existing-file.txt', '/safe/directory/subfile.txt'];
      
      mockValidatePaths.mockResolvedValue(filePaths);
      
      const result = await readMultipleFilesTool.execute({
        paths: filePaths
      }, { log: { info: jest.fn(), warn: jest.fn() } });
      
      expect(result).toContain('/safe/existing-file.txt:\nexisting content');
      expect(result).toContain('/safe/directory/subfile.txt:\nsubfile content');
      expect(result).toContain('---');
    });

    it('should handle mix of successful and failed file reads', async () => {
      const filePaths = ['/safe/existing-file.txt', '/safe/non-existent.txt'];
      
      mockValidatePaths.mockResolvedValue(filePaths);
      
      const result = await readMultipleFilesTool.execute({
        paths: filePaths
      }, { log: { info: jest.fn(), warn: jest.fn() } });
      
      expect(result).toContain('/safe/existing-file.txt:\nexisting content');
      expect(result).toContain('/safe/non-existent.txt: Error -');
    });

    it('should reject more than 50 files', async () => {
      const tooManyPaths = Array(51).fill('/safe/file.txt');
      
      await expect(readMultipleFilesTool.execute({
        paths: tooManyPaths
      }, { log: { info: jest.fn() } })).rejects.toThrow('Maximum 50 files can be read at once');
    });

    it('should reject empty paths array', async () => {
      await expect(readMultipleFilesTool.execute({
        paths: []
      }, { log: { info: jest.fn() } })).rejects.toThrow('At least one path must be provided');
    });
  });

  describe('rename_file Tool', () => {
    let renameFileTool: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const renameCall = (mockServer.addTool as jest.Mock).mock.calls.find(
        call => call[0].name === 'rename_file'
      );
      renameFileTool = renameCall[0];
    });

    it('should rename file successfully', async () => {
      const sourcePath = '/safe/existing-file.txt';
      const destPath = '/safe/renamed-file.txt';
      const originalContent = memoryFs[sourcePath];
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)
        .mockResolvedValueOnce(destPath);
      
      const result = await renameFileTool.execute({
        source_path: sourcePath,
        destination_path: destPath
      }, { log: { info: jest.fn() } });
      
      expect(result).toBe(`File renamed successfully from ${sourcePath} to ${destPath}`);
      expect(memoryFs[destPath]).toBe(originalContent);
      expect(memoryFs[sourcePath]).toBeUndefined();
      expect(mockFs.rename).toHaveBeenCalledWith(sourcePath, destPath);
    });

    it('should throw error if source file does not exist', async () => {
      const sourcePath = '/safe/non-existent.txt';
      const destPath = '/safe/renamed.txt';
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)
        .mockResolvedValueOnce(destPath);
      
      await expect(renameFileTool.execute({
        source_path: sourcePath,
        destination_path: destPath
      }, { log: { info: jest.fn() } })).rejects.toThrow('Source file does not exist');
    });

    it('should throw error if destination already exists', async () => {
      const sourcePath = '/safe/existing-file.txt';
      const destPath = '/safe/directory/subfile.txt'; // Already exists
      
      mockValidatePath
        .mockResolvedValueOnce(sourcePath)
        .mockResolvedValueOnce(destPath);
      
      await expect(renameFileTool.execute({
        source_path: sourcePath,
        destination_path: destPath
      }, { log: { info: jest.fn() } })).rejects.toThrow('Destination file already exists');
    });

    it('should throw error for identical source and destination paths', async () => {
      await expect(renameFileTool.execute({
        source_path: '/safe/file.txt',
        destination_path: '/safe/file.txt'
      }, { log: { info: jest.fn() } })).rejects.toThrow('Source path and destination path cannot be identical');
    });
  });

  describe('Resource Template', () => {
    let resourceTemplate: any;

    beforeEach(() => {
      registerFilesystemTools(mockServer as any);
      const resourceCall = (mockServer.addResourceTemplate as jest.Mock).mock.calls[0];
      resourceTemplate = resourceCall[0];
    });

    it('should load file content through resource template', async () => {
      const filePath = '/safe/existing-file.txt';
      
      mockValidatePath.mockResolvedValue(filePath);
      
      const result = await resourceTemplate.load({ path: filePath });
      
      expect(result).toEqual({
        text: 'existing content'
      });
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should throw error for non-existent file in resource template', async () => {
      const filePath = '/safe/non-existent.txt';
      
      mockValidatePath.mockResolvedValue(filePath);
      
      await expect(resourceTemplate.load({ path: filePath })).rejects.toThrow('File does not exist');
    });
  });
});
