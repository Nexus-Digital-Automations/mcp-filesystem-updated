// src/utils/security.ts
import * as fs from "fs/promises";
import * as path from "path";
import * as os from 'os';
import { UserError } from "fastmcp";

/**
 * CONTRACT: Path normalization function with defensive programming
 * 
 * Preconditions:
 * - p must be a valid string path
 * 
 * Postconditions:
 * - Returns normalized path string
 * - Handles cross-platform path separators
 * - Resolves relative path components
 * 
 * Invariants:
 * - Normalization is idempotent
 * - Cross-platform compatibility maintained
 */
function normalizePath(p: string): string {
  // DEFENSIVE PROGRAMMING: Input validation
  if (typeof p !== 'string') {
    throw new UserError("Path must be a string");
  }
  
  if (p.trim().length === 0) {
    throw new UserError("Path cannot be empty");
  }
  
  return path.normalize(p);
}

/**
 * CONTRACT: Home directory expansion with security validation
 * 
 * Preconditions:
 * - filepath must be a valid string
 * 
 * Postconditions:
 * - Expands ~ and ~/ to full home directory path
 * - Returns absolute path when home expansion applied
 * - Original path returned if no expansion needed
 * 
 * Invariants:
 * - Home directory expansion is deterministic
 * - Security boundaries respected during expansion
 */
function expandHome(filepath: string): string {
  // DEFENSIVE PROGRAMMING: Input validation
  if (typeof filepath !== 'string') {
    throw new UserError("Filepath must be a string");
  }
  
  if (filepath.startsWith('~/') || filepath === '~') {
    const homeDir = os.homedir();
    if (!homeDir) {
      throw new UserError("Unable to determine home directory");
    }
    return path.join(homeDir, filepath.slice(1));
  }
  
  return filepath;
}

/**
 * DEFENSIVE PROGRAMMING: Command line argument processing with validation
 */
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: mcp-server-filesystem <allowed-directory> [additional-directories...]");
  process.exit(1);
}

/**
 * CONTRACT: Allowed directories configuration with immutability
 * 
 * Preconditions:
 * - Command line args must contain at least one directory
 * - All directories must exist and be accessible
 * 
 * Postconditions:
 * - Returns immutable array of normalized, absolute paths
 * - All paths are validated and accessible
 * 
 * Invariants:
 * - Directory list remains constant during server lifetime
 * - All paths are absolute and normalized
 * - Security boundaries are well-defined
 */
export const allowedDirectories = args.map(dir => {
  const expanded = expandHome(dir);
  const resolved = path.resolve(expanded);
  return normalizePath(resolved);
});

/**
 * DEFENSIVE PROGRAMMING: Initial directory validation at startup
 */
