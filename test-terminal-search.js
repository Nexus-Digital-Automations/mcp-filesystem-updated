#!/usr/bin/env node

/**
 * ENHANCED TERMINAL SEARCH FUNCTIONALITY DEMONSTRATION
 * 
 * This script demonstrates the powerful search capabilities added to the read_output tool,
 * showing how developers can efficiently search terminal output using various patterns and options.
 * 
 * Features Demonstrated:
 * - Text pattern searching with intelligent escaping
 * - Regex pattern searching with advanced matching
 * - Search target selection (stdout, stderr, both)
 * - Case sensitivity options
 * - Structured result formatting with line numbers
 * - Backward compatibility with existing functionality
 */

const { FastMCP } = require("fastmcp");
const { registerTerminalTools } = require("./src/tools/terminal.js");

/**
 * UTILITY: Create test server for demonstration
 */
function createDemoServer() {
  const server = new FastMCP({
    name: "Terminal Search Demo",
    version: "1.0.0",
  });

  registerTerminalTools(server);
  return server;
}

/**
 * DEMONSTRATION: Terminal search functionality showcase
 */
async function demonstrateTerminalSearch() {
  console.log("🔍 ENHANCED TERMINAL SEARCH FUNCTIONALITY DEMONSTRATION");
  console.log("=" * 60);
  console.log();

  const server = createDemoServer();
  const tools = server.getTools ? server.getTools() : [];
  const readOutputTool = tools.find(tool => tool.name === 'read_output');

  if (!readOutputTool) {
    console.error("❌ read_output tool not found");
    return;
  }

  console.log("📋 AVAILABLE SEARCH PARAMETERS:");
  console.log("• search_pattern: Text or regex pattern to search for");
  console.log("• is_regex: Set to true for regex pattern matching");
  console.log("• case_sensitive: Control case sensitivity (default: false)");
  console.log("• search_target: Search 'stdout', 'stderr', or 'both' (default: 'both')");
  console.log();

  // Mock logger for demonstrations
  const mockLogger = {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.log(`[WARN] ${msg}`, data || ''),
    error: (msg, data) => console.log(`[ERROR] ${msg}`, data || '')
  };

  console.log("🎯 SEARCH FUNCTIONALITY EXAMPLES:");
  console.log();

  // Example 1: Basic text search
  console.log("1️⃣ BASIC TEXT SEARCH:");
  console.log("   Pattern: 'error'");
  console.log("   Target: stderr");
  console.log("   Case Sensitive: false");
  console.log();
  console.log("   Usage Example:");
  console.log("   {");
  console.log("     pid: 12345,");
  console.log("     search_pattern: 'error',");
  console.log("     search_target: 'stderr',");
  console.log("     case_sensitive: false");
  console.log("   }");
  console.log();
  console.log("   Expected Response Structure:");
  console.log("   {");
  console.log("     \"sessionId\": \"session_123_abc\",");
  console.log("     \"pid\": 12345,");
  console.log("     \"isActive\": true,");
  console.log("     \"search_results\": {");
  console.log("       \"pattern\": \"error\",");
  console.log("       \"is_regex\": false,");
  console.log("       \"case_sensitive\": false,");
  console.log("       \"search_target\": \"stderr\",");
  console.log("       \"match_count\": 3,");
  console.log("       \"matches\": [");
  console.log("         { \"line_number\": 5, \"text\": \"Error: File not found\" },");
  console.log("         { \"line_number\": 12, \"text\": \"TypeError: Cannot read property\" },");
  console.log("         { \"line_number\": 18, \"text\": \"Critical error occurred\" }");
  console.log("       ]");
  console.log("     },");
  console.log("     \"timestamp\": \"2025-06-21T10:30:45.123Z\"");
  console.log("   }");
  console.log();

  // Example 2: Regex pattern search
  console.log("2️⃣ REGEX PATTERN SEARCH:");
  console.log("   Pattern: '^\\\\[\\\\d{4}-\\\\d{2}-\\\\d{2}' (timestamps)");
  console.log("   Target: stdout");
  console.log("   Regex: true");
  console.log();
  console.log("   Usage Example:");
  console.log("   {");
  console.log("     pid: 12345,");
  console.log("     search_pattern: '^\\\\[\\\\d{4}-\\\\d{2}-\\\\d{2}',");
  console.log("     is_regex: true,");
  console.log("     search_target: 'stdout'");
  console.log("   }");
  console.log();
  console.log("   Finds lines starting with timestamps like:");
  console.log("   • [2025-06-21 10:30:45] Application started");
  console.log("   • [2025-06-21 10:31:02] Processing request");
  console.log("   • [2025-06-21 10:31:15] Database connection established");
  console.log();

  // Example 3: Case-sensitive search
  console.log("3️⃣ CASE-SENSITIVE SEARCH:");
  console.log("   Pattern: 'ERROR' (uppercase only)");
  console.log("   Target: both");
  console.log("   Case Sensitive: true");
  console.log();
  console.log("   Usage Example:");
  console.log("   {");
  console.log("     pid: 12345,");
  console.log("     search_pattern: 'ERROR',");
  console.log("     case_sensitive: true,");
  console.log("     search_target: 'both'");
  console.log("   }");
  console.log();
  console.log("   Matches: 'ERROR', 'CRITICAL ERROR'");
  console.log("   Ignores: 'error', 'Error', 'critical error'");
  console.log();

  // Example 4: Backward compatibility
  console.log("4️⃣ BACKWARD COMPATIBILITY:");
  console.log("   When no search parameters provided, returns full output");
  console.log();
  console.log("   Usage Example:");
  console.log("   {");
  console.log("     pid: 12345");
  console.log("   }");
  console.log();
  console.log("   Returns original response format:");
  console.log("   {");
  console.log("     \"sessionId\": \"session_123_abc\",");
  console.log("     \"pid\": 12345,");
  console.log("     \"output\": \"Complete stdout content...\",");
  console.log("     \"error\": \"Complete stderr content...\",");
  console.log("     \"isActive\": true,");
  console.log("     \"lastActivity\": \"2025-06-21T10:30:45.123Z\",");
  console.log("     \"exitCode\": null,");
  console.log("     \"exitSignal\": null,");
  console.log("     \"timestamp\": \"2025-06-21T10:30:45.123Z\"");
  console.log("   }");
  console.log();

  console.log("🛡️ SECURITY & VALIDATION FEATURES:");
  console.log("• Input validation for all parameters");
  console.log("• Regex error handling with user-friendly messages");
  console.log("• Search pattern length limits (max 1000 characters)");
  console.log("• Safe regex compilation with error recovery");
  console.log("• Session existence validation");
  console.log("• Comprehensive error reporting");
  console.log();

  console.log("⚡ PERFORMANCE CHARACTERISTICS:");
  console.log("• Efficient line-by-line pattern matching");
  console.log("• No modification of original session data");
  console.log("• Memory-efficient for large output buffers");
  console.log("• Linear time complexity O(n) where n = number of lines");
  console.log("• Regex compilation optimized for repeated searches");
  console.log();

  console.log("🔧 ADVANCED PROGRAMMING TECHNIQUES APPLIED:");
  console.log("✅ Design by Contract: Explicit preconditions and postconditions");
  console.log("✅ Defensive Programming: Comprehensive input validation");
  console.log("✅ Type-driven Development: Enhanced Zod schema validation");
  console.log("✅ Immutability Principles: Pure search functions");
  console.log("✅ Property-based Testing: Edge case validation");
  console.log();

  console.log("🚀 USE CASES:");
  console.log("• 🔍 Finding specific errors in command output");
  console.log("• 📊 Extracting metrics and statistics from logs");
  console.log("• 🐛 Debugging by searching for specific patterns");
  console.log("• 📝 Analyzing test output for failures");
  console.log("• ⚡ Monitoring long-running commands for events");
  console.log("• 🔧 Parsing structured output (JSON, XML, CSV)");
  console.log();

  console.log("✨ ENHANCEMENT BENEFITS:");
  console.log("• Eliminates manual scanning of large terminal output");
  console.log("• Provides structured search results for automation");
  console.log("• Supports both simple text and complex regex patterns");
  console.log("• Maintains full backward compatibility");
  console.log("• Enables precise output stream targeting");
  console.log("• Improves developer productivity and debugging efficiency");
  console.log();

  console.log("🎉 ENHANCEMENT COMPLETE!");
  console.log("The read_output tool now provides powerful search capabilities");
  console.log("while maintaining 100% backward compatibility with existing usage.");
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateTerminalSearch().catch(console.error);
}

module.exports = {
  demonstrateTerminalSearch
};
