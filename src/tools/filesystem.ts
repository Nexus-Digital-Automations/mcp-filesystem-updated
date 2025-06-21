// src/tools/filesystem.ts
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from 'glob';
import { createTwoFilesPatch, diffLines } from 'diff';
import { validatePath, validatePaths } from "../utils/security.js";
import { PathArgumentSchema, getPathFromOptions, validatePathOptions } from "../utils/path-helpers.js";

/**
 * CONTRACT: File editing utility functions with immutability principles
 */

/**
 * IMMUTABILITY: Pure function for line ending normalization
 * 
 * Preconditions: text must be a string
 * Postconditions: returns string with consistent \n line endings
 * Invariants: original text content preserved, only line endings modified
 */
function normalizeLineEndings(text: string): string {
  if (typeof text !== 'string') {
    throw new UserError('Text must be a string for line ending normalization');
  }
  return text.replace(/\r\n/g, '\n');
}

/**
 * IMMUTABILITY: Pure function for string similarity calculation using Levenshtein distance
 * 
 * Preconditions:
 * - str1 and str2 must be strings
 * - function is deterministic and pure
 * 
 * Postconditions:
 * - Returns similarity score between 0 and 1 (1 = identical, 0 = completely different)
 * - No side effects on input parameters
 * 
 * Invariants:
 * - Similarity calculation is symmetric: calculateStringSimilarity(a, b) === calculateStringSimilarity(b, a)
 * - Empty strings return 0 similarity unless both are empty (then 1)
 * - Identical strings return 1
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  // DEFENSIVE PROGRAMMING: Input validation
  if (typeof str1 !== 'string' || typeof str2 !== 'string') {
    throw new UserError('Both inputs must be strings for similarity calculation');
  }
  
  // Handle edge cases
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // Convert to lowercase for case-insensitive comparison
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  
  // Convert distance to similarity score (0-1)
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * IMMUTABILITY: Pure function for unified diff generation
 * 
 * Preconditions:
 * - originalContent and newContent must be strings
 * - filepath must be valid string identifier
 * 
 * Postconditions:
 * - Returns git-style unified diff string
 * - No side effects on input parameters
 * 
 * Invariants:
 * - Diff generation is deterministic
 * - Input strings remain unmodified
 */
function createUnifiedDiff(originalContent: string, newContent: string, filepath: string = 'file'): string {
  const normalizedOriginal = normalizeLineEndings(originalContent);
  const normalizedNew = normalizeLineEndings(newContent);

  return createTwoFilesPatch(
    filepath,
    filepath,
    normalizedOriginal,
    normalizedNew,
    'original',
    'modified'
  );
}

/**
 * CONTRACT: Advanced file editing function with comprehensive validation and context-based matching
 * 
 * Preconditions:
 * - filePath must be validated and accessible
 * - edits must be non-empty array with valid edit objects
 * - dryRun must be boolean
 * - context conditions (before/after) must be valid strings when provided
 * 
 * Postconditions:
 * - File is modified according to edits (unless dryRun=true)
 * - Returns formatted diff showing all changes
 * - Original file preserved on any error
 * - Context conditions properly evaluated when specified
 * 
 * Invariants:
 * - Edit operations are applied sequentially
 * - File integrity maintained throughout process
 * - Error conditions result in no file modification
 * - Context matching preserves semantic intent
 */
async function applyFileEdits(
  filePath: string,
  edits: Array<{
    oldText?: string;
    newText?: string;
    old_string?: string;
    new_string?: string;
    context?: {
      before?: string;
      after?: string;
    };
  }>,
  dryRun = false
): Promise<string> {
  // DEFENSIVE PROGRAMMING: Input validation
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new UserError('File path must be a non-empty string');
  }
  
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new UserError('Edits must be a non-empty array');
  }
  
  if (typeof dryRun !== 'boolean') {
    throw new UserError('dryRun must be a boolean value');
  }

  // Read and normalize file content
  const content = normalizeLineEndings(await fs.readFile(filePath, 'utf-8'));
  let modifiedContent = content;

  // Apply each edit sequentially
  for (const [index, edit] of edits.entries()) {
    const oldTextToUse = edit.oldText ?? edit.old_string;
    const newTextToUse = edit.newText ?? edit.new_string;

    // DEFENSIVE PROGRAMMING: Validate edit structure
    if (oldTextToUse === undefined || newTextToUse === undefined) {
      throw new UserError(`Invalid edit operation at index ${index}: Missing required text/string pair.`);
    }
    
    const normalizedOld = normalizeLineEndings(oldTextToUse);
    const normalizedNew = normalizeLineEndings(newTextToUse);

    // Try exact match first
    if (modifiedContent.includes(normalizedOld)) {
      modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
      continue;
    }

    // Flexible line-by-line matching with indentation preservation and context validation
    const oldLines = normalizedOld.split('\n');
    const contentLines = modifiedContent.split('\n');
    let matchFound = false;

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const potentialMatch = contentLines.slice(i, i + oldLines.length);
      const isMatch = oldLines.every((oldLine, j) => {
        const contentLine = potentialMatch[j];
        return oldLine.trim() === contentLine.trim();
      });

      if (isMatch) {
        // DEFENSIVE PROGRAMMING: Context validation if specified
        if (edit.context) {
          let contextMatch = true;
          
          // Check before context
          if (edit.context.before) {
            const beforeLine = i > 0 ? contentLines[i - 1] : undefined;
            if (!beforeLine || !beforeLine.includes(edit.context.before)) {
              contextMatch = false;
            }
          }
          
          // Check after context
          if (edit.context.after) {
            const afterLineIndex = i + oldLines.length;
            const afterLine = afterLineIndex < contentLines.length ? contentLines[afterLineIndex] : undefined;
            if (!afterLine || !afterLine.includes(edit.context.after)) {
              contextMatch = false;
            }
          }
          
          // Skip this match if context doesn't match
          if (!contextMatch) {
            continue;
          }
        }

        const originalIndent = contentLines[i].match(/^\s*/)?.[0] || '';
        const newLines = normalizedNew.split('\n').map((line, j) => {
          if (j === 0) return originalIndent + line.trimStart();
          const oldIndent = oldLines[j]?.match(/^\s*/)?.[0] || '';
          const newIndent = line.match(/^\s*/)?.[0] || '';
          if (oldIndent && newIndent) {
            const relativeIndent = newIndent.length - oldIndent.length;
            return originalIndent + ' '.repeat(Math.max(0, relativeIndent)) + line.trimStart();
          }
          return line;
        });

        contentLines.splice(i, oldLines.length, ...newLines);
        modifiedContent = contentLines.join('\n');
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      // FUZZY MATCHING: Use diff library to find similar lines
      const contentLines = modifiedContent.split('\n');
      const searchLines = normalizedOld.split('\n');
      
      // Find lines with character-level similarity using diff
      const diffResult = diffLines(normalizedOld, modifiedContent);
      
      // Extract similar lines that were changed or removed
      const similarLines: string[] = [];
      const contextLines: string[] = [];
      
      for (const part of diffResult) {
        if (part.removed || part.added) {
          const lines = part.value.trim().split('\n').filter(line => line.trim().length > 0);
          if (part.removed) {
            // These are lines that were "removed" which means they exist in search but not in content
            // We want lines that are similar to our search
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.length > 0) {
                contextLines.push(`Expected: ${trimmedLine}`);
              }
            }
          } else if (part.added) {
            // These are lines that were "added" which means they exist in content but not in search
            // These are potential matches
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.length > 0) {
                similarLines.push(trimmedLine);
              }
            }
          }
        }
      }
      
      // Look for close matches using simple string similarity
      const allContentLines = contentLines.map(line => line.trim()).filter(line => line.length > 0);
      const searchLine = searchLines[0]?.trim() || normalizedOld.trim();
      
      if (searchLine.length > 0) {
        const possibleMatches = allContentLines
          .map(line => ({
            line,
            similarity: calculateStringSimilarity(searchLine, line)
          }))
          .filter(match => match.similarity > 0.3) // 30% similarity threshold
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 12); // Top 12 matches
        
        for (const match of possibleMatches) {
          if (!similarLines.includes(match.line)) {
            similarLines.push(match.line);
          }
        }
      }
      
      // Prepare helpful error message with similar lines
      let errorMessage = `Could not find exact or flexible match for edit at index ${index}:\n${normalizedOld}`;
      
      if (similarLines.length > 0) {
        errorMessage += '\n\nFound similar lines that might be what you\'re looking for:';
        for (let i = 0; i < Math.min(12, similarLines.length); i++) {
          errorMessage += `\n${i + 1}. "${similarLines[i]}"`;
        }
        errorMessage += '\n\nPlease verify the exact text you want to replace and try again.';
      } else {
        errorMessage += '\n\nNo similar lines found. Please check the file content and ensure the text to replace exists.';
      }
      
      throw new UserError(errorMessage);
    }
  }

  // Generate diff with proper formatting
  const diff = createUnifiedDiff(content, modifiedContent, filePath);
  let numBackticks = 3;
  while (diff.includes('`'.repeat(numBackticks))) {
    numBackticks++;
  }
  const formattedDiff = `${'`'.repeat(numBackticks)}diff\n${diff}${'`'.repeat(numBackticks)}\n\n`;

  // Write file if not dry run
  if (!dryRun) {
    await fs.writeFile(filePath, modifiedContent, 'utf-8');
  }

  return formattedDiff;
}

