# Desktop Commander MCP Server (Modular FastMCP Implementation)

**Comprehensive modular Node.js server implementing Model Context Protocol (MCP) using the FastMCP TypeScript framework. Features enterprise-grade filesystem operations, process management, and terminal session handling with advanced programming techniques.**

## Features

### Comprehensive Tool Categories
- **Filesystem Operations**: File reading, writing, editing, copying, moving, and directory management
- **Process Management**: System process listing, monitoring, and termination capabilities  
- **Terminal Integration**: Command execution with session management and output streaming
- **Content Search**: Advanced file and code content searching with ripgrep integration
- **🔧 Package Management**: Dependency installation, auditing, and update management for npm and Python packages
- **🌐 Network & API**: Port checking, HTTP requests, service discovery, and network connectivity testing
- **🔍 Code Analysis**: Linting, formatting, complexity analysis, duplicate detection, and type checking
- **📁 File Monitoring**: Real-time file watching, log tailing, and directory change tracking
- **🧪 Testing**: Test execution, coverage reports, continuous testing, and performance benchmarking

### Core Filesystem Operations
- Read multiple files simultaneously with comprehensive error handling
- Write files with complete content replacement and atomic operations
- Append content to files with flexible path parameters
- Edit files with advanced pattern matching and diff generation
- Create directories recursively with comprehensive validation
- View directory trees in compact ASCII format with filtering
- Copy files with comprehensive security validation and overwrite protection
- Rename/move files with enterprise-grade error handling and integrity verification
- Delete files with comprehensive validation and safety checks
- Get detailed file/directory metadata including timestamps and permissions
- Search files and folders with glob pattern support and filtering options

### Advanced System Integration
- **Terminal Session Management**: Execute shell commands with persistent session tracking
- **Process Lifecycle Control**: List and manage system processes with resource monitoring
- **Code Search Integration**: Content searching using ripgrep with regex and context support
- **Resource Templates**: File content access through MCP resource interface

### FastMCP Framework Advantages
- **Simplified Development**: Streamlined tool definition with `server.addTool()` pattern
- **Direct Schema Integration**: Zod schemas used directly without JSON conversion
- **Enhanced Error Handling**: `UserError` for user-facing messages with descriptive context
- **Built-in Testing**: Integrated CLI tools for development and debugging
- **Session Management**: Automatic client session handling and lifecycle management

### Advanced Programming Techniques
- **Design by Contract**: Explicit preconditions, postconditions, and invariants
- **Comprehensive Defensive Programming**: Multi-layer input validation and security boundaries
- **Type-Driven Development**: Runtime type checking with branded types and comprehensive validation
- **Immutability Principles**: Pure functions and functional composition patterns
- **Property-Based Testing**: Postcondition verification with invariant checking

### Modular Architecture
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

- **Clean Separation**: Organized into filesystem, process, and terminal tool categories
- **Reusable Utilities**: Shared security validation and path handling utilities
- **Maintainable Codebase**: Logical organization following enterprise software patterns
- **Scalable Design**: Easy addition of new tool categories and functionality
- **45+ Total Tools**: Comprehensive toolset across all categories with advanced programming techniques

### Enterprise-Grade Security
- **Triple Path Validation**: Defense-in-depth security validation
- **Boundary Enforcement**: Comprehensive security boundary checking
- **Descriptive Error Reporting**: Security-conscious error messages that prevent information leakage
- **Comprehensive Logging**: Built-in logging context for security monitoring and debugging

**Note**: The server will only allow operations within directories specified via `args`.

## API

### Resources

- `file://{path}`: Direct file content access through MCP resource template interface

### Filesystem Tools

- **read_multiple_files**
  - Read multiple files simultaneously with comprehensive error handling
  - Input: `paths` (string[])
  - Returns content of each file with clear separation and error reporting

- **write_file** 
  - Completely replace file content with atomic write operations
  - Inputs:
    - `path` (string, required): Full path of the file to write
    - `content` (string, required): Complete content to write to the file
  - Returns success message with operation details
  - Security: File path must be within allowed directories

- **create_directory**
  - Create directories with recursive parent creation
  - Input: `path` (string, required): Full path of the directory to create
  - Returns success message confirming directory creation
  - Security: Directory path must be within allowed directories

