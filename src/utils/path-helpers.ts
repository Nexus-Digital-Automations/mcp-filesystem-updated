// src/utils/path-helpers.ts
import { z } from "zod";
import { UserError } from "fastmcp";

/**
 * CONTRACT: Shared Zod schema for path arguments
 * 
 * Preconditions:
 * - Schema accepts optional string fields for path variants
 * - Business logic validation handled separately in getPathFromOptions
 * 
 * Postconditions:
 * - Returns valid schema object for FastMCP tool usage
 * - Allows schema-level validation to pass, function-level validation handles business rules
 * 
 * Invariants:
 * - Schema structure remains consistent across all tools
 * - Validation behavior is deterministic and repeatable
 */
export const PathArgumentSchema = z.object({
  path: z.string().optional().describe('The primary path for the operation.'),
  file_path: z.string().optional().describe('Alternative argument for the path.'),
  filepath: z.string().optional().describe('Alternative argument for the path.')
});

/**
 * CONTRACT: Path extraction function with comprehensive validation
 * 
 * Preconditions:
 * - data must conform to PathArgumentSchema
 * - data cannot be null or undefined
 * 
 * Postconditions:
 * - Returns exactly one valid path string
 * - Throws UserError if validation fails
 * - Never returns undefined or empty string
 * 
 * Invariants:
 * - Exactly one path property must be defined
 * - Path extraction logic is deterministic
 * - Error messages are user-friendly and descriptive
 */
export function getPathFromOptions(data: z.infer<typeof PathArgumentSchema>): string {
  // DEFENSIVE PROGRAMMING: Input validation
  if (!data || typeof data !== 'object') {
    throw new UserError("Path options data must be a valid object.");
  }

  // DEFENSIVE PROGRAMMING: Count provided paths (including empty strings)
  const providedPaths = [data.path, data.file_path, data.filepath].filter(p => p !== undefined);
  const providedCount = providedPaths.length;
  
  // CONTRACT: Exactly one path must be provided
  if (providedCount === 0) {
    throw new UserError("Exactly one of 'path', 'file_path', or 'filepath' must be provided.");
  }
  
  if (providedCount > 1) {
    throw new UserError("Only one of 'path', 'file_path', or 'filepath' can be provided at a time.");
  }

  // DEFENSIVE PROGRAMMING: Extract the actual path
  const actualPath = data.path ?? data.file_path ?? data.filepath;
  
  // CONTRACT: Postcondition verification
  if (actualPath === undefined) {
    throw new UserError("Path could not be determined from provided options.");
  }
  
  // DEFENSIVE PROGRAMMING: Type validation
  if (typeof actualPath !== 'string') {
    throw new UserError("Path must be a string value.");
  }
  
  // DEFENSIVE PROGRAMMING: Empty string validation
  if (actualPath.trim().length === 0) {
    throw new UserError("Path cannot be empty or whitespace-only.");
  }
  
  return actualPath;
}

/**
 * CONTRACT: Type-safe path validation utilities
 * 
 * These utility functions provide type-driven development support
 * for path operations with comprehensive input validation.
 */
export type ValidatedPath = string & { readonly __validatedPath: unique symbol };
export type PathOptions = z.infer<typeof PathArgumentSchema>;

/**
 * CONTRACT: Enhanced path validation with type branding
 * 
 * Preconditions:
 * - pathOptions must be valid PathArgumentSchema object
 * 
 * Postconditions:
 * - Returns branded ValidatedPath type
 * - Path is guaranteed to be non-empty string
 * 
 * Invariants:
 * - Type safety maintained through branded types
 * - Consistent validation across all path operations
 */
export function validatePathOptions(pathOptions: PathOptions): ValidatedPath {
  const path = getPathFromOptions(pathOptions);
  
  // DEFENSIVE PROGRAMMING: Additional path validation
  if (path.includes('\0')) {
    throw new UserError("Path cannot contain null characters.");
  }
  
  if (path.length > 4096) {
    throw new UserError("Path exceeds maximum allowed length (4096 characters).");
  }
  
  return path as ValidatedPath;
}