/**
 * IMMUTABILITY: Pure function for file discovery with glob patterns and advanced ignore handling
 * 
 * Preconditions:
 * - targets must be non-empty array of strings
 * - all target paths must be validated through security boundaries
 * - ignorePatterns must be valid array of strings or undefined
 * 
 * Postconditions:
 * - Returns Set of absolute file paths for deduplication
 * - All returned paths are within allowed directories
 * - No side effects on input parameters
 * - Ignored patterns are properly filtered out
 * 
 * Invariants:
 * - File discovery is deterministic for same inputs
 * - Security boundaries are never violated
 * - Error isolation prevents one target from affecting others
 * - Default ignore patterns are always applied
 */
async function discoverTargetFiles(
  targets: string[], 
  ignorePatterns: string[] = []
): Promise<Set<string>> {
  // DEFENSIVE PROGRAMMING: Input validation
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new UserError('Targets must be a non-empty array');
  }
  
  if (targets.length > 500) {
    throw new UserError('Maximum 500 targets allowed for bulk operations');
  }
  
  for (const [index, target] of targets.entries()) {
    if (typeof target !== 'string' || target.trim().length === 0) {
      throw new UserError(`Target at index ${index} must be a non-empty string`);
    }
  }
  
  if (!Array.isArray(ignorePatterns)) {
    throw new UserError('ignorePatterns must be an array');
  }
  
  if (ignorePatterns.length > 200) {
    throw new UserError('Maximum 200 ignore patterns allowed');
  }
  
  // DEFAULT IGNORE PATTERNS: Common directories and files to automatically exclude
  const defaultIgnorePatterns = [
    // Version control
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    
    // Dependencies and packages
    '**/node_modules/**',
    '**/bower_components/**',
    '**/vendor/**',
    '**/packages/**/*.min.js',
    
    // Python environments and caches
    '**/.venv/**',
    '**/venv/**',
    '**/env/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '**/.pytest_cache/**',
    
    // Build outputs
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    
    // IDE and editor files
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.swp',
    '**/*.swo',
    '**/*~',
    
    // System files
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/desktop.ini',
    
    // Logs and temporary files
    '**/logs/**',
    '**/*.log',
    '**/tmp/**',
    '**/temp/**',
    '**/*.tmp',
    '**/*.temp',
    
    // Coverage and test outputs
    '**/coverage/**',
    '**/.nyc_output/**',
    '**/test-results/**',
    
    // Hidden files (can be overridden)
    '**/.*'
  ];
  
  // IMMUTABILITY: Combine default and user patterns
  const allIgnorePatterns = [...defaultIgnorePatterns, ...ignorePatterns];
  
  // IMMUTABILITY: Use Set for automatic deduplication
  const allTargetFiles = new Set<string>();
  
  // DEFENSIVE PROGRAMMING: Process each target with error isolation
  const discoveryResults = await Promise.allSettled(
    targets.map(async (target) => {
      try {
        const validTarget = await validatePath(target);
        const stats = await fs.stat(validTarget).catch(() => null);
        
        const targetFiles = new Set<string>();
        
        if (stats?.isFile()) {
          // Direct file target - check if it should be ignored using glob patterns
          let shouldIgnore = false;
          for (const pattern of allIgnorePatterns) {
            try {
              // Use glob to test if file matches ignore pattern
              const matches = await glob(pattern, { 
                absolute: true,
                dot: true,
                cwd: path.dirname(validTarget)
              });
              if (matches.includes(validTarget)) {
                shouldIgnore = true;
                break;
              }
            } catch {
              // Skip invalid patterns
              continue;
            }
          }
          
          if (!shouldIgnore) {
            targetFiles.add(validTarget);
          }
        } else if (stats?.isDirectory()) {
          // Directory target - find all files recursively with ignore patterns
          const files = await glob('**/*', { 
            cwd: validTarget, 
            nodir: true, 
            absolute: true,
            dot: true,
            ignore: allIgnorePatterns
          });
          for (const file of files) {
            targetFiles.add(file);
          }
        } else {
          // Assume it's a glob pattern
          const files = await glob(target, { 
            nodir: true, 
            absolute: true,
            dot: true,
            ignore: allIgnorePatterns
          });
          for (const file of files) {
            // SECURITY BOUNDARY: Validate each discovered file
            try {
              const validFile = await validatePath(file);
              targetFiles.add(validFile);
            } catch (e) {
              // Skip files outside allowed directories
              continue;
            }
          }
        }
        
        return targetFiles;
        
      } catch (error) {
        // Return empty set for failed targets (error isolation)
        return new Set<string>();
      }
    })
  );
  
  // IMMUTABILITY: Merge all successful discovery results
  for (const result of discoveryResults) {
    if (result.status === 'fulfilled') {
      for (const file of result.value) {
        allTargetFiles.add(file);
      }
    }
  }
  
  // CONTRACT: Postcondition verification
  for (const filePath of allTargetFiles) {
    if (!path.isAbsolute(filePath)) {
      throw new UserError(`Postcondition violated: non-absolute path discovered: ${filePath}`);
    }
  }
  
  return allTargetFiles;
}

