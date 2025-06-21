# MCP Filesystem Server Architecture (Modular FastMCP Implementation)

## Overview

The MCP Filesystem Server is a Node.js implementation of the Model Context Protocol (MCP) built with the FastMCP TypeScript framework. This server provides comprehensive filesystem, process management, and terminal operations as tools to AI assistants, allowing AI models to interact with the local system in a controlled, secure manner with enterprise-grade advanced programming techniques.

## Modular Architecture

```
src/
├── index.ts                    # Main server entry point and orchestration
├── utils/
│   ├── security.ts            # Core security validation and path handling
│   └── path-helpers.ts        # Shared path schemas and utility functions
└── tools/
    ├── filesystem.ts          # File and directory manipulation tools
    ├── process.ts             # System process management tools
    ├── terminal.ts            # Command execution and session management tools
    ├── package-management.ts  # npm and Python package management tools
    ├── network-api.ts         # Network connectivity and API testing tools
    ├── code-analysis.ts       # Code linting, formatting, and analysis tools
    ├── file-monitoring.ts     # File watching and change tracking tools
    └── testing.ts             # Test execution and coverage analysis tools
```

## Core Components

```
┌─────────────────────────────────────────────────────────┐
│                FastMCP Filesystem Server                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │             Main Entry Point (index.ts)         │  │
│  │  - Server initialization and configuration      │  │
│  │  - Tool category registration                   │  │
│  │  - Lifecycle management                         │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │             Utilities Layer                     │  │
│  │  ┌───────────────────┐  ┌───────────────────┐  │  │
│  │  │   security.ts     │  │  path-helpers.ts  │  │  │
│  │  │ - validatePath()  │  │ - PathArgSchema   │  │  │
│  │  │ - allowedDirs     │  │ - getPathFrom()   │  │  │
│  │  │ - expandHome()    │  │ - utility funcs   │  │  │
│  │  └───────────────────┘  └───────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │                Tools Layer                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  │filesystem.ts│  │ process.ts  │  │ terminal.ts │  │
│  │  │- File ops   │  │- list_proc  │  │- exec_cmd   │  │
│  │  │- Dir ops    │  │- kill_proc  │  │- read_out   │  │
│  │  │- Search     │  │- monitoring │  │- sessions   │  │
│  │  │- Edit/Copy  │  │- lifecycle  │  │- mgmt       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  │package-mgmt │  │network-api │  │code-analysis│  │
│  │  │- npm tools  │  │- port check │  │- linting    │  │
│  │  │- pip tools  │  │- http req   │  │- formatting │  │
│  │  │- deps audit │  │- localhost  │  │- metrics    │  │
│  │  │- security   │  │- ping/dns   │  │- duplicates │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │
│  │  ┌─────────────┐  ┌─────────────┐                  │
│  │  │file-monitor │  │testing.ts  │                  │
│  │  │- watch files│  │- run tests  │                  │
│  │  │- tail logs  │  │- coverage   │                  │
│  │  │- dir watch  │  │- continuous │                  │
│  │  │- file diff  │  │- benchmark  │                  │
│  │  └─────────────┘  └─────────────┘                  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │             FastMCP Framework                   │  │
│  │  - Session Management & Auto Tool Routing      │  │
│  │  - Schema Validation & Error Handling          │  │
│  │  - Resource Templates & Development CLI        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1. Main Entry Point (src/index.ts)

The main server file orchestrates the entire system with a clean, modular approach:

**Key Responsibilities:**
- **Server Initialization**: Configure FastMCP server with comprehensive settings
- **Module Registration**: Register tool categories from filesystem, process, and terminal modules
- **Lifecycle Management**: Handle server startup, shutdown, and error management
- **Configuration Management**: Parse command-line arguments and validate allowed directories

**Implementation Pattern:**
```typescript
// 1. Initialize FastMCP server
const server = new FastMCP({
  name: "Desktop-Commander-MCP",
  version: "1.0.0",
  instructions: "Comprehensive desktop environment interaction server"
});