- **get_file_info**
  - Retrieve detailed metadata about files and directories
  - Input: `path` / `file_path` / `filepath` (string): File/directory location
  - Returns JSON with size, timestamps, permissions, and type information
  - Security: Path must be within allowed directories

- **copy_file**
  - Copies a file from a specified source path to a target directory
  - Inputs:
    - `source_path` (string, required): Full path of the file to copy
    - `destination_directory` (string, required): Full path of the destination directory
    - `overwrite` (boolean, optional, default: false): Overwrite existing files
  - Returns success message upon completion
  - Security: Source and destination must be within allowed directories

- **append_file**
  - Append new content to an existing file
  - Inputs:
    - `path` / `file_path` / `filepath` (string): File location (provide exactly one)
    - `content` (string): Content to append
  - Returns the complete content of the file after appending

- **edit_file**
  - Make selective edits using advanced pattern matching and formatting
  - Features:
    - Line-based and multi-line content matching
    - Whitespace normalization with indentation preservation
    - Multiple simultaneous edits with correct positioning
    - Indentation style detection and preservation
    - Git-style diff output with context
    - Preview changes with dry run mode
  - Inputs:
    - `path` / `file_path` / `filepath` (string): File to edit (provide exactly one)
    - `edits` (array): List of edit operations with oldText/newText or old_string/new_string
    - `dryRun` (boolean): Preview changes without applying (default: false)
  - Returns detailed diff and match information

- **bulk_edit** ⭐ *Enterprise Scale*
  - Performs bulk find-and-replace operations across thousands of files with a single command.
  - Features:
    - Supports up to 100,000 files with intelligent batch processing.
    - Advanced conditional logic (AND/OR/NOT) to precisely target files based on their path.
    - Built-in and custom ignore patterns (`node_modules`, `.git`, etc. are ignored by default).
    - Context-aware matching (e.g., only edit if the preceding line contains specific text).
    - Dry-run mode to preview changes before applying them.
  - Inputs:
    - `targets` (array): Files, folders, or glob patterns to edit.
    - `edits` (array): A list of find-and-replace operations with optional conditions and context.
    - `ignorePatterns` (array, optional): Additional patterns to ignore.
    - `dryRun` (boolean, optional): Preview changes without saving.
  - Returns a comprehensive diff of all changes across all modified files.

- **directory_tree**
  - Generate a compact ASCII tree representation of directory structure
  - Input: `path` / `file_path` / `filepath` (string): Directory location
  - Returns ASCII tree with visual hierarchy and intelligent filtering

- **delete_file**
  - Safely delete files with comprehensive validation
  - Input: `path` / `file_path` / `filepath` (string): File to delete
  - Returns success message upon deletion
  - Security: File must exist and be within allowed directories

- **rename_file** ⭐ *Enhanced with Advanced Programming Techniques*
  - Renames or moves a file from a source path to a destination path
  - Inputs:
    - `source_path` (string, required): Full path of the file to be renamed/moved
    - `destination_path` (string, required): New full path for the file
  - Returns success message upon successful renaming
  - Advanced Programming Techniques: Design by Contract, Defensive Programming, Type-Driven Development

- **search_files_and_folders**
  - Recursively searches for files and folders with comprehensive filtering
  - Inputs:
    - `search_term` (string, required): Search query with glob pattern support
    - `path` (string, optional): Directory to search in
    - `search_type` (enum, optional): Filter for 'files', 'folders', or 'both'
    - `case_sensitive` (boolean, optional): Toggle case sensitivity
    - `include_hidden` (boolean, optional): Include hidden files and folders
  - Returns JSON array of matching paths

### Process Management Tools

- **list_processes**
  - List all running processes with resource usage information
  - Returns JSON array with PID, name, CPU usage, and memory consumption
  - Security: Read-only operation with comprehensive system monitoring

- **kill_process**
  - Terminate a running process by its Process ID (PID)
  - Input: `pid` (number, required): Process ID to terminate
  - Returns confirmation of termination signal sent
  - Security: Dangerous operation with appropriate warnings and confirmations

### Terminal Session Tools

- **execute_command**
  - Execute shell commands with persistent session management
  - Inputs:
    - `command` (string, required): Command or program to execute
    - `shell` (string, optional): Shell to use for execution
    - `timeout_ms` (number, optional): Command timeout in milliseconds
  - Returns session ID for tracking and output retrieval
  - Security: Commands executed within allowed directory context