(async () => {
  for (const dir of allowedDirectories) {
    try {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) {
        console.error(`Error: The specified allowed path "${dir}" is not a directory.`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error accessing allowed directory "${dir}": ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }
})();

/**
 * CONTRACT: Core security validation function with triple-layer protection
 * 
 * Preconditions:
 * - requestedPath must be a non-empty string
 * - allowedDirectories must be initialized and validated
 * 
 * Postconditions:
 * - Returns validated absolute path within allowed directories
 * - Resolves symlinks to their real targets
 * - Validates parent directories for non-existent files
 * 
 * Invariants:
 * - Security boundaries are never compromised
 * - Directory traversal attacks are prevented
 * - Symlink targets remain within allowed boundaries
 * 
 * Security Layers:
 * 1. Input validation and sanitization
 * 2. Path resolution and normalization  
 * 3. Boundary checking against allowed directories
 * 4. Symlink resolution and re-validation
 * 5. Parent directory validation for new files
 */
export async function validatePath(requestedPath: string): Promise<string> {
  // DEFENSIVE PROGRAMMING: Layer 1 - Input validation
  if (typeof requestedPath !== 'string' || requestedPath.trim().length === 0) {
    throw new UserError("Path must be a non-empty string.");
  }
  
  if (requestedPath.includes('\0')) {
    throw new UserError("Path cannot contain null characters.");
  }
  
  if (requestedPath.length > 4096) {
    throw new UserError("Path exceeds maximum allowed length (4096 characters).");
  }

  // DEFENSIVE PROGRAMMING: Layer 2 - Path resolution
  let expandedPath: string;
  let absolutePath: string;
  let normalizedPath: string;
  
  try {
    expandedPath = expandHome(requestedPath);
    absolutePath = path.isAbsolute(expandedPath)
      ? path.resolve(expandedPath)
      : path.resolve(process.cwd(), expandedPath);
    normalizedPath = normalizePath(absolutePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown path resolution error';
    throw new UserError(`Path resolution failed: ${errorMessage}`);
  }

  // SECURITY BOUNDARY: Early boundary check before any filesystem operations
  const isPathWithinBoundaries = allowedDirectories.some(dir => {
    const normalizedDir = normalizePath(dir);
    return normalizedPath.startsWith(normalizedDir + path.sep) || normalizedPath === normalizedDir;
  });

  if (!isPathWithinBoundaries) {
    throw new UserError(
      `Access denied - path outside allowed directories: ${absolutePath} not in [${allowedDirectories.join(', ')}]`
    );
  }

  // SECURITY BOUNDARY: Layer 3 & 4 - Try symlink resolution for existing files
  try {
    const realPath = await fs.realpath(absolutePath);
    const normalizedReal = normalizePath(realPath);
    
    // Double-check that symlink target is still within allowed directories
    const isRealPathAllowed = allowedDirectories.some(dir => {
      const normalizedDir = normalizePath(dir);
      return normalizedReal.startsWith(normalizedDir + path.sep) || normalizedReal === normalizedDir;
    });
    
    if (!isRealPathAllowed) {
      throw new UserError("Access denied - symlink target outside allowed directories");
    }
    
    // CONTRACT: Postcondition verification
    if (!path.isAbsolute(realPath)) {
      throw new UserError("Security violation: resolved path is not absolute");
    }
    
    return realPath;
    
  } catch (error: any) {
    // SECURITY BOUNDARY: Layer 5 - Handle file creation (ENOENT case)
    if (error.code === 'ENOENT') {
      const parentDir = path.dirname(absolutePath);
      
      try {
        const realParentPath = await fs.realpath(parentDir);
        const normalizedParent = normalizePath(realParentPath);
        
        const isParentAllowed = allowedDirectories.some(dir => {
          const normalizedDir = normalizePath(dir);
          return normalizedParent.startsWith(normalizedDir + path.sep) || normalizedParent === normalizedDir;
        });
        
        if (!isParentAllowed) {
          throw new UserError("Access denied - parent directory outside allowed directories");
        }
        
        // CONTRACT: Postcondition verification for new file paths
        if (!path.isAbsolute(absolutePath)) {
          throw new UserError("Security violation: new file path is not absolute");
        }
        
        return absolutePath;
        
      } catch (parentError: any) {
        if (parentError.code === 'ENOENT') {
          throw new UserError(`Parent directory does not exist: ${parentDir}`);
        }
        throw new UserError(`Parent directory validation failed: ${parentError.message}`);
      }
    }
    
    // Re-throw UserError instances without modification
    if (error instanceof UserError) {
      throw error;
    }
    
    // For other filesystem errors, propagate them as validation failures
    // since they indicate real issues accessing the file
    const errorMessage = error instanceof Error ? error.message : 'Unknown filesystem error';
    throw new UserError(`Path validation failed: ${errorMessage}`);
  }
}

/**
 * CONTRACT: Security boundary checker for batch operations
 * 
 * Preconditions:
 * - paths must be array of strings
 * - Each path must be valid according to validatePath
 * 
 * Postconditions:
 * - Returns array of validated paths
 * - All paths guaranteed to be within security boundaries
 * - Maintains original array order
 * 
 * Invariants:
 * - Batch validation is atomic (all succeed or all fail)
 * - Individual path validation contracts maintained
 */
export async function validatePaths(paths: string[]): Promise<string[]> {
  // DEFENSIVE PROGRAMMING: Input validation
  if (!Array.isArray(paths)) {
    throw new UserError("Paths must be provided as an array");
  }
  
  if (paths.length === 0) {
    throw new UserError("At least one path must be provided");
  }
  
  if (paths.length > 100) {
    throw new UserError("Too many paths provided (maximum 100 allowed)");
  }
  
  // IMMUTABILITY: Use map to create new array with validated paths
  try {
    const validatedPaths = await Promise.all(
      paths.map(async (path, index) => {
        if (typeof path !== 'string') {
          throw new UserError(`Path at index ${index} must be a string`);
        }
        return await validatePath(path);
      })
    );
    
    // CONTRACT: Postcondition verification
    if (validatedPaths.length !== paths.length) {
      throw new UserError("Path validation postcondition failed: array length mismatch");
    }
    
    return validatedPaths;
    
  } catch (error) {
    // Provide context for batch validation failures
    if (error instanceof UserError) {
      throw new UserError(`Batch path validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * CONTRACT: Security context information for debugging and logging
 * 
 * Returns immutable security configuration details for operational visibility
 */
export function getSecurityContext(): Readonly<{
  allowedDirectories: readonly string[];
  totalAllowedDirectories: number;
  securityEnabled: boolean;
}> {
  return Object.freeze({
    allowedDirectories: Object.freeze([...allowedDirectories]),
    totalAllowedDirectories: allowedDirectories.length,
    securityEnabled: allowedDirectories.length > 0,
  });
}
