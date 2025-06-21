// Test script to verify fuzzy matching functionality for edit_file tool
const fs = require('fs/promises');
const path = require('path');

async function testFuzzyMatching() {
  const testFilePath = path.join(__dirname, 'test-edit-file.txt');
  
  // Create a test file with some content
  const testContent = `function greetUser(name) {
  console.log("Hello, " + name + "!");
  return true;
}

function calculate(a, b) {
  const result = a + b;
  console.log("Result is: " + result);
  return result;
}

// Main execution
const userName = "World";
greetUser(userName);
calculate(5, 10);
`;

  try {
    // Write the test file
    await fs.writeFile(testFilePath, testContent, 'utf8');
    console.log('✅ Test file created successfully');
    
    // Test the calculateStringSimilarity function we implemented
    const calculateStringSimilarity = require('./dist/tools/filesystem.js').calculateStringSimilarity;
    
    // Test cases for similarity calculation
    const testCases = [
      ['function greetUser(name)', 'function greetUser(nam)', 0.9], // Very similar
      ['console.log("Hello")', 'console.log("Hi")', 0.8], // Similar structure
      ['const result = a + b;', 'const res = a + b;', 0.85], // Similar
      ['completely different', 'function greetUser', 0.1], // Very different
    ];
    
    console.log('\n🔍 Testing string similarity calculations:');
    testCases.forEach(([str1, str2, expectedMin], index) => {
      try {
        const similarity = calculateStringSimilarity(str1, str2);
        const passed = similarity >= expectedMin;
        console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'} Similarity: ${similarity.toFixed(3)} (expected >= ${expectedMin})`);
        console.log(`  "${str1}" vs "${str2}"`);
      } catch (error) {
        console.log(`Test ${index + 1}: ❌ Error: ${error.message}`);
      }
    });
    
    console.log('\n📝 Test file content:');
    console.log(testContent);
    
    console.log('\n💡 To test fuzzy matching with edit_file tool:');
    console.log('1. Try to edit with slightly incorrect text like:');
    console.log('   oldText: "function greetUser(nam)"');
    console.log('   (missing the "e" in "name")');
    console.log('\n2. The tool should now suggest up to 12 similar lines like:');
    console.log('   "function greetUser(name) {"');
    console.log('   "function calculate(a, b) {"');
    console.log('   and more...');
    
  } catch (error) {
    console.error('❌ Error testing fuzzy matching:', error.message);
  } finally {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
      console.log('\n🧹 Test file cleaned up');
    } catch (cleanupError) {
      console.log('\n⚠️ Could not clean up test file:', cleanupError.message);
    }
  }
}

// Run the test
testFuzzyMatching();