// 2. Register modular tool categories
registerFilesystemTools(server);
registerProcessTools(server);
registerTerminalTools(server);

// 3. Start server with comprehensive error handling
await server.start({ transportType: "stdio" });
```

### 2. Utilities Layer

**security.ts**: Core security validation and path management
- `validatePath()`: Triple-layer security validation with UserError integration
- `allowedDirectories`: Immutable configuration with startup validation
- `normalizePath()` and `expandHome()`: Path normalization utilities
- Comprehensive boundary enforcement with descriptive error reporting

**path-helpers.ts**: Shared path schemas and utility functions
- `PathArgumentSchema`: Zod schema for flexible path parameter handling
- `getPathFromOptions()`: Path extraction with contract-based validation
- Reusable validation patterns for consistent tool implementation

### 3. Tools Layer

**filesystem.ts**: Comprehensive file and directory operations
- **File Operations**: read_multiple_files, write_file, append_file, edit_file, delete_file
- **Directory Operations**: create_directory, directory_tree, list_allowed_directories
- **Advanced Operations**: copy_file, rename_file with enterprise-grade validation
- **Search Operations**: search_files_and_folders with glob pattern support
- **Resource Templates**: file:// resource interface for direct content access

**process.ts**: System process management and monitoring
- **Process Listing**: list_processes with resource usage monitoring
- **Process Control**: kill_process with comprehensive safety validation
- **System Integration**: Cross-platform process management capabilities
- **Security Boundaries**: Safe process operations within allowed contexts

**terminal.ts**: Command execution and session management
- **Command Execution**: execute_command with persistent session tracking
- **Session Management**: Session lifecycle with state encapsulation
- **Output Streaming**: read_output with real-time buffer management
- **Session Control**: list_sessions and force_terminate with cleanup
- **Code Search Integration**: search_code with ripgrep integration

**package-management.ts**: npm and Python package management
- **npm Operations**: npm_install, npm_scripts, npm_audit, npm_outdated
- **Python Package Management**: pip_install with virtual environment support
- **Dependency Analysis**: dependency_info with security transparency
- **Security Auditing**: Vulnerability scanning and update management
- **Lock File Management**: Automatic dependency resolution and validation

**network-api.ts**: Network connectivity and API testing
- **Port Management**: check_port for service discovery
- **HTTP Operations**: http_request for API testing and development
- **Service Discovery**: localhost_services for development environment
- **Network Diagnostics**: ping_host and dns_lookup for troubleshooting
- **Security Boundaries**: Validates endpoints and prevents abuse

**code-analysis.ts**: Code quality and analysis tools
- **Code Linting**: lint_code with ESLint, Pylint, and auto-fix capabilities
- **Code Formatting**: format_code with Prettier, Black, and language-specific formatters
- **Metrics Analysis**: code_metrics for complexity and maintainability assessment
- **Duplicate Detection**: find_duplicates for code quality improvement
- **Type Checking**: type_check for TypeScript/mypy validation

**file-monitoring.ts**: Real-time file and directory monitoring
- **File Watching**: watch_files with pattern matching and notifications
- **Log Monitoring**: tail_logs with filtering and real-time updates
- **Directory Tracking**: directory_watch for comprehensive change detection
- **Content Comparison**: file_diff for change analysis and tracking
- **Resource Management**: Efficient monitoring with usage limits

**testing.ts**: Test execution and performance analysis
- **Test Execution**: run_tests with comprehensive framework support
- **Coverage Analysis**: test_coverage with multiple output formats
- **Continuous Testing**: test_watch with file monitoring integration
- **Performance Testing**: benchmark for optimization and profiling
- **Framework Integration**: Jest, pytest, and auto-detection capabilities

### 4. FastMCP Framework Integration

The FastMCP framework provides a streamlined development experience while maintaining enterprise-grade capabilities:

**Key Features:**
- **Simplified Tool Definition**: Each tool defined with `server.addTool()` containing name, description, parameters, and execute function
- **Direct Schema Usage**: Zod schemas used directly without JSON conversion via `zodToJsonSchema`
- **Built-in Session Management**: Automatic client session handling and lifecycle management
- **Enhanced Error Handling**: `UserError` for user-facing messages, contextual logging support
- **Development CLI**: Built-in testing and debugging tools (`npx fastmcp dev`, `npx fastmcp inspect`)

### 2. Advanced Programming Techniques Integration

Each tool implementation demonstrates enterprise-grade advanced programming techniques:

**Design by Contract Implementation:**
- Explicit preconditions, postconditions, and invariants documented in tool descriptions
- Runtime assertion checking for critical business logic
- Contract verification in complex operations like `rename_file`

**Comprehensive Defensive Programming:**
- Multi-layer input validation with Zod schema refinement
- Security boundary enforcement at all filesystem access points
- Triple path validation: user input → security check → operation validation
- `UserError` integration for descriptive user-facing error messages

**Type-Driven Development:**
- Direct Zod schema usage for compile-time and runtime type safety
- Branded types concept for domain modeling (path validation, file operations)
- Comprehensive type guards and runtime type checking

**Immutability and Pure Functions:**
- Pure function implementations for core logic (directory tree building, file operations)
- Immutable data structures and Set-based deduplication
- Functional composition patterns for data processing

**Property-Based Testing Principles:**
- Postcondition verification with invariant checking
- Comprehensive edge case handling and boundary condition testing
- Runtime verification of operation outcomes

### 3. Enhanced Security Layer

The security layer has been enhanced with FastMCP integration while maintaining all original protections:

**Key Components:**
- `validatePath()`: Enhanced with `UserError` for better error reporting
- `allowedDirectories`: Immutable configuration with triple validation
- **Security Boundaries**: Comprehensive boundary checking with descriptive error messages

### 4. Streamlined Tool Definitions

FastMCP eliminates the complex handler patterns of the base SDK, replacing them with intuitive tool definitions:

**FastMCP Tool Pattern:**
```typescript
server.addTool({
  name: "tool_name",
  description: "Comprehensive tool description with contracts",
  parameters: zodSchema, // Direct Zod schema usage
  execute: async (args, context) => {
    // Tool implementation with advanced programming techniques
    // Access to logging: context.log.info/warn/error
    // Progress reporting: context.reportProgress
    // UserError for user-facing errors
    return "result";
  },
});
```

**Current Tools with Advanced Programming Techniques:**

**Filesystem Tools (filesystem.ts):**
- `read_multiple_files`: Parallel file reading with comprehensive error handling
- `write_file`: Atomic file replacement with security validation
- `create_directory`: Recursive directory creation with boundary enforcement
- `get_file_info`: Comprehensive metadata retrieval with type safety
- `append_file`: Safe file appending with path validation alternatives
- `copy_file`: Secure file copying with triple path validation and overwrite protection
- `edit_file`: Advanced text editing with flexible matching and diff generation
- `bulk_edit`: ⭐ **Enterprise Showcase** - Bulk editing with conditional logic and ignore patterns
- `directory_tree`: ASCII tree generation with pure function implementation
- `delete_file`: Safe file deletion with comprehensive validation
- `rename_file`: ⭐ **Advanced Programming Showcase** - Enterprise-grade file operations
- `search_files_and_folders`: ⭐ **Advanced Programming Showcase** - Powerful search capabilities
- `list_allowed_directories`: Security context listing

**Process Management Tools (process.ts):**
- `list_processes`: System process enumeration with resource monitoring
- `kill_process`: Safe process termination with comprehensive validation

**Terminal Session Tools (terminal.ts):**
- `execute_command`: Command execution with session lifecycle management
- `read_output`: Session output streaming with buffer management
- `list_sessions`: Active session enumeration with state tracking
- `force_terminate`: Session cleanup with proper resource management
- `search_code`: Content searching with ripgrep integration

**Package Management Tools (package-management.ts):**
- `npm_install`: Dependency installation with lock file management
- `npm_scripts`: Script execution with output streaming
- `npm_audit`: Security vulnerability scanning
- `npm_outdated`: Package update checking
- `pip_install`: Python package installation with virtual environment support
- `dependency_info`: Comprehensive package metadata analysis

**Network & API Tools (network-api.ts):**
- `check_port`: Port service discovery and status checking
- `http_request`: HTTP request execution for API testing
- `localhost_services`: Local development server detection
- `ping_host`: Network connectivity testing
- `dns_lookup`: DNS resolution and troubleshooting

**Code Analysis Tools (code-analysis.ts):**
- `lint_code`: Code quality analysis with multiple linters
- `format_code`: Code formatting with language-specific tools
- `code_metrics`: Complexity and maintainability analysis
- `find_duplicates`: Copy-paste detection and structural analysis
- `type_check`: TypeScript/mypy type validation

**File Monitoring Tools (file-monitoring.ts):**
- `watch_files`: Real-time file change monitoring with patterns
- `tail_logs`: Log file monitoring with filtering
- `directory_watch`: Comprehensive directory change tracking
- `file_diff`: File content comparison and change analysis

**Testing Tools (testing.ts):**
- `run_tests`: Test suite execution with framework support
- `test_coverage`: Code coverage analysis and reporting
- `test_watch`: Continuous testing with file monitoring
- `benchmark`: Performance testing and profiling

**Resource Templates:**
- `file://{path}`: Direct file content access through MCP resource interface