- **read_output**
  - Read output from running terminal sessions with optional search functionality
  - Inputs:
    - `pid` (number, required): Session process ID to read output from
    - `search_pattern` (string, optional): Text or regex pattern to search for in output
    - `is_regex` (boolean, optional): Set to true if search_pattern is a regular expression (default: false)
    - `case_sensitive` (boolean, optional): Set to true for case-sensitive search (default: false)
    - `search_target` (enum, optional): Target stream to search - 'stdout', 'stderr', or 'both' (default: 'both')
  - Returns session output or structured search results with matching lines and line numbers
  - Enhanced Features:
    - **Text Pattern Search**: Find specific text in terminal output with intelligent escaping
    - **Regex Pattern Search**: Advanced pattern matching with full regex support
    - **Search Target Selection**: Search stdout, stderr, or both streams independently
    - **Case Sensitivity Control**: Toggle case-sensitive or case-insensitive searching
    - **Structured Results**: Returns match count, line numbers, and matching text for easy parsing
    - **Backward Compatibility**: Maintains full compatibility when no search parameters provided
  - Security: Read-only access to session output with comprehensive input validation

- **list_sessions**
  - List all active terminal sessions
  - Returns JSON array of active sessions with details
  - Security: Read-only operation showing session metadata

- **force_terminate**
  - Forcibly terminate a running terminal session
  - Input: `pid` (number, required): Session process ID to terminate
  - Returns confirmation of termination
  - Security: Session cleanup with proper resource management

### Content Search Tools

- **search_code**
  - Search for text patterns within file contents using ripgrep
  - Inputs:
    - `pattern` (string, required): Text or regex pattern to search for
    - `path` (string, required): Directory to search within
    - `context_lines` (number, optional): Lines of context around matches
    - `file_pattern` (string, optional): File pattern filter
    - `ignore_case` (boolean, optional): Case-insensitive search
    - `include_hidden` (boolean, optional): Include hidden files
    - `max_results` (number, optional): Maximum number of results
  - Returns search results with file paths, line numbers, and context
  - Security: Search confined to allowed directories

### 🔧 Package Management Tools

- **npm_install**
  - Install npm dependencies with automatic lock file management and security validation
  - Inputs:
    - `packages` (string[], optional): Specific packages to install (if empty, installs from package.json)
    - `dev` (boolean, optional): Install as development dependencies
    - `global` (boolean, optional): Install packages globally
    - `exact` (boolean, optional): Install exact versions
  - Returns installation status and dependency tree information
  - Security: Validates package.json and prevents malicious package installation

- **npm_scripts**
  - Execute package.json scripts with real-time output streaming
  - Inputs:
    - `script` (string, required): Script name from package.json
    - `args` (string[], optional): Additional arguments to pass to the script
  - Returns script execution output and exit status
  - Security: Validates script existence and monitors execution

- **npm_audit**
  - Perform security vulnerability scanning of npm dependencies
  - Returns detailed vulnerability report with severity levels and remediation suggestions
  - Security: Identifies and reports security vulnerabilities in the dependency tree

- **npm_outdated**
  - Check for package updates and version compatibility
  - Returns list of outdated packages with current, wanted, and latest versions
  - Security: Helps maintain up-to-date dependencies with security patches

- **pip_install**
  - Install Python packages with virtual environment support
  - Inputs:
    - `packages` (string[], required): Python packages to install
    - `requirements_file` (string, optional): Install from requirements.txt
    - `user` (boolean, optional): Install to user site-packages
    - `upgrade` (boolean, optional): Upgrade existing packages
  - Returns installation status and package information
  - Security: Validates package sources and manages dependencies safely

- **dependency_info**
  - Show detailed information about installed packages
  - Inputs:
    - `package` (string, required): Package name to analyze
    - `package_manager` (enum, required): 'npm' or 'pip'
  - Returns comprehensive package metadata, dependencies, and security information
  - Security: Provides transparency into package dependencies and potential risks

### 🌐 Network & API Tools

- **check_port**
  - Check what services are running on specific network ports
  - Inputs:
    - `port` (number, required): Port number to check
    - `host` (string, optional): Host to check (defaults to localhost)
  - Returns service information and connection status
  - Security: Network reconnaissance confined to localhost and specified hosts

