#!/usr/bin/env node

/**
 * Enhanced Bulk Edit Tool Demonstration Script
 * 
 * This script demonstrates the enhanced bulk_edit tool with:
 * - 100,000 file capacity
 * - Advanced conditional logic (AND/OR/NOT)
 * - Custom ignore patterns
 * - Intelligent file discovery
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directory setup
const TEST_DIR = path.join(__dirname, 'enhanced-bulk-edit-test');

async function createEnterpriseTestStructure() {
  console.log('🏗️  Creating enterprise test structure...');
  
  // Ensure test directory exists
  await fs.mkdir(TEST_DIR, { recursive: true });
  
  // Create multiple project directories
  const projects = ['api-client', 'utils-helpers', 'legacy-code', 'tests-specs'];
  
  for (const project of projects) {
    const projectDir = path.join(TEST_DIR, project);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create subdirectories
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'components'), { recursive: true });
    
    // Create sample files
    const sampleCode = `// ${project} implementation
export function ${project.replace('-', '_')}_function() {
  // This is deprecated_api usage
  return legacy_function();
}

export class ${project.replace('-', '_')}_Component {
  oldMethod() {
    // This should be updated
    return deprecated_api();
  }
}`;

    await fs.writeFile(path.join(projectDir, 'src', 'main.ts'), sampleCode);
    await fs.writeFile(path.join(projectDir, 'components', 'Widget.tsx'), sampleCode);
  }
  
  // Create directories that should be ignored
  await fs.mkdir(path.join(TEST_DIR, 'node_modules'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, '.git'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'dist'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'legacy'), { recursive: true });
  
  // Create files in ignored directories
  await fs.writeFile(
    path.join(TEST_DIR, 'node_modules', 'package.js'), 
    'module.exports = { deprecated_api: true };'
  );
  
  await fs.writeFile(
    path.join(TEST_DIR, 'legacy', 'old.js'), 
    'function deprecated_api() { return "should not be changed"; }'
  );
  
  console.log('✅ Enterprise test structure created successfully');
}

async function demonstrateEnhancedBulkEdit() {
  console.log('\n🚀 Demonstrating Enhanced Bulk Edit Features...');
  
  // Example 1: Basic bulk replace with ignore patterns
  console.log('\n📝 Example 1: Basic bulk replace with custom ignore patterns');
  const basicEnhancedEdit = {
    targets: [path.join(TEST_DIR, '**/*')],
    edits: [
      {
        oldText: 'deprecated_api',
        newText: 'modern_api'
      }
    ],
    ignorePatterns: [
      '**/node_modules/**',
      '**/legacy/**',
      '**/.git/**'
    ],
    dryRun: true
  };
  
  console.log('Enhanced bulk edit configuration:');
  console.log(JSON.stringify(basicEnhancedEdit, null, 2));
  
  // Example 2: Conditional logic - AND conditions
  console.log('\n📝 Example 2: Conditional Logic - AND conditions');
  const andConditionEdit = {
    targets: [path.join(TEST_DIR, '**/*.{ts,tsx}')],
    edits: [
      {
        oldText: 'legacy_function',
        newText: 'enhanced_function',
        conditions: {
          and: ['api', 'client']  // Only in files with both 'api' AND 'client' in path
        }
      }
    ],
    dryRun: true
  };
  
  console.log('AND condition configuration:');
  console.log(JSON.stringify(andConditionEdit, null, 2));
  
  // Example 3: Conditional logic - OR conditions
  console.log('\n📝 Example 3: Conditional Logic - OR conditions');
  const orConditionEdit = {
    targets: [path.join(TEST_DIR, '**/*')],
    edits: [
      {
        oldText: 'oldMethod',
        newText: 'newMethod',
        conditions: {
          or: ['utils', 'helpers']  // Only in files with 'utils' OR 'helpers' in path
        }
      }
    ],
    dryRun: true
  };
  
  console.log('OR condition configuration:');
  console.log(JSON.stringify(orConditionEdit, null, 2));
  
  // Example 4: Conditional logic - NOT conditions
  console.log('\n📝 Example 4: Conditional Logic - NOT conditions');
  const notConditionEdit = {
    targets: [path.join(TEST_DIR, '**/*')],
    edits: [
      {
        oldText: 'deprecated_api',
        newText: 'stable_api',
        conditions: {
          not: ['test', 'spec', 'legacy']  // Exclude files with 'test', 'spec', or 'legacy' in path
        }
      }
    ],
    dryRun: true
  };
  
  console.log('NOT condition configuration:');
  console.log(JSON.stringify(notConditionEdit, null, 2));
  
  // Example 5: Complex multi-condition logic
  console.log('\n📝 Example 5: Complex Multi-Condition Logic');
  const complexConditionEdit = {
    targets: [path.join(TEST_DIR, '**/*.{ts,tsx,js,jsx}')],
    edits: [
      {
        oldText: 'function_name',
        newText: 'enhanced_function_name',
        conditions: {
          and: ['components'],        // Must be in components directory
          or: ['api', 'utils'],       // Either API or utils related
          not: ['test', 'spec']       // But not test files
        },
        context: {
          before: 'export'            // Only in export statements
        }
      }
    ],
    ignorePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.*',
      '**/legacy/**'
    ],
    dryRun: true
  };
  
  console.log('Complex multi-condition configuration:');
  console.log(JSON.stringify(complexConditionEdit, null, 2));
  
  // Example 6: Enterprise scale simulation
  console.log('\n📝 Example 6: Enterprise Scale Configuration (100K files ready)');
  const enterpriseScaleEdit = {
    targets: [
      path.join(TEST_DIR, '**/*.ts'),
      path.join(TEST_DIR, '**/*.tsx'),
      path.join(TEST_DIR, '**/*.js'),
      path.join(TEST_DIR, '**/*.jsx')
    ],
    edits: [
      {
        oldText: 'deprecated_api',
        newText: 'modern_api_v2',
        conditions: {
          not: ['test', 'spec', 'legacy', 'deprecated']
        }
      },
      {
        oldText: 'oldMethod',
        newText: 'modernMethod',
        conditions: {
          and: ['components'],
          not: ['legacy']
        },
        context: {
          before: 'class'
        }
      }
    ],
    ignorePatterns: [
      // Default patterns are automatically applied, these are additional
      '**/legacy/**',
      '**/deprecated/**',
      '**/*.generated.*',
      '**/third-party/**',
      '**/*.vendor.*'
    ],
    dryRun: true
  };
  
  console.log('Enterprise scale configuration:');
  console.log(JSON.stringify(enterpriseScaleEdit, null, 2));
}