### 5. Enhanced Implementation Patterns

**Error Handling Excellence:**
```typescript
// FastMCP Pattern - User-facing errors
throw new UserError("Descriptive error message for user");

// Logging integration
execute: async (args, { log }) => {
  log.info("Operation starting", { operation: "file_copy" });
  log.warn("Potential issue detected", { context });
  // Implementation
}
```

**Contract Implementation:**
```typescript
// Preconditions documented and enforced
if (!args.source_path || typeof args.source_path !== 'string') {
  throw new UserError("Source path must be a non-empty string");
}

// Postconditions verified
const newStats = await fs.stat(validDestPath);
if (newStats.size !== originalSize) {
  throw new UserError('Postcondition violated: file size changed during operation');
}
```

### 6. Utility Functions

Helper functions enhanced for FastMCP integration:

- `normalizeLineEndings()`: Ensure consistent line endings in text operations
- `createUnifiedDiff()`: Generate git-style diffs for file changes with proper formatting
- `applyFileEdits()`: Apply text replacements with enhanced error handling and UserError integration
- Path utilities: `normalizePath()`, `expandHome()` with comprehensive validation
- `validatePath()`: Enhanced security validation with descriptive UserError messages
- `getPathFromOptions()`: Path extraction from flexible parameter schemas

## Data Flow