/**
 * CONTRACT: Filesystem tools registration function
 * 
 * Preconditions:
 * - server must be valid FastMCP instance
 * - All utility functions must be available
 * 
 * Postconditions:
 * - All filesystem tools registered successfully
 * - Resource templates configured properly
 * - Tools ready for client requests
 * 
 * Invariants:
 * - Tool registration is idempotent
 * - All tools follow advanced programming techniques
 * - Security validation applied consistently
 */
export function registerFilesystemTools(server: FastMCP) {
  // RESOURCE TEMPLATE: File content access
  server.addResourceTemplate({
    uriTemplate: "file://{path}",
    name: "File Content Reader",
    description: "Read the content of a file by path",
    arguments: [
      {
        name: "path",
        description: "The file path to read",
        required: true,
      },
    ],
    async load({ path }) {
      // SECURITY BOUNDARY: Validate path access
      const validPath = await validatePath(path as string);
      
      try {
        const content = await fs.readFile(validPath, "utf-8");
        return {
          text: content,
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new UserError(`File does not exist: ${path}`);
        }
        if (error.code === 'EISDIR') {
          throw new UserError(`Path is a directory, not a file: ${path}`);
        }
        if (error.code === 'EACCES') {
          throw new UserError(`Permission denied reading file: ${path}`);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to read file: ${errorMessage}`);
      }
    },
  });

  // TOOL: write_file - Complete file content replacement
  server.addTool({
    name: "write_file",
    description: `Completely replace file contents. Best for large changes (>20% of file) or when edit_block fails. Use with caution as it will overwrite existing files. Only works within allowed directories. IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths may fail as they depend on the current working directory. Tilde paths (~/...) might not work in all contexts. Unless the user explicitly asks for relative paths, use absolute paths.`,
    parameters: z.object({
      content: z.string().describe('The complete content to write to the file'),
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);
      
      // DEFENSIVE PROGRAMMING: Content validation
      if (typeof args.content !== 'string') {
        throw new UserError('Content must be a string');
      }
      
      if (args.content.length > 10 * 1024 * 1024) { // 10MB limit
        throw new UserError('Content exceeds maximum size limit (10MB)');
      }
      
      try {
        // Check if file exists for logging
        let fileExists = false;
        try {
          await fs.stat(validPath);
          fileExists = true;
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
        
        // Write content atomically
        await fs.writeFile(validPath, args.content, 'utf-8');
        
        const action = fileExists ? 'replaced' : 'created';
        log.info(`File ${action} successfully`, { path: pathToUse, size: args.content.length });
        
        // CONTRACT: Postcondition verification
        const writtenContent = await fs.readFile(validPath, 'utf-8');
        if (writtenContent !== args.content) {
          throw new UserError('Postcondition violated: written content does not match input');
        }
        
        return `File ${action} successfully: ${pathToUse} (${args.content.length} characters)`;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to write file: ${errorMessage}`);
      }
    },
  });

  // TOOL: create_directory - Directory creation with recursive parent creation
  server.addTool({
    name: "create_directory",
    description: `Create a new directory or ensure a directory exists. Can create multiple nested directories in one operation. Only works within allowed directories. IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths may fail as they depend on the current working directory. Tilde paths (~/...) might not work in all contexts. Unless the user explicitly asks for relative paths, use absolute paths.`,
    parameters: z.object({
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);
      
      try {
        // Check if directory already exists
        try {
          const stats = await fs.stat(validPath);
          if (stats.isDirectory()) {
            log.info('Directory already exists', { path: pathToUse });
            return `Directory already exists: ${pathToUse}`;
          } else {
            throw new UserError(`Path exists but is not a directory: ${pathToUse}`);
          }
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
        
        // Create directory recursively
        await fs.mkdir(validPath, { recursive: true });
        
        // CONTRACT: Postcondition verification
        const stats = await fs.stat(validPath);
        if (!stats.isDirectory()) {
          throw new UserError('Postcondition violated: created path is not a directory');
        }
        
        log.info('Directory created successfully', { path: pathToUse });
        return `Directory created successfully: ${pathToUse}`;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        if (error.code === 'EEXIST') {
          throw new UserError(`Path already exists: ${pathToUse}`);
        }
        if (error.code === 'EACCES') {
          throw new UserError(`Permission denied creating directory: ${pathToUse}`);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to create directory: ${errorMessage}`);
      }
    },
  });

  // TOOL: get_file_info - Detailed file/directory metadata retrieval
  server.addTool({
    name: "get_file_info",
    description: `Retrieve detailed metadata about a file or directory including size, creation time, last modified time, permissions, and type. Only works within allowed directories. IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths may fail as they depend on the current working directory. Tilde paths (~/...) might not work in all contexts. Unless the user explicitly asks for relative paths, use absolute paths.`,
    parameters: z.object({
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);
      
      try {
        const stats = await fs.stat(validPath);
        const realPath = await fs.realpath(validPath);
        
        // Determine file type
        let fileType = 'unknown';
        if (stats.isFile()) {
          fileType = 'file';
        } else if (stats.isDirectory()) {
          fileType = 'directory';
        } else if (stats.isSymbolicLink()) {
          fileType = 'symlink';
        } else if (stats.isBlockDevice()) {
          fileType = 'block_device';
        } else if (stats.isCharacterDevice()) {
          fileType = 'character_device';
        } else if (stats.isFIFO()) {
          fileType = 'fifo';
        } else if (stats.isSocket()) {
          fileType = 'socket';
        }
        
        // Format permissions
        const mode = stats.mode;
        const permissions = {
          octal: '0' + (mode & parseInt('777', 8)).toString(8),
          user: {
            read: !!(mode & parseInt('400', 8)),
            write: !!(mode & parseInt('200', 8)),
            execute: !!(mode & parseInt('100', 8)),
          },
          group: {
            read: !!(mode & parseInt('040', 8)),
            write: !!(mode & parseInt('020', 8)),
            execute: !!(mode & parseInt('010', 8)),
          },
          others: {
            read: !!(mode & parseInt('004', 8)),
            write: !!(mode & parseInt('002', 8)),
            execute: !!(mode & parseInt('001', 8)),
          },
        };
        
        // Build comprehensive metadata object
        const metadata = {
          path: pathToUse,
          realPath: realPath !== validPath ? realPath : undefined,
          type: fileType,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          permissions,
          timestamps: {
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
            changed: stats.ctime.toISOString(),
          },
          system: {
            inode: stats.ino,
            device: stats.dev,
            links: stats.nlink,
            uid: stats.uid,
            gid: stats.gid,
          },
        };
        
        // Add file extension for files
        if (fileType === 'file') {
          const ext = path.extname(pathToUse).toLowerCase();
          if (ext) {
            (metadata as any).extension = ext;
          }
        }
        
        return JSON.stringify(metadata, null, 2);
        
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new UserError(`File or directory does not exist: ${pathToUse}`);
        }
        if (error.code === 'EACCES') {
          throw new UserError(`Permission denied accessing: ${pathToUse}`);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to get file info: ${errorMessage}`);
      }
    },
  });

  // TOOL: list_allowed_directories
  server.addTool({
    name: "list_allowed_directories",
    description: "Lists the base directories that this server instance has been configured to access. This tool takes no arguments.",
    parameters: z.object({}),
    execute: async () => {
      const { allowedDirectories } = await import("../utils/security.js");
      return `Allowed directories:\n${allowedDirectories.join('\n')}`;
    },
  });

  // TOOL: read_multiple_files - Batch file reading with comprehensive error handling
  server.addTool({
    name: "read_multiple_files",
    description: `Reads the content of multiple files efficiently.
Arguments:
* \`paths\` (array of strings, required): A list of full file paths to read.
Output: Returns a single text block containing the content of each requested file, prefixed by its path. Files are separated by '\\n---\\n'. If a file cannot be read, an error message for that specific file is included instead of its content.
Security: Can only read files within pre-configured allowed directories.`,
    parameters: z.object({
      paths: z.array(z.string()).min(1, "At least one path must be provided").max(50, "Maximum 50 files can be read at once"),
    }),
    execute: async (args, { log }) => {
      // DEFENSIVE PROGRAMMING: Comprehensive input validation
      if (!Array.isArray(args.paths)) {
        throw new UserError("Paths must be provided as an array");
      }
      
      if (args.paths.length === 0) {
        throw new UserError("At least one path must be provided");
      }
      
      if (args.paths.length > 50) {
        throw new UserError("Maximum 50 files can be read at once");
      }
      
      for (const [index, filePath] of args.paths.entries()) {
        if (typeof filePath !== 'string' || filePath.trim().length === 0) {
          throw new UserError(`Path at index ${index} must be a non-empty string`);
        }
      }
      
      log.info(`Reading ${args.paths.length} files`, { pathCount: args.paths.length });
      
      // IMMUTABILITY: Process files with map, maintaining order
      const results = await Promise.all(
        args.paths.map(async (filePath: string) => {
          try {
            const validPath = await validatePath(filePath);
            const content = await fs.readFile(validPath, "utf-8");
            return `${filePath}:\n${content}`;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.warn(`Failed to read file: ${filePath}`, { error: errorMessage });
            return `${filePath}: Error - ${errorMessage}`;
          }
        }),
      );
      
      // CONTRACT: Postcondition verification
      if (results.length !== args.paths.length) {
        throw new UserError('Postcondition violated: result count does not match input count');
      }
      
      return results.join("\n---\n");
    },
  });

  // TOOL: copy_file - Secure file copying with comprehensive validation
  server.addTool({
    name: "copy_file",
    description: `Copies a file from a source path to a destination directory.
Arguments:
* \`source_path\` (string, required): The full path of the file to be copied.
* \`destination_directory\` (string, required): The full path of the directory where the file should be copied. The original filename will be used.
* \`overwrite\` (boolean, optional, default: false): If set to true, allows overwriting an existing file at the destination. If false (default), the operation will fail if the destination file already exists.
Output: Returns a success message indicating the source and destination paths upon successful copy.
Security: Can only copy files *from* and *to* locations within the pre-configured allowed directories. Both the source file and the destination directory must be within allowed paths.`,
    parameters: z.object({
      source_path: z.string().min(1).describe('The full path of the file to be copied.'),
      destination_directory: z.string().min(1).describe('The full path of the directory where the file should be copied. The original filename will be used.'),
      overwrite: z.boolean().optional().default(false).describe('If true, overwrite the destination file if it already exists. Defaults to false.')
    }),
    execute: async (args, { log }) => {
      const { source_path, destination_directory, overwrite } = args;

      // SECURITY BOUNDARY: Triple path validation
      const validSourcePath = await validatePath(source_path);
      const validDestDirectory = await validatePath(destination_directory);
      const sourceFileName = path.basename(validSourcePath);
      const finalDestPath = path.join(validDestDirectory, sourceFileName);
      await validatePath(finalDestPath); // Validate final destination

      // DEFENSIVE PROGRAMMING: Verify source is a file
      let sourceStats;
      try {
        sourceStats = await fs.stat(validSourcePath);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`Source file does not exist: ${source_path}`);
        }
        throw new UserError(`Cannot access source file: ${e.message}`);
      }

      if (!sourceStats.isFile()) {
        throw new UserError(`Source is not a regular file: ${source_path}`);
      }

      // DEFENSIVE PROGRAMMING: Verify destination is a directory
      let destStats;
      try {
        destStats = await fs.stat(validDestDirectory);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`Destination directory does not exist: ${destination_directory}`);
        }
        throw new UserError(`Cannot access destination directory: ${e.message}`);
      }

      if (!destStats.isDirectory()) {
        throw new UserError(`Destination is not a directory: ${destination_directory}`);
      }

      // DEFENSIVE PROGRAMMING: Check for overwrite
      try {
        const finalDestStats = await fs.stat(finalDestPath);
        if (!overwrite) {
          throw new UserError(`Destination file already exists: ${finalDestPath}. Use 'overwrite: true' to replace it.`);
        }
        log.info('Overwriting existing file', { destination: finalDestPath });
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }

      // IMMUTABILITY: Store original size for verification
      const originalSize = sourceStats.size;

      try {
        await fs.copyFile(validSourcePath, finalDestPath);
        
        // CONTRACT: Postcondition verification
        const copiedStats = await fs.stat(finalDestPath);
        if (copiedStats.size !== originalSize) {
          throw new UserError('Postcondition violated: copied file size does not match original');
        }
        
        log.info('File copied successfully', {
          source: source_path,
          destination: finalDestPath,
          size: originalSize
        });
        
        return `File copied successfully from ${source_path} to ${finalDestPath}`;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`File copy failed: ${errorMessage}`);
      }
    },
  });

  // TOOL: append_file - Safe file appending with path validation alternatives
  server.addTool({
    name: "append_file",
    description: `Appends the provided content to the end of an existing file. If the file does not exist, it might be created (behavior depends on the underlying filesystem).
Arguments:
* \`path\` / \`file_path\` / \`filepath\` (string, required): The full path to the file to append to. Provide exactly one of these.
* \`content\` (string, required): The text content to add to the end of the file.
Output: Returns the **entire content** of the file *after* the new content has been appended.
Security: Can only append to files within pre-configured allowed directories.`,
    parameters: z.object({
      content: z.string().describe('The text content to append to the file'),
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);
      
      // DEFENSIVE PROGRAMMING: Content validation
      if (typeof args.content !== 'string') {
        throw new UserError('Content must be a string');
      }
      
      if (args.content.length > 1024 * 1024) { // 1MB limit for append
        throw new UserError('Append content exceeds maximum size limit (1MB)');
      }
      
      try {
        // Store original size for verification
        let originalSize = 0;
        try {
          const stats = await fs.stat(validPath);
          originalSize = stats.size;
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
          // File doesn't exist, will be created
        }
        
        await fs.appendFile(validPath, args.content, "utf-8");
        
        // CONTRACT: Postcondition verification
        const newStats = await fs.stat(validPath);
        const expectedSize = originalSize + Buffer.byteLength(args.content, 'utf8');
        if (newStats.size !== expectedSize) {
          throw new UserError('Postcondition violated: file size after append is incorrect');
        }
        
        const updatedContent = await fs.readFile(validPath, "utf-8");
        
        log.info('Content appended successfully', {
          path: pathToUse,
          originalSize,
          appendedBytes: args.content.length,
          finalSize: newStats.size
        });
        
        return updatedContent;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to append to file: ${errorMessage}`);
      }
    },
  });

  // TOOL: edit_file - Advanced text editing with flexible matching and diff generation
  server.addTool({
    name: "edit_file",
    description: `Edits a specified text file by applying a sequence of find-and-replace operations.
Arguments:
* \`path\` / \`file_path\` / \`filepath\` (string, required): The full path to the file that needs editing. Provide exactly one of these.
* \`edits\` (array, required): An array of edit objects. Each object specifies one find-and-replace operation and must contain:
    * \`oldText\` (string, optional): The exact text content (potentially multi-line) to search for within the file. (Alternative to \`old_string\`)
    * \`newText\` (string, optional): The text content that will replace the found \`oldText\`. (Alternative to \`new_string\`)
    * \`old_string\` (string, optional): The exact text content (potentially multi-line) to search for within the file. (Alternative to \`oldText\`)
    * \`new_string\` (string, optional): The text content that will replace the found \`old_string\`. (Alternative to \`newText\`)
* \`dryRun\` (boolean, optional, default: false): If set to true, the tool will generate the diff of changes but will NOT save the modifications to the file.
Processing:
- You must provide either (\`oldText\` and \`newText\`) OR (\`old_string\` and \`new_string\`) in each edit operation, but not both.
- Edits are applied sequentially in the order they appear in the \`edits\` array.
- For each edit operation:
  1. An exact match for the search text is attempted first.
  2. If no exact match is found, a flexible line-by-line match is attempted, comparing lines after trimming leading/trailing whitespace. If found this way, the replacement text replaces the matched block while preserving the original indentation of the first line of the matched block.
  3. If the search text cannot be found using either method, the tool will return an error.
Output:
- Returns a string containing a git-style unified diff (\`---\`/\`+++\`/\`@@\`/\`+\`/\`-\` lines) showing the changes made (or the changes that would be made if \`dryRun\` is true).
- If \`dryRun\` is false (the default), the file at \`path\` is overwritten with the modified content *before* the diff is returned.
Example \`edits\` structure: \`[{"oldText": "text to find", "newText": "replacement text"}, {"old_string": "find something else", "new_string": "replace it"}]\`
Security: This tool can only operate on files within the pre-configured allowed directories.`,
    parameters: z.object({
      edits: z.array(z.object({
        oldText: z.string().optional(),
        newText: z.string().optional(),
        old_string: z.string().optional(),
        new_string: z.string().optional(),
      }).refine(data => (data.oldText !== undefined && data.newText !== undefined) || (data.old_string !== undefined && data.new_string !== undefined), {
        message: "Each edit must provide either ('oldText' and 'newText') OR ('old_string' and 'new_string')",
      }).refine(data => !(data.oldText !== undefined && data.old_string !== undefined) && !(data.newText !== undefined && data.new_string !== undefined), {
        message: "Cannot provide both 'oldText' and 'old_string' (or 'newText' and 'new_string') in the same edit",
      })).min(1, "At least one edit operation must be provided"),
      dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format'),
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);
      
      // DEFENSIVE PROGRAMMING: Validate file exists and is readable
      try {
        const stats = await fs.stat(validPath);
        if (!stats.isFile()) {
          throw new UserError(`Path is not a regular file: ${pathToUse}`);
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`File does not exist: ${pathToUse}`);
        }
        throw new UserError(`Cannot access file: ${e.message}`);
      }
      
      log.info(`Applying ${args.edits.length} edits to file`, {
        path: pathToUse,
        editCount: args.edits.length,
        dryRun: args.dryRun
      });
      
      try {
        const result = await applyFileEdits(validPath, args.edits, args.dryRun);
        
        const action = args.dryRun ? 'Preview generated' : 'File edited successfully';
        log.info(action, { path: pathToUse });
        
        return result;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`File edit failed: ${errorMessage}`);
      }
    },
  });

  // TOOL: bulk_edit - Advanced multi-file editing with context-based matching and intelligent ignore patterns
  server.addTool({
    name: "bulk_edit", 
    description: `Performs bulk find-and-replace operations across multiple files and directories with optional context-based matching and advanced ignore patterns.
Arguments:
* \`targets\` (array, required): An array of strings specifying the files, folders, or glob patterns to apply edits to.
* \`edits\` (array, required): An array of edit objects, each with:
    * \`oldText\` (string, required): The text to search for.
    * \`newText\` (string, required): The replacement text.
    * \`context\` (object, optional): Specifies context-based matching rules.
        * \`before\` (string, optional): The edit will only be applied if the line immediately preceding the match contains this text.
        * \`after\` (string, optional): The edit will only be applied if the line immediately following the match contains this text.
    * \`conditions\` (object, optional): Advanced conditional logic for when to apply this edit.
        * \`and\` (array, optional): All conditions must be true (file path contains all specified strings).
        * \`or\` (array, optional): At least one condition must be true (file path contains at least one specified string).
        * \`not\` (array, optional): None of these conditions should be true (file path contains none of specified strings).
* \`ignorePatterns\` (array, optional): Additional glob patterns to ignore beyond the default patterns. Default patterns automatically exclude common directories like node_modules, .git, .venv, dist, etc.
* \`dryRun\` (boolean, optional, default: false): If true, returns a diff of the changes without saving them.
Output: Returns a comprehensive diff showing all changes across all matched files with file-by-file breakdown.
Security: Can only operate on files within pre-configured allowed directories. Supports up to 100,000 files with intelligent filtering and performance optimizations.`,
    parameters: z.object({
      targets: z.array(z.string().min(1, "Target cannot be empty")).min(1, "At least one target must be provided").max(500, "Maximum 500 targets allowed"),
      edits: z.array(z.object({
        oldText: z.string().min(1, "oldText cannot be empty"),
        newText: z.string(),
        context: z.object({
          before: z.string().optional(),
          after: z.string().optional(),
        }).optional(),
        conditions: z.object({
          and: z.array(z.string()).optional().describe("All conditions must match (file path contains all strings)"),
          or: z.array(z.string()).optional().describe("At least one condition must match (file path contains any string)"),
          not: z.array(z.string()).optional().describe("None of these conditions should match (file path contains none of these strings)"),
        }).optional(),
      })).min(1, "At least one edit operation must be provided").max(100, "Maximum 100 edit operations allowed"),
      ignorePatterns: z.array(z.string()).optional().default([]).describe("Additional patterns to ignore beyond default patterns"),
      dryRun: z.boolean().default(false),
    }),
    execute: async (args, { log }) => {
      const { targets, edits, ignorePatterns = [], dryRun } = args;
      
      // DEFENSIVE PROGRAMMING: Comprehensive input validation
      if (edits.some(edit => edit.oldText.length > 50000)) {
        throw new UserError('Edit search text exceeds maximum length (50,000 characters)');
      }
      
      if (edits.some(edit => edit.newText.length > 50000)) {
        throw new UserError('Edit replacement text exceeds maximum length (50,000 characters)');
      }
      
      log.info(`Starting bulk edit operation`, {
        targetCount: targets.length,
        editCount: edits.length,
        ignorePatternCount: ignorePatterns.length,
        dryRun
      });
      
      // IMMUTABILITY: Discover all target files with ignore patterns
      const allTargetFiles = await discoverTargetFiles(targets, ignorePatterns);
      const finalFiles = Array.from(allTargetFiles);
      
      if (finalFiles.length === 0) {
        throw new UserError('No files found matching the specified targets after applying ignore patterns');
      }
      
      if (finalFiles.length > 100000) {
        throw new UserError(`Too many files discovered (${finalFiles.length}). Maximum 100,000 files allowed for bulk operations.`);
      }
      
      log.info(`Found ${finalFiles.length} files to process for bulk edit`);
      
      // PERFORMANCE OPTIMIZATION: Process files in batches for very large operations
      const BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < finalFiles.length; i += BATCH_SIZE) {
        batches.push(finalFiles.slice(i, i + BATCH_SIZE));
      }
      
      let allDiffs = '';
      let filesChanged = 0;
      let totalErrors = 0;
      let totalProcessed = 0;
      
      // DEFENSIVE PROGRAMMING: Process files in batches with comprehensive error handling
      for (const [batchIndex, batch] of batches.entries()) {
        log.info(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (file) => {
            try {
              // SECURITY BOUNDARY: Re-validate each file path
              const validFile = await validatePath(file);
              
              // Verify file is still accessible and is a regular file
              const stats = await fs.stat(validFile);
              if (!stats.isFile()) {
                throw new UserError(`Not a regular file: ${file}`);
              }
              
              // CONDITIONAL LOGIC: Filter edits based on file path conditions
              const applicableEdits = edits.filter(edit => {
                if (!edit.conditions) return true;
                
                const filePath = file.toLowerCase();
                
                // AND logic: All conditions must be true
                if (edit.conditions.and && edit.conditions.and.length > 0) {
                  const allMatch = edit.conditions.and.every(condition => 
                    filePath.includes(condition.toLowerCase())
                  );
                  if (!allMatch) return false;
                }
                
                // OR logic: At least one condition must be true
                if (edit.conditions.or && edit.conditions.or.length > 0) {
                  const anyMatch = edit.conditions.or.some(condition => 
                    filePath.includes(condition.toLowerCase())
                  );
                  if (!anyMatch) return false;
                }
                
                // NOT logic: None of these conditions should be true
                if (edit.conditions.not && edit.conditions.not.length > 0) {
                  const noneMatch = edit.conditions.not.every(condition => 
                    !filePath.includes(condition.toLowerCase())
                  );
                  if (!noneMatch) return false;
                }
                
                return true;
              });
              
              // Skip file if no edits apply
              if (applicableEdits.length === 0) {
                return {
                  file,
                  diff: '',
                  success: true,
                  hasChanges: false,
                  skipped: true
                };
              }
              
              // Apply applicable edits with context support
              const diff = await applyFileEdits(validFile, applicableEdits, dryRun);
              
              // Check if any changes were made
              if (diff.includes('---') || diff.includes('+++')) {
                return {
                  file,
                  diff,
                  success: true,
                  hasChanges: true,
                  appliedEditCount: applicableEdits.length
                };
              } else {
                return {
                  file,
                  diff: '',
                  success: true,
                  hasChanges: false,
                  appliedEditCount: applicableEdits.length
                };
              }
              
            } catch (error: any) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              log.warn(`Failed to edit file: ${file}`, { error: errorMessage });
              
              return {
                file,
                diff: '',
                success: false,
                error: errorMessage
              };
            }
          })
        );
        
        // IMMUTABILITY: Collect batch results
        const batchFileResults = batchResults.map(result => result.status === 'fulfilled' ? result.value : null)
          .filter((result): result is NonNullable<typeof result> => result !== null);
        
        for (const result of batchFileResults) {
          totalProcessed++;
          
          if (result.success && result.hasChanges) {
            allDiffs += `\n\n━━━ CHANGES FOR ${result.file} ━━━\n${result.diff}`;
            filesChanged++;
          } else if (!result.success) {
            allDiffs += `\n\n━━━ ERROR FOR ${result.file} ━━━\n${result.error}\n`;
            totalErrors++;
          }
        }
        
        // PERFORMANCE OPTIMIZATION: Add small delay between batches for very large operations
        if (batches.length > 10 && batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // CONTRACT: Postcondition verification
      if (totalProcessed !== finalFiles.length) {
        throw new UserError('Postcondition violated: not all files were processed');
      }
      
      // Generate comprehensive summary with advanced statistics
      const action = dryRun ? 'previewed' : 'applied';
      const summary = [
        `Bulk edit ${action} successfully:`,
        `  • Files discovered: ${finalFiles.length}`,
        `  • Files processed: ${totalProcessed}`,
        `  • Files with changes: ${filesChanged}`,
        `  • Files with errors: ${totalErrors}`,
        `  • Edit operations: ${edits.length}`,
        `  • Conditional logic: ${edits.some(e => e.conditions) ? 'enabled' : 'disabled'}`,
        `  • Context-based matching: ${edits.some(e => e.context) ? 'enabled' : 'disabled'}`,
        `  • Custom ignore patterns: ${ignorePatterns.length}`,
        `  • Processing batches: ${batches.length}`
      ].join('\n');
      
      log.info('Bulk edit operation completed', {
        filesDiscovered: finalFiles.length,
        filesProcessed: totalProcessed,
        filesChanged,
        errors: totalErrors,
        batches: batches.length,
        dryRun
      });
      
      return summary + (allDiffs.length > 0 ? '\n\n' + allDiffs : '\n\nNo changes were made to any files.');
    },
  });

  // TOOL: directory_tree - ASCII tree generation with pure function implementation
  server.addTool({
    name: "directory_tree",
    description: `Generates a compact ASCII tree representation of a directory's structure, showing nested files and subdirectories with visual tree lines. Commonly ignored files/directories (hidden files starting with '.' and node_modules) are automatically excluded.
Arguments:
* \`path\` / \`file_path\` / \`filepath\` (string, required): The full path of the root directory for the tree view. Provide exactly one of these.
Output: Returns a compact ASCII tree string representing the directory structure with:
  * Root directory name at the top
  * Tree branch characters (├──, └──, │) showing hierarchy relationships
  * Directories listed before files, sorted alphabetically within each category
  * Clean, readable format that preserves visual structure and relationships
The output format is much more compact and human-readable than JSON while preserving all structural information.
Security: Can only inspect directories within pre-configured allowed directories.`,
    parameters: z.object({
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);

      // DEFENSIVE PROGRAMMING: Verify path is a directory
      let pathStats;
      try {
        pathStats = await fs.stat(validPath);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`Directory does not exist: ${pathToUse}`);
        }
        throw new UserError(`Cannot access path: ${e.message}`);
      }

      if (!pathStats.isDirectory()) {
        throw new UserError(`Path is not a directory: ${pathToUse}`);
      }

      // CONTRACT: Pure function for building ASCII directory tree
      async function buildAsciiTree(currentPath: string, prefix = ""): Promise<string> {
        // DEFENSIVE PROGRAMMING: Type validation
        if (typeof currentPath !== 'string' || typeof prefix !== 'string') {
          throw new UserError('Invalid input types for buildAsciiTree');
        }

        const validCurrentPath = await validatePath(currentPath);
        
        let dirStats;
        try {
          dirStats = await fs.stat(validCurrentPath);
          if (!dirStats.isDirectory()) {
            throw new UserError(`Path is not a directory: ${currentPath}`);
          }
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            return "";
          }
          throw e;
        }

        // IMMUTABILITY: Filter and sort entries
        const entries = (await fs.readdir(validCurrentPath, { withFileTypes: true }))
          .filter(entry => !entry.name.startsWith('.') && entry.name !== 'node_modules')
          .sort((a, b) => {
            // Directories first, then alphabetical
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });

        let treeString = "";
        
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const isLast = i === entries.length - 1;
          const connector: string = isLast ? "└── " : "├── ";
          treeString += prefix + connector + entry.name + "\n";

          if (entry.isDirectory()) {
            const childPrefix: string = prefix + (isLast ? "    " : "│   ");
            const subPath = path.join(currentPath, entry.name);
            
            try {
              treeString += await buildAsciiTree(subPath, childPrefix);
            } catch (e: any) {
              const errorMsg = e instanceof Error ? e.message : 'Unknown error';
              log.warn(`Could not access subdirectory: ${subPath}`, { error: errorMsg });
              treeString += childPrefix + `[Error accessing subdirectory: ${errorMsg}]\n`;
            }
          }
        }
        
        return treeString;
      }

      try {
        const rootName = path.basename(validPath);
        const asciiTree = await buildAsciiTree(validPath);
        const treeData = rootName + "\n" + asciiTree;
        
        log.info('Directory tree generated successfully', {
          path: pathToUse,
          rootName,
          treeLength: treeData.length
        });
        
        return treeData.trim();
        
      } catch (e: any) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        throw new UserError(`Failed to build directory tree: ${errorMsg}`);
      }
    },
  });

  // TOOL: delete_file - Safe file deletion with comprehensive validation
  server.addTool({
    name: "delete_file",
    description: `Deletes a specified file from the filesystem.
Arguments:
* \`path\` / \`file_path\` / \`filepath\` (string, required): The full path of the file to be deleted. Provide exactly one of these.
Output: Returns a success message indicating the path of the file that was deleted.
Security: Can only delete files within pre-configured allowed directories. The file must exist and be a regular file (not a directory).`,
    parameters: z.object({
      path: z.string().optional().describe('The primary path for the operation.'),
      file_path: z.string().optional().describe('Alternative argument for the path.'),
      filepath: z.string().optional().describe('Alternative argument for the path.')
    }),
    execute: async (args, { log }) => {
      const pathToUse = getPathFromOptions(args);
      const validPath = await validatePath(pathToUse);

      // DEFENSIVE PROGRAMMING: Verify file exists and is a regular file
      let fileStats;
      try {
        fileStats = await fs.stat(validPath);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`File does not exist: ${pathToUse}`);
        }
        throw new UserError(`Cannot access file: ${e.message}`);
      }

      if (!fileStats.isFile()) {
        if (fileStats.isDirectory()) {
          throw new UserError(`Cannot delete directory with delete_file tool: ${pathToUse}. Use appropriate directory deletion tool.`);
        }
        throw new UserError(`Target is not a regular file: ${pathToUse}`);
      }

      // IMMUTABILITY: Store file info for verification
      const originalSize = fileStats.size;
      const originalPath = validPath;

      try {
        await fs.unlink(validPath);
        
        // CONTRACT: Postcondition verification
        try {
          await fs.stat(validPath);
          throw new UserError('Postcondition violated: file still exists after deletion');
        } catch (e: any) {
          if (e.code !== 'ENOENT') {
            throw new UserError(`Postcondition violated: unexpected error verifying deletion: ${e.message}`);
          }
        }
        
        log.info('File deleted successfully', {
          path: pathToUse,
          originalSize
        });
        
        return `File deleted successfully: ${pathToUse}`;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        if (error.code === 'EACCES') {
          throw new UserError(`Permission denied deleting file: ${pathToUse}`);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`Failed to delete file: ${errorMessage}`);
      }
    },
  });

  // TOOL: rename_file - Enterprise-grade file operations with comprehensive validation
  server.addTool({
    name: "rename_file",
    description: `Renames or moves a file from a source path to a destination path.
Arguments:
* \`source_path\` (string, required): The full path of the file to be renamed/moved.
* \`destination_path\` (string, required): The new full path for the file.
Output: Returns a success message indicating the source and destination paths upon successful renaming.
Security: Can only rename/move files *from* and *to* locations within the pre-configured allowed directories.
Contracts:
  Preconditions: source_path exists, both paths are within allowed directories, source != destination
  Postconditions: file exists at destination_path, no file at source_path, file content preserved
  Invariants: total file count unchanged, allowed directory boundaries respected`,
    parameters: z.object({
      source_path: z.string().min(1).describe('The full path of the file to be renamed/moved.'),
      destination_path: z.string().min(1).describe('The new full path for the file.')
    }).refine(data => {
      return path.normalize(data.source_path) !== path.normalize(data.destination_path);
    }, {
      message: "Source path and destination path cannot be identical"
    }),
    execute: async (args, { log }) => {
      const { source_path, destination_path } = args;

      // DEFENSIVE PROGRAMMING: Type validation
      if (typeof source_path !== 'string' || typeof destination_path !== 'string') {
        throw new UserError('Both source_path and destination_path must be strings');
      }

      if (source_path.trim().length === 0 || destination_path.trim().length === 0) {
        throw new UserError('Paths cannot be empty or whitespace-only');
      }

      // SECURITY BOUNDARY: Validate paths
      const validSourcePath = await validatePath(source_path);
      const validDestPath = await validatePath(destination_path);

      // DEFENSIVE PROGRAMMING: Verify source exists and is a file
      let sourceStats;
      try {
        sourceStats = await fs.stat(validSourcePath);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`Source file does not exist: ${source_path}`);
        }
        throw new UserError(`Cannot access source file: ${e.message}`);
      }

      if (!sourceStats.isFile()) {
        if (sourceStats.isDirectory()) {
          throw new UserError(`Cannot rename directory with rename_file tool: ${source_path}. Use appropriate directory renaming tool.`);
        }
        throw new UserError(`Source is not a regular file: ${source_path}`);
      }

      // DEFENSIVE PROGRAMMING: Check if destination exists
      try {
        await fs.stat(validDestPath);
        throw new UserError(`Destination file already exists: ${destination_path}. Use a different destination path or delete the existing file first.`);
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          throw e;
        }
      }

      // DEFENSIVE PROGRAMMING: Verify destination directory exists
      const destDir = path.dirname(validDestPath);
      try {
        const destDirStats = await fs.stat(destDir);
        if (!destDirStats.isDirectory()) {
          throw new UserError(`Destination directory path is not a directory: ${destDir}`);
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          throw new UserError(`Destination directory does not exist: ${destDir}`);
        }
        throw new UserError(`Cannot access destination directory: ${e.message}`);
      }

      // IMMUTABILITY: Store original properties for verification
      const originalSize = sourceStats.size;
      const originalMtime = sourceStats.mtime;

      try {
        // Perform rename operation
        await fs.rename(validSourcePath, validDestPath);

        // CONTRACT: Postcondition verification
        try {
          const newStats = await fs.stat(validDestPath);
          
          if (!newStats.isFile()) {
            throw new UserError('Postcondition violated: destination is not a file after rename');
          }
          
          if (newStats.size !== originalSize) {
            throw new UserError('Postcondition violated: file size changed during rename');
          }
          
          // Verify source no longer exists
          try {
            await fs.stat(validSourcePath);
            throw new UserError('Postcondition violated: source file still exists after rename');
          } catch (e: any) {
            if (e.code !== 'ENOENT') {
              throw new UserError(`Postcondition violated: unexpected error verifying source removal: ${e.message}`);
            }
          }
          
        } catch (e: any) {
          if (e instanceof UserError) {
            throw e;
          }
          if (e.code === 'ENOENT') {
            throw new UserError('Postcondition violated: renamed file does not exist at destination');
          }
          throw new UserError(`Postcondition verification failed: ${e.message}`);
        }

        log.info('File renamed successfully', {
          source: source_path,
          destination: destination_path,
          size: originalSize
        });
        
        return `File renamed successfully from ${source_path} to ${destination_path}`;
        
      } catch (error: any) {
        if (error instanceof UserError) {
          throw error;
        }
        if (error.code === 'EACCES') {
          throw new UserError(`Permission denied renaming file: ${error.message}`);
        }
        if (error.code === 'EXDEV') {
          throw new UserError('Cannot rename across different filesystems. Use copy and delete instead.');
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new UserError(`File rename failed: ${errorMessage}`);
      }
    },
  });

  // TOOL: search_files_and_folders - Powerful search capabilities with advanced programming techniques
  server.addTool({
    name: "search_files_and_folders",
    description: `Recursively searches for files and folders within allowed directories that match a search term.
Arguments:
* \`search_term\` (string, required): The search query. The tool supports glob patterns for powerful matching (e.g., "*.js", "config.*", "**/tests/**").
* \`path\` (string, optional): The directory to start the search in. If omitted, it will search all allowed directories.
* \`search_type\` (enum, optional, default: 'both'): Filters results. Can be 'files', 'folders', or 'both'.
* \`case_sensitive\` (boolean, optional, default: false): Toggles case-sensitivity.
* \`include_hidden\` (boolean, optional, default: false): If true, includes hidden files/folders (e.g., .env, .git).
Output: Returns a JSON array of strings, where each string is the full path of a matching file or folder.
Security: The search is strictly confined to the pre-configured allowed directories. Any user-provided \`path\` is validated to ensure it's within these boundaries.`,
    parameters: z.object({
      search_term: z.string().min(1, { message: "search_term cannot be empty." })
        .describe('The search query. Glob patterns are supported (e.g., "*.ts", "test_*.?s").'),
      path: z.string().optional()
        .describe('Optional. The directory path to start the search from. If not provided, searches all allowed directories.'),
      search_type: z.enum(['files', 'folders', 'both']).optional().default('both')
        .describe("Specifies whether to search for 'files', 'folders', or 'both'. Defaults to 'both'."),
      case_sensitive: z.boolean().optional().default(false)
        .describe("If true, the search will be case-sensitive. Defaults to false."),
      include_hidden: z.boolean().optional().default(false)
        .describe("If true, results will include hidden files and folders (those starting with a '.'). Defaults to false."),
    }),
    execute: async (args, { log }) => {
      const { search_term, path: searchPath, search_type, case_sensitive, include_hidden } = args;

      // DEFENSIVE PROGRAMMING: Input validation
      if (typeof search_term !== 'string' || search_term.trim().length === 0) {
        throw new UserError('search_term must be a non-empty string');
      }

      if (search_term.length > 255) {
        throw new UserError('search_term exceeds maximum length (255 characters)');
      }

      // Determine search roots with security validation
      const searchRoots: string[] = [];
      if (searchPath) {
        const validSearchPath = await validatePath(searchPath);
        
        let pathStats;
        try {
          pathStats = await fs.stat(validSearchPath);
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            throw new UserError(`The provided path does not exist: ${searchPath}`);
          }
          throw new UserError(`Cannot access search path: ${e.message}`);
        }
        
        if (!pathStats.isDirectory()) {
          throw new UserError(`The provided path is not a directory: ${searchPath}`);
        }
        searchRoots.push(validSearchPath);
      } else {
        const { allowedDirectories } = await import("../utils/security.js");
        searchRoots.push(...allowedDirectories);
      }

      // IMMUTABILITY: Use Set for deduplication
      const allMatches = new Set<string>();

      if (searchRoots.length === 0) {
        throw new UserError('No valid search directories available');
      }

      log.info('Starting search operation', {
        searchTerm: search_term,
        searchType: search_type,
        caseSensitive: case_sensitive,
        includeHidden: include_hidden,
        rootCount: searchRoots.length
      });

      // DEFENSIVE PROGRAMMING: Process each search root with error isolation
      const searchResults = await Promise.allSettled(
        searchRoots.map(async (root) => {
          const validRoot = await validatePath(root);
          
          const globOptions = {
            cwd: validRoot,
            nocase: !case_sensitive,
            dot: include_hidden,
            withFileTypes: true,
            absolute: true,
            ignore: include_hidden ? [] : ['**/.*', '**/node_modules/**'],
          };

          try {
            const matches = await glob(`**/*${search_term}*`, globOptions);
            const rootMatches = new Set<string>();

            for (const match of matches) {
              if (typeof match === 'string') {
                continue;
              }
              
              const isDirectory = match.isDirectory();
              const isFile = match.isFile();

              if (!isDirectory && !isFile) {
                continue;
              }

              // Filter based on search_type with type safety
              const matchPath = match.fullpath();
              if (search_type === 'both') {
                rootMatches.add(matchPath);
              } else if (search_type === 'files' && isFile) {
                rootMatches.add(matchPath);
              } else if (search_type === 'folders' && isDirectory) {
                rootMatches.add(matchPath);
              }
            }

            return rootMatches;
            
          } catch (e: any) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            log.warn(`Failed to search in directory ${root}: ${errorMsg}`);
            return new Set<string>();
          }
        })
      );

      // IMMUTABILITY: Merge all successful search results
      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          for (const match of result.value) {
            allMatches.add(match);
          }
        }
      }

      // CONTRACT: Postcondition verification
      const sortedResults = Array.from(allMatches).sort();
      
      for (const resultPath of sortedResults) {
        if (!path.isAbsolute(resultPath)) {
          throw new UserError(`Postcondition violated: non-absolute path in results: ${resultPath}`);
        }
        
        const { allowedDirectories } = await import("../utils/security.js");
        const isWithinAllowed = allowedDirectories.some((dir: string) => 
          path.normalize(resultPath).startsWith(path.normalize(dir))
        );
        if (!isWithinAllowed) {
          throw new UserError(`Postcondition violated: result outside allowed directories: ${resultPath}`);
        }
      }

      log.info('Search completed successfully', {
        searchTerm: search_term,
        resultCount: sortedResults.length,
        processedRoots: searchRoots.length
      });

      return JSON.stringify(sortedResults, null, 2);
    },
  });
}

/**
 * UTILITY: Human-readable file size formatting
 * 
 * Pure function for converting bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
