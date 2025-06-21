// src/__tests__/utils/path-helpers.test.ts

import { getPathFromOptions, PathArgumentSchema, validatePathOptions } from '../../utils/path-helpers';
import { UserError } from 'fastmcp';

describe('getPathFromOptions', () => {
  // Test the "happy paths" - valid single path arguments
  it('should return the path when "path" is provided', () => {
    expect(getPathFromOptions({ path: '/test/path' })).toBe('/test/path');
  });

  it('should return the path when "file_path" is provided', () => {
    expect(getPathFromOptions({ file_path: '/test/file_path' })).toBe('/test/file_path');
  });

  it('should return the path when "filepath" is provided', () => {
    expect(getPathFromOptions({ filepath: '/test/filepath' })).toBe('/test/filepath');
  });

  // Test the failure conditions - Design by Contract validation
  it('should throw a UserError if no path argument is provided', () => {
    expect(() => getPathFromOptions({})).toThrow(UserError);
    expect(() => getPathFromOptions({})).toThrow("Exactly one of 'path', 'file_path', or 'filepath' must be provided.");
  });

  it('should throw a UserError if multiple path arguments are provided', () => {
    const args = { path: '/a', file_path: '/b' };
    expect(() => getPathFromOptions(args)).toThrow(UserError);
    expect(() => getPathFromOptions(args)).toThrow("Only one of 'path', 'file_path', or 'filepath' can be provided at a time.");
  });

  it('should throw a UserError if all three path arguments are provided', () => {
    const args = { path: '/a', file_path: '/b', filepath: '/c' };
    expect(() => getPathFromOptions(args)).toThrow(UserError);
    expect(() => getPathFromOptions(args)).toThrow("Only one of 'path', 'file_path', or 'filepath' can be provided at a time.");
  });

  // Test defensive programming - empty/whitespace validation
  it('should throw a UserError if the path is an empty string', () => {
    expect(() => getPathFromOptions({ path: '' })).toThrow(UserError);
    expect(() => getPathFromOptions({ path: '' })).toThrow("Path cannot be empty or whitespace-only.");
  });

  it('should throw a UserError if the path is whitespace-only', () => {
    expect(() => getPathFromOptions({ path: '  ' })).toThrow(UserError);
    expect(() => getPathFromOptions({ path: '  ' })).toThrow("Path cannot be empty or whitespace-only.");
  });

  it('should throw a UserError if the path is just tabs and spaces', () => {
    expect(() => getPathFromOptions({ path: '\t\n  ' })).toThrow(UserError);
    expect(() => getPathFromOptions({ path: '\t\n  ' })).toThrow("Path cannot be empty or whitespace-only.");
  });

  // Test input validation - defensive programming
  it('should throw a UserError if data is null', () => {
    expect(() => getPathFromOptions(null as any)).toThrow(UserError);
    expect(() => getPathFromOptions(null as any)).toThrow("Path options data must be a valid object.");
  });

  it('should throw a UserError if data is undefined', () => {
    expect(() => getPathFromOptions(undefined as any)).toThrow(UserError);
    expect(() => getPathFromOptions(undefined as any)).toThrow("Path options data must be a valid object.");
  });

  it('should throw a UserError if data is not an object', () => {
    expect(() => getPathFromOptions('not an object' as any)).toThrow(UserError);
    expect(() => getPathFromOptions('not an object' as any)).toThrow("Path options data must be a valid object.");
  });

  // Test type validation - defensive programming
  it('should throw a UserError if path is not a string', () => {
    expect(() => getPathFromOptions({ path: 123 as any })).toThrow(UserError);
    expect(() => getPathFromOptions({ path: 123 as any })).toThrow("Path must be a string value.");
  });

  it('should throw a UserError if file_path is not a string', () => {
    expect(() => getPathFromOptions({ file_path: true as any })).toThrow(UserError);
    expect(() => getPathFromOptions({ file_path: true as any })).toThrow("Path must be a string value.");
  });

  it('should throw a UserError if filepath is not a string', () => {
    expect(() => getPathFromOptions({ filepath: [] as any })).toThrow(UserError);
    expect(() => getPathFromOptions({ filepath: [] as any })).toThrow("Path must be a string value.");
  });

  // Test edge cases with valid paths
  it('should handle paths with special characters', () => {
    const specialPath = '/test/path with spaces/file-name_123.txt';
    expect(getPathFromOptions({ path: specialPath })).toBe(specialPath);
  });

  it('should handle relative paths', () => {
    const relativePath = './relative/path';
    expect(getPathFromOptions({ path: relativePath })).toBe(relativePath);
  });

  it('should handle paths with forward slashes', () => {
    const forwardSlashPath = '/usr/local/bin';
    expect(getPathFromOptions({ path: forwardSlashPath })).toBe(forwardSlashPath);
  });

  it('should handle Windows-style paths', () => {
    const windowsPath = 'C:\\Users\\test\\file.txt';
    expect(getPathFromOptions({ path: windowsPath })).toBe(windowsPath);
  });
});