- **http_request**
  - Make HTTP requests for API testing and development
  - Inputs:
    - `url` (string, required): Target URL for the request
    - `method` (enum, optional): HTTP method (GET, POST, PUT, DELETE, etc.)
    - `headers` (object, optional): Request headers
    - `body` (string, optional): Request body for POST/PUT requests
    - `timeout` (number, optional): Request timeout in milliseconds
  - Returns response status, headers, and body
  - Security: Validates URLs and prevents requests to internal/sensitive endpoints

- **localhost_services**
  - Detect and list local development servers and services
  - Returns comprehensive list of running local services with ports and process information
  - Security: Scans only localhost interfaces and common development ports

- **ping_host**
  - Test network connectivity to specified hosts
  - Inputs:
    - `host` (string, required): Hostname or IP address to ping
    - `count` (number, optional): Number of ping packets to send
  - Returns connectivity status and response times
  - Security: Validates hostnames and prevents network abuse

- **dns_lookup**
  - Perform DNS resolution for development domains and troubleshooting
  - Inputs:
    - `hostname` (string, required): Domain name to resolve
    - `record_type` (enum, optional): DNS record type (A, AAAA, MX, TXT, etc.)
  - Returns DNS resolution results and record information
  - Security: Validates domain names and prevents DNS enumeration attacks

### 🔍 Code Analysis Tools

- **lint_code**
  - Run code linters (ESLint, Pylint, etc.) for code quality analysis
  - Inputs:
    - `path` (string, required): File or directory to lint
    - `linter` (enum, optional): Specific linter to use (auto-detected by default)
    - `fix` (boolean, optional): Automatically fix linting issues
    - `config` (string, optional): Path to custom linter configuration
  - Returns linting results with issues, warnings, and suggestions
  - Security: Validates file paths and linter configurations

- **format_code**
  - Format code using tools like Prettier, Black, or language-specific formatters
  - Inputs:
    - `path` (string, required): File or directory to format
    - `formatter` (enum, optional): Specific formatter to use (auto-detected by default)
    - `config` (string, optional): Path to formatter configuration
  - Returns formatting results and any issues encountered
  - Security: Validates file paths and formatter configurations

- **code_metrics**
  - Analyze code complexity, lines of code, and other metrics
  - Inputs:
    - `path` (string, required): File or directory to analyze
    - `include_tests` (boolean, optional): Include test files in analysis
  - Returns detailed code metrics including complexity, maintainability index, and technical debt
  - Security: Confined to allowed directories with comprehensive validation

- **find_duplicates**
  - Detect copy-paste code and structural duplicates
  - Inputs:
    - `path` (string, required): Directory to scan for duplicates
    - `min_lines` (number, optional): Minimum lines for duplicate detection
    - `language` (string, optional): Programming language for syntax-aware detection
  - Returns list of duplicate code blocks with locations and similarity scores
  - Security: Validates scan directories and prevents excessive resource usage

- **type_check**
  - Perform TypeScript/mypy type validation and analysis
  - Inputs:
    - `path` (string, required): File or directory to type check
    - `strict` (boolean, optional): Enable strict type checking mode
    - `config` (string, optional): Path to type checker configuration
  - Returns type checking results with errors, warnings, and suggestions
  - Security: Validates configuration files and prevents malicious type definitions

### 📁 File Monitoring Tools

- **watch_files**
  - Monitor file changes with pattern matching and real-time notifications
  - Inputs:
    - `path` (string, required): Directory or file to watch
    - `patterns` (string[], optional): Glob patterns for files to watch
    - `ignore_patterns` (string[], optional): Patterns to ignore
    - `recursive` (boolean, optional): Watch subdirectories recursively
  - Returns real-time file change events with timestamps and change types
  - Security: Confined to allowed directories with resource usage limits

- **tail_logs**
  - Real-time log file monitoring with filtering and highlighting
  - Inputs:
    - `file` (string, required): Log file to monitor
    - `lines` (number, optional): Number of initial lines to display
    - `filter` (string, optional): Filter pattern for log entries
  - Returns streaming log content with real-time updates
  - Security: Validates log file paths and prevents excessive memory usage

