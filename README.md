# Desktop Commander MCP Server (Modular FastMCP Implementation)

**Comprehensive modular Node.js server implementing Model Context Protocol (MCP) using the FastMCP TypeScript framework. Features enterprise-grade filesystem operations, process management, and terminal session handling with advanced programming techniques.**

## Features

### Comprehensive Tool Categories
- **Filesystem Operations**: File reading, writing, editing, copying, moving, and directory management
- **Process Management**: System process listing, monitoring, and termination capabilities  
- **Terminal Integration**: Command execution with session management and output streaming
- **Content Search**: Advanced file and code content searching with ripgrep integration

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
    └── terminal.ts            # Command execution and session management tools
```

- **Clean Separation**: Organized into filesystem, process, and terminal tool categories
- **Reusable Utilities**: Shared security validation and path handling utilities
- **Maintainable Codebase**: Logical organization following enterprise software patterns
- **Scalable Design**: Easy addition of new tool categories and functionality
- **22 Total Tools**: Comprehensive toolset across all categories with advanced programming techniques

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
  - Read output from running terminal sessions
  - Input: `pid` (number, required): Session process ID
  - Returns current output buffer from the session
  - Security: Read-only access to session output

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