describe('validatePathOptions', () => {
  // Test successful validation with type branding
  it('should return validated path for valid path argument', () => {
    const result = validatePathOptions({ path: '/valid/path' });
    expect(result).toBe('/valid/path');
    // The result should be branded as ValidatedPath, but runtime check is the same
  });

  it('should return validated path for valid file_path argument', () => {
    const result = validatePathOptions({ file_path: '/valid/file_path' });
    expect(result).toBe('/valid/file_path');
  });

  it('should return validated path for valid filepath argument', () => {
    const result = validatePathOptions({ filepath: '/valid/filepath' });
    expect(result).toBe('/valid/filepath');
  });

  // Test defensive programming - null character validation
  it('should throw a UserError if path contains null characters', () => {
    expect(() => validatePathOptions({ path: '/test/file\0.txt' })).toThrow(UserError);
    expect(() => validatePathOptions({ path: '/test/file\0.txt' })).toThrow("Path cannot contain null characters.");
  });

  // Test defensive programming - path length validation
  it('should throw a UserError if path exceeds maximum length', () => {
    const longPath = '/test/' + 'a'.repeat(5000); // Exceeds 4096 limit
    expect(() => validatePathOptions({ path: longPath })).toThrow(UserError);
    expect(() => validatePathOptions({ path: longPath })).toThrow("Path exceeds maximum allowed length (4096 characters).");
  });

  it('should accept path at maximum length boundary', () => {
    const maxPath = '/test/' + 'a'.repeat(4090); // Just under 4096 limit
    expect(() => validatePathOptions({ path: maxPath })).not.toThrow();
  });

  // Test that underlying getPathFromOptions validation is preserved
  it('should throw error for empty path through getPathFromOptions', () => {
    expect(() => validatePathOptions({ path: '' })).toThrow(UserError);
    expect(() => validatePathOptions({ path: '' })).toThrow("Path cannot be empty or whitespace-only.");
  });

  it('should throw error for multiple paths through getPathFromOptions', () => {
    expect(() => validatePathOptions({ path: '/a', file_path: '/b' })).toThrow(UserError);
    expect(() => validatePathOptions({ path: '/a', file_path: '/b' })).toThrow("Only one of 'path', 'file_path', or 'filepath' can be provided at a time.");
  });

  // Test defensive programming edge cases
  it('should handle path with embedded newlines in null character check', () => {
    const pathWithNewlines = '/test/path\nwith\nnewlines';
    expect(() => validatePathOptions({ path: pathWithNewlines })).not.toThrow();
  });

  it('should handle Unicode characters in path', () => {
    const unicodePath = '/test/файл/café/测试.txt';
    expect(() => validatePathOptions({ path: unicodePath })).not.toThrow();
  });
});

describe('PathArgumentSchema', () => {
  // Test Zod schema validation
  it('should accept valid path argument', () => {
    const result = PathArgumentSchema.safeParse({ path: '/test/path' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe('/test/path');
    }
  });

  it('should accept valid file_path argument', () => {
    const result = PathArgumentSchema.safeParse({ file_path: '/test/file_path' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.file_path).toBe('/test/file_path');
    }
  });

  it('should accept valid filepath argument', () => {
    const result = PathArgumentSchema.safeParse({ filepath: '/test/filepath' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filepath).toBe('/test/filepath');
    }
  });

  it('should accept empty object (all optional)', () => {
    const result = PathArgumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept object with all three optional paths', () => {
    const result = PathArgumentSchema.safeParse({
      path: '/a',
      file_path: '/b',
      filepath: '/c'
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-string path values', () => {
    const result = PathArgumentSchema.safeParse({ path: 123 });
    expect(result.success).toBe(false);
  });

  it('should reject non-string file_path values', () => {
    const result = PathArgumentSchema.safeParse({ file_path: true });
    expect(result.success).toBe(false);
  });

  it('should reject non-string filepath values', () => {
    const result = PathArgumentSchema.safeParse({ filepath: [] });
    expect(result.success).toBe(false);
  });

  it('should reject additional properties not in schema', () => {
    const result = PathArgumentSchema.strict().safeParse({
      path: '/test',
      invalidProp: 'value'
    });
    expect(result.success).toBe(false);
  });
});

describe('PathArgumentSchema integration with getPathFromOptions', () => {
  // Test that schema validation and function validation work together
  it('should work together for valid single path', () => {
    const input = { path: '/test/integration' };
    const parseResult = PathArgumentSchema.safeParse(input);
    expect(parseResult.success).toBe(true);
    
    if (parseResult.success) {
      const extractedPath = getPathFromOptions(parseResult.data);
      expect(extractedPath).toBe('/test/integration');
    }
  });

  it('should handle schema-valid but function-invalid empty path', () => {
    const input = { path: '' };
    const parseResult = PathArgumentSchema.safeParse(input);
    expect(parseResult.success).toBe(true); // Schema allows empty string
    
    if (parseResult.success) {
      // But getPathFromOptions should reject it
      expect(() => getPathFromOptions(parseResult.data)).toThrow(UserError);
      expect(() => getPathFromOptions(parseResult.data)).toThrow("Path cannot be empty or whitespace-only.");
    }
  });

  it('should handle schema-valid but function-invalid multiple paths', () => {
    const input = { path: '/a', file_path: '/b' };
    const parseResult = PathArgumentSchema.safeParse(input);
    expect(parseResult.success).toBe(true); // Schema allows multiple optional fields
    
    if (parseResult.success) {
      // But getPathFromOptions should reject multiple paths
      expect(() => getPathFromOptions(parseResult.data)).toThrow(UserError);
      expect(() => getPathFromOptions(parseResult.data)).toThrow("Only one of 'path', 'file_path', or 'filepath' can be provided at a time.");
    }
  });
});
