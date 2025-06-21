#!/usr/bin/env node

/**
 * Bulk Edit Tool Demonstration Script
 * 
 * This script demonstrates the bulk_edit tool functionality and context-based matching.
 * It creates sample files, applies bulk edits, and shows the results.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directory setup
const TEST_DIR = path.join(__dirname, 'bulk-edit-test');

async function createTestFiles() {
  console.log('🗂️  Creating test files...');
  
  // Ensure test directory exists
  await fs.mkdir(TEST_DIR, { recursive: true });
  
  // Sample TypeScript file
  const sampleTS = `// File imports
import { oldFunction } from 'old-package';
import { helper } from 'utils';

export class ExampleClass {
  constructor() {
    console.log('Initializing...');
  }
  
  oldFunction() {
    // This is the old implementation
    return 'old result';
  }
  
  processData() {
    const result = oldFunction();
    return result;
  }
}`;

  // Sample JavaScript file
  const sampleJS = `const { oldFunction } = require('old-package');

function processItems() {
  // Processing items
  const result = oldFunction();
  return result;
}

module.exports = { processItems };`;

  // Sample configuration file
  const sampleConfig = `{
  "settings": {
    "old_config_key": "deprecated_value",
    "other_setting": "keep_this"
  },
  "features": {
    "old_config_key": "another_deprecated_value"
  }
}`;

  await fs.writeFile(path.join(TEST_DIR, 'example.ts'), sampleTS);
  await fs.writeFile(path.join(TEST_DIR, 'example.js'), sampleJS);
  await fs.writeFile(path.join(TEST_DIR, 'config.json'), sampleConfig);
  
  console.log('✅ Test files created successfully');
}

async function demonstrateBulkEdit() {
  console.log('\n🔧 Demonstrating bulk_edit functionality...');
  
  // Example 1: Basic bulk replace across multiple files
  console.log('\n📝 Example 1: Basic bulk replace');
  const basicEdit = {
    targets: [
      path.join(TEST_DIR, '*.ts'),
      path.join(TEST_DIR, '*.js')
    ],
    edits: [
      {
        oldText: 'oldFunction',
        newText: 'newFunction'
      }
    ],
    dryRun: true
  };
  
  console.log('Bulk edit configuration:');
  console.log(JSON.stringify(basicEdit, null, 2));
  
  // Example 2: Context-based matching
  console.log('\n📝 Example 2: Context-based matching');
  const contextEdit = {
    targets: [path.join(TEST_DIR, '*.ts')],
    edits: [
      {
        oldText: "import { oldFunction } from 'old-package';",
        newText: "import { newFunction } from 'new-package';",
        context: {
          before: '// File imports'
        }
      }
    ],
    dryRun: true
  };
  
  console.log('Context-based edit configuration:');
  console.log(JSON.stringify(contextEdit, null, 2));
  
  // Example 3: Multiple edits with different contexts
  console.log('\n📝 Example 3: Multiple edits with contexts');
  const multiEdit = {
    targets: [path.join(TEST_DIR, '**/*')],
    edits: [
      {
        oldText: 'old_config_key',
        newText: 'new_config_key',
        context: {
          before: '"settings": {'
        }
      },
      {
        oldText: 'oldFunction',
        newText: 'modernFunction'
      }
    ],
    dryRun: true
  };
  
  console.log('Multi-edit configuration:');
  console.log(JSON.stringify(multiEdit, null, 2));
}

async function showFileContents() {
  console.log('\n📋 Test file contents:');
  
  const files = await fs.readdir(TEST_DIR);
  for (const file of files) {
    const filePath = path.join(TEST_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`\n📄 ${file}:`);
    console.log('─'.repeat(50));
    console.log(content);
    console.log('─'.repeat(50));
  }
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
  console.log('🚀 Bulk Edit Tool Demonstration');
  console.log('===============================');
  
  try {
    await createTestFiles();
    await showFileContents();
    await demonstrateBulkEdit();
    
    console.log('\n💡 Usage Notes:');
    console.log('- The bulk_edit tool supports files, directories, and glob patterns');
    console.log('- Context-based matching provides surgical precision for edits');
    console.log('- Use dryRun: true to preview changes before applying them');
    console.log('- All operations respect security boundaries and allowed directories');
    console.log('- Error isolation ensures single file failures don\'t abort bulk operations');
    
    console.log('\n🔧 To use with the MCP server:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Connect with MCP client');
    console.log('3. Call the bulk_edit tool with your target configuration');
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
  } finally {
    await cleanup();
  }
}

// Run the demonstration
main().catch(console.error);