```
┌─────────┐      ┌─────────────────────┐      ┌─────────────────┐
│         │      │                     │      │                 │
│ Client  ├──────► FastMCP Server      ├──────► Module Router   │
│         │      │ - Session Mgmt      │      │ - Tool Category │
└─────────┘      │ - Auto Routing      │      │   Selection     │
                 │ - Schema Validation │      └──────┬──────────┘
                 └─────────────────────┘             │
                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool Category Modules                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │filesystem.ts│  │ process.ts  │  │    terminal.ts      │ │
│  │- File ops   │  │- list_proc  │  │- execute_command    │ │
│  │- Dir ops    │  │- kill_proc  │  │- session_mgmt       │ │
│  │- Search     │  │- monitoring │  │- output_streaming   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │                 │
                         │ Security Layer  │
                         │ (utils/*)       │
                         │                 │
                         └──────┬──────────┘
                                │
                                ▼
                         ┌─────────────────┐
                         │                 │
                         │ System          │
                         │ Operations      │
                         │                 │
                         └─────────────────┘
```

**Enhanced Modular Flow:**
1. Client sends request to FastMCP server
2. FastMCP automatically routes request to appropriate tool category module
3. Tool category module validates parameters and applies security checks
4. Shared utilities provide security validation and path handling
5. Advanced programming techniques applied throughout the pipeline
6. System operations performed with comprehensive validation
7. Results returned with proper error handling and logging

## Security Model

The modular security model maintains all original protections while improving maintainability:

**Enhanced Security Features:**
1. **Centralized Security**: All validation logic concentrated in `utils/security.ts`
2. **Shared Path Handling**: Consistent path validation across all tool categories
3. **Module Isolation**: Each tool category operates within defined security boundaries
4. **Comprehensive Logging**: Built-in logging context across all modules
5. **Contract-Based Validation**: Explicit security contracts in all tool implementations

**Security Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                   Security Layers                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Application Layer (tool modules)                │ │
│  │  - Tool-specific validation                             │ │
│  │  - Business logic security                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Utilities Layer (utils/security.ts)            │ │
│  │  - validatePath() with triple validation               │ │
│  │  - allowedDirectories boundary enforcement             │ │
│  │  - Path normalization and expansion                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Framework Layer (FastMCP)                      │ │
│  │  - Schema validation and type checking                 │ │
│  │  - Session management and lifecycle                    │ │
│  │  - Error handling and UserError integration            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Modular server configuration through organized initialization:

**Startup Process:**
1. Parse command-line arguments for allowed directories (`utils/security.ts`)
2. Validate all directories exist and are accessible
3. Initialize FastMCP server with comprehensive configuration (`src/index.ts`)
4. Register all tool category modules with shared utilities
5. Start server with stdio transport and complete session management

## Development and Testing

Enhanced development experience with modular architecture:

**Development Tools:**
```bash
# Interactive development with modular hot reload
npx fastmcp dev src/index.ts -- /path/to/allowed/dir

# Web UI inspection with comprehensive tool testing
npx fastmcp inspect src/index.ts -- /path/to/allowed/dir

# TypeScript compilation with module validation
npm run build
npm run watch

# Module-specific testing
npm run test:filesystem
npm run test:process  
npm run test:terminal
```

**Modular Testing Advantages:**
- Individual tool category testing and validation
- Shared utility testing with comprehensive coverage
- Module isolation for focused debugging and development
- Comprehensive error reporting with module context

## Adding New Tool Categories

The modular architecture makes it easy to add new tool categories. Follow this comprehensive guide:

### 1. Create New Tool Category File

Create a new file in `src/tools/` following the naming convention `[category-name].ts`:

```typescript
// src/tools/new-category.ts
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { validatePath } from "../utils/security.js";
import { getPathFromOptions } from "../utils/path-helpers.js";

/**
 * Register all tools for the new category
 */
export function registerNewCategoryTools(server: FastMCP): void {
  // Add your tools here using server.addTool()
}
```

### 2. Implement Individual Tools

Follow the FastMCP pattern for each tool:

```typescript
server.addTool({
  name: "tool_name",
  description: `
    Comprehensive tool description with contracts.
    
    PRECONDITIONS:
    - Input validation requirements
    - Security boundary conditions
    
    POSTCONDITIONS:
    - Expected output guarantees
    - System state changes
    
    INVARIANTS:
    - Properties that remain unchanged
  `,
  parameters: z.object({
    // Define parameters using Zod schemas
    path: z.string().min(1, "Path must not be empty"),
    optional_param: z.boolean().optional(),
  }),
  execute: async (args, { log }) => {
    try {
      // DEFENSIVE PROGRAMMING: Input validation
      const validPath = await validatePath(args.path);
      
      // TYPE-DRIVEN DEVELOPMENT: Runtime type checking
      if (!validPath) {
        throw new UserError("Invalid path provided");
      }
      
      // IMMUTABILITY: Pure function implementation
      const result = await performOperation(validPath);
      
      // CONTRACT: Postcondition verification
      if (!result.success) {
        throw new UserError("Operation failed to meet postconditions");
      }
      
      log.info("Operation completed successfully", { path: args.path });
      return result.data;
      
    } catch (error) {
      log.error("Tool execution failed", { error: error.message });
      throw error instanceof UserError ? error : new UserError(`Operation failed: ${error.message}`);
    }
  },
});
```

### 3. Register in Main Server

Add the import and registration in `src/index.ts`:

```typescript
// Add import
import { registerNewCategoryTools } from "./tools/new-category.js";

// Add to registerAllTools function
async function registerAllTools(server: FastMCP): Promise<void> {
  console.error("🔧 Registering modular tool categories...");
  
  try {
    // Existing registrations...
    registerFilesystemTools(server);
    registerProcessTools(server);
    registerTerminalTools(server);
    
    // Add your new category
    console.error("  🆕 Registering new category tools...");
    registerNewCategoryTools(server);
    
    console.error("✅ All tool categories registered successfully");
  } catch (error) {
    console.error("❌ CRITICAL: Tool registration failed:", error);
    throw error;
  }
}
```

### 4. Add Testing Support

Update `package.json` to include test scripts for your new category:

```json
{
  "scripts": {
    "test:new-category": "jest --testPathPattern=new-category"
  }
}
```

Create test files in `src/__tests__/tools/new-category.test.ts`:

```typescript
// src/__tests__/tools/new-category.test.ts
import { describe, test, expect } from '@jest/globals';
import { FastMCP } from 'fastmcp';
import { registerNewCategoryTools } from '../../tools/new-category.js';

describe('New Category Tools', () => {
  let server: FastMCP;
  
  beforeEach(() => {
    server = new FastMCP({ name: 'test', version: '1.0.0' });
    registerNewCategoryTools(server);
  });
  
  test('should register tools successfully', () => {
    // Test tool registration
  });
  
  test('should validate inputs correctly', async () => {
    // Test input validation
  });
  
  test('should handle errors gracefully', async () => {
    // Test error handling
  });
});
```

### 5. Update Documentation

Update the following files to reflect your new tools:

1. **README.md**: Add tool descriptions in the API section
2. **ARCHITECTURE.md**: Update the modular architecture diagram and tool listings
3. **package.json**: Add test scripts
4. Add any necessary dependencies

### 6. Advanced Programming Technique Integration

Ensure your tools follow the established patterns:

**Design by Contract:**
- Document preconditions, postconditions, and invariants
- Include runtime assertion checking for critical operations
- Verify contract compliance in tests

**Defensive Programming:**
- Multi-layer input validation using Zod schemas
- Security boundary enforcement with `validatePath()`
- Comprehensive error handling with `UserError`

**Type-Driven Development:**
- Use branded types for domain modeling
- Runtime type checking with Zod refinements
- Comprehensive type guards

**Immutability Patterns:**
- Pure function implementations where possible
- Immutable data structures
- Functional composition patterns

**Property-Based Testing:**
- Postcondition verification
- Invariant checking
- Edge case handling

### 7. Security Considerations

Always include security measures:

- **Path Validation**: Use `validatePath()` for all file operations
- **Input Sanitization**: Validate and sanitize all user inputs
- **Resource Limits**: Implement appropriate timeouts and resource constraints
- **Error Messages**: Provide helpful but not revealing error messages
- **Logging**: Include appropriate logging for security monitoring

### 8. Performance Guidelines

- **Async Operations**: Use proper async/await patterns
- **Resource Management**: Clean up resources appropriately
- **Caching**: Implement caching where beneficial
- **Monitoring**: Include performance logging and metrics

## Deployment

Enhanced deployment options with modular FastMCP architecture:

**Local Development:**
```bash
npx fastmcp dev src/index.ts -- /allowed/directory
```

**Production Deployment:**
1. **NPX Deployment** (recommended for local use):
   ```json
   {
     "mcpServers": {
       "desktop-commander": {
         "command": "npx",
         "args": ["tsx", "/path/to/src/index.ts", "/allowed/dir1", "/allowed/dir2"],
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

2. **Docker Deployment** (for containerized environments):
   ```bash
   docker build -t mcp/desktop-commander -f Dockerfile .
   docker run -v /host/allowed:/projects mcp/desktop-commander /projects
   ```

**Modular Configuration Benefits:**
- Clean separation of concerns with dedicated modules
- Enhanced error reporting during startup with module context
- Comprehensive logging for debugging across all categories
- Advanced programming technique integration with shared utilities
- Scalable architecture for adding new tool categories 