async function showFileStructure() {
  console.log('\n📋 Test file structure:');
  
  async function listDirectory(dir, prefix = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const [index, entry] of entries.entries()) {
        const isLast = index === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        console.log(prefix + connector + entry.name);
        
        if (entry.isDirectory()) {
          const childPrefix = prefix + (isLast ? '    ' : '│   ');
          await listDirectory(path.join(dir, entry.name), childPrefix);
        }
      }
    } catch (error) {
      console.log(prefix + '└── [Error reading directory]');
    }
  }
  
  await listDirectory(TEST_DIR);
}

async function demonstrateIgnorePatterns() {
  console.log('\n🛡️  Built-in Ignore Patterns Demo:');
  console.log('The following directories/files are automatically ignored:');
  
  const builtInPatterns = [
    '**/.git/**',
    '**/node_modules/**',
    '**/.venv/**',
    '**/dist/**',
    '**/build/**',
    '**/__pycache__/**',
    '**/.DS_Store',
    '**/logs/**',
    '**/coverage/**',
    '**/.*'
  ];
  
  builtInPatterns.forEach((pattern, index) => {
    console.log(`  ${index + 1}. ${pattern}`);
  });
  
  console.log('\n✨ Custom ignore patterns can be added via the ignorePatterns parameter');
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test files...');
  try {
    await fs.rm(TEST_DIR, { recursive: true });
    console.log('✅ Test directory cleaned up');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

async function main() {
  console.log('🚀 Enhanced Bulk Edit Tool Demonstration');
  console.log('========================================');
  console.log('📊 New Capabilities:');
  console.log('  • 100,000 file capacity (100x increase)');
  console.log('  • Advanced conditional logic (AND/OR/NOT)');
  console.log('  • Built-in ignore patterns for common directories');
  console.log('  • Custom ignore pattern support');
  console.log('  • Intelligent batch processing');
  console.log('  • Enterprise-scale performance optimizations');
  
  try {
    await createEnterpriseTestStructure();
    await showFileStructure();
    await demonstrateIgnorePatterns();
    await demonstrateEnhancedBulkEdit();
    
    console.log('\n💡 Enhanced Usage Notes:');
    console.log('- Supports up to 100,000 files with intelligent batching');
    console.log('- Conditional logic allows precise targeting based on file paths');
    console.log('- Built-in ignore patterns automatically exclude common directories');
    console.log('- Custom ignore patterns provide additional filtering control');
    console.log('- AND/OR/NOT logic can be combined for complex targeting rules');
    console.log('- All operations respect security boundaries and allowed directories');
    console.log('- Batch processing ensures optimal performance for large operations');
    
    console.log('\n🔧 To use with the MCP server:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Connect with MCP client');
    console.log('3. Call the enhanced bulk_edit tool with your configuration');
    
    console.log('\n📈 Performance Characteristics:');
    console.log('- Linear scaling up to 100K files');
    console.log('- ~10MB base memory + ~1KB per processed file');
    console.log('- Automatic batch processing (1000 files per batch)');
    console.log('- Intelligent conditional pre-filtering');
    console.log('- Real-time progress tracking and error isolation');
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
  } finally {
    await cleanup();
  }
}

// Run the enhanced demonstration
main().catch(console.error);