- **directory_watch**
  - Comprehensive directory change tracking with detailed event information
  - Inputs:
    - `path` (string, required): Directory to monitor
    - `recursive` (boolean, optional): Monitor subdirectories
    - `events` (string[], optional): Specific events to track (create, modify, delete, move)
  - Returns detailed directory change events with file metadata
  - Security: Resource-limited monitoring with path validation

- **file_diff**
  - Compare file contents and track changes over time
  - Inputs:
    - `file1` (string, required): First file to compare
    - `file2` (string, required): Second file to compare
    - `context_lines` (number, optional): Lines of context around changes
  - Returns detailed diff with additions, deletions, and modifications
  - Security: Validates file paths and prevents large file processing abuse

### 🧪 Testing Tools

- **run_tests**
  - Execute test suites (Jest, pytest, etc.) with comprehensive reporting
  - Inputs:
    - `test_runner` (enum, optional): Test framework to use (auto-detected by default)
    - `path` (string, optional): Specific test files or directories
    - `pattern` (string, optional): Test name pattern to match
    - `coverage` (boolean, optional): Enable code coverage reporting
  - Returns test results with pass/fail status, execution times, and coverage data
  - Security: Validates test configurations and prevents malicious test execution

- **test_coverage**
  - Generate detailed code coverage reports with multiple output formats
  - Inputs:
    - `path` (string, optional): Directory to analyze coverage for
    - `format` (enum, optional): Output format (html, json, lcov, text)
    - `threshold` (number, optional): Minimum coverage threshold
  - Returns coverage statistics and detailed reports
  - Security: Validates paths and prevents unauthorized file access

- **test_watch**
  - Continuous testing with file monitoring and automatic test execution
  - Inputs:
    - `watch_paths` (string[], optional): Directories to watch for changes
    - `test_pattern` (string, optional): Pattern for test files to execute
  - Returns continuous test results with change detection and execution status
  - Security: Resource-limited watching with path validation

- **benchmark**
  - Performance testing and profiling for code optimization
  - Inputs:
    - `target` (string, required): Function, file, or command to benchmark
    - `iterations` (number, optional): Number of benchmark iterations
    - `warmup` (number, optional): Warmup iterations before measurement
  - Returns performance metrics including execution time, memory usage, and statistical analysis
  - Security: Validates benchmark targets and prevents resource exhaustion

### Utility Tools

- **list_allowed_directories**
  - List all directories the server is allowed to access
  - Returns formatted list of allowed directories with security context

## Testing and Development

### FastMCP Development Tools

```bash
# Install dependencies
npm install

# Interactive development and testing (modular architecture)
npx fastmcp dev src/index.ts -- /path/to/allowed/directory

# Web UI inspection with MCP Inspector  
npx fastmcp inspect src/index.ts -- /path/to/allowed/directory

# TypeScript compilation and build
npm run build
npm run watch

# Module-specific testing (development)
npm run test:filesystem
npm run test:process  
npm run test:terminal
npm run test:package-management
npm run test:network-api
npm run test:code-analysis
npm run test:file-monitoring
npm run test:testing
```

### Development Advantages
- **Built-in CLI**: Interactive testing environment for rapid development
- **MCP Inspector Integration**: Web UI for comprehensive tool testing and debugging
- **Enhanced Error Reporting**: Detailed error messages during development
- **Session Management**: Built-in debugging capabilities for client sessions

## Usage with Claude Desktop

FastMCP implementation maintains full compatibility with Claude Desktop while providing enhanced development experience.

Add this to your `claude_desktop_config.json`:

### NPX (Recommended for Development)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/your/src/index.ts",
        "/Users/username/Desktop",
        "/path/to/other/allowed/dir"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Docker
Note: all directories must be mounted to `/projects` by default.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--mount", "type=bind,src=/Users/username/Desktop,dst=/projects/Desktop",
        "--mount", "type=bind,src=/path/to/other/allowed/dir,dst=/projects/other/allowed/dir,ro",
        "--mount", "type=bind,src=/path/to/file.txt,dst=/projects/path/to/file.txt",
        "mcp/filesystem",
        "/projects"
      ]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/path/to/other/allowed/dir"
      ]
    }
  }
}
```

## Build

Docker build:

```bash
docker build -t mcp/filesystem -f src/filesystem/Dockerfile .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
