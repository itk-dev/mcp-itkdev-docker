# ITK Dev Docker MCP Server

Model Context Protocol (MCP) server that provides AI coding assistants with access to
ITK Dev Docker documentation and project analysis tools.

## What is MCP?

MCP (Model Context Protocol) is an open protocol that enables AI assistants like Claude to
access external resources and tools. This server provides:

- **Documentation Resources**: Access to ITK Dev Docker documentation
- **Project Tools**: Analyze, detect, and compare ITK Dev projects

## Installation

This MCP server is part of the [ITK Dev Claude Plugins](https://github.com/itk-dev/itkdev-claude-plugins).

### Via Plugin Marketplace (Recommended)

Install through the ITK Dev plugin marketplace:

```bash
/plugin marketplace add itk-dev/itkdev-claude-plugins
/plugin install itkdev-tools@itkdev-marketplace
```

The MCP server will be automatically configured.

### Manual Installation

For development or standalone use:

#### Prerequisites

- Node.js 18 or later
- npm

#### Build

```bash
git clone https://github.com/itk-dev/mcp-itkdev-docker.git
cd mcp-itkdev-docker
npm install
npm run build
```

#### Configure Claude Code

Add to `~/.claude.json` or `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "itkdev-docker": {
      "command": "npx",
      "args": ["-y", "github:itk-dev/mcp-itkdev-docker"]
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "itkdev-docker": {
      "command": "node",
      "args": ["/path/to/mcp-itkdev-docker/dist/index.js"]
    }
  }
}
```

### Verify Installation

Restart Claude Code and check that the MCP server is connected. You can ask Claude:

> "What ITK Dev templates are available?"

Claude should be able to list templates using the `itkdev_list_templates` tool.

## Available Resources

| URI | Description |
|-----|-------------|
| `itkdev://docs/cli` | CLI tool commands, templates, and setup procedures |
| `itkdev://docs/compose` | Docker Compose patterns and configurations |
| `itkdev://docs/taskfile` | Taskfile automation patterns |

## Available Tools

### itkdev_list_templates

List all available ITK Dev Docker templates with their characteristics.

**Example prompt:**
> "What templates are available for Drupal projects?"

### itkdev_detect_project

Analyze a directory to detect ITK Dev project configuration.

**Parameters:**

- `path` (required): Absolute path to the project directory

**Example prompt:**
> "Analyze the project at /Users/me/projects/mysite"

**Returns:**

- Project type (Drupal/Symfony)
- Template in use
- PHP version
- Web root
- Services defined
- ITK version

### itkdev_get_template_files

List all files that would be installed by a template.

**Parameters:**

- `template` (required): Template name (e.g., `drupal-11`)

**Example prompt:**
> "What files does the drupal-11 template include?"

### itkdev_compare_project

Compare a project against its template to find differences.

**Parameters:**

- `path` (required): Absolute path to the project
- `template` (optional): Template to compare against (auto-detected from .env)

**Example prompt:**
> "Is my project at /Users/me/projects/mysite up to date with its template?"

**Returns:**

- Missing files
- Outdated files (with version comparison)
- Matching files
- Update recommendations

### itkdev_get_template_content

Get the content of a specific file from a template.

**Parameters:**

- `template` (required): Template name
- `file` (required): Relative file path

**Example prompt:**
> "Show me the docker-compose.yml from the drupal-11 template"

## Use Cases

### Setting Up a New Project

> "I need to set up a new Drupal 11 project. What template should I use and what are the steps?"

Claude will read the documentation and provide step-by-step instructions.

### Checking Project Status

> "Analyze my project at /path/to/project and tell me if it needs updates"

Claude will detect the project configuration and compare against the template.

### Understanding Configurations

> "What services are included in the drupal-11 template and what do they do?"

Claude will read the documentation and explain each service.

### Troubleshooting

> "My Docker containers won't start. Can you help debug?"

Claude will read troubleshooting documentation and analyze your project configuration.

## Development

### Watch Mode

```bash
npm run dev
```

Rebuilds on file changes.

### Project Structure

```text
mcp-itkdev-docker/
├── src/
│   └── index.ts      # MCP server implementation
├── dist/             # Compiled output (gitignored)
├── docs/             # Documentation served as MCP resources
│   ├── itkdev-docker-cli.md
│   ├── itkdev-docker-compose.md
│   └── itkdev-task-files.md
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Server Not Connecting

1. If using the plugin, verify installation with `/plugin list`
2. For manual installation, check that the path is absolute and correct
3. Check Node.js version (`node --version` should be 18+)
4. Restart Claude Code after configuration changes

### Tools Not Working

1. Verify the MCP server is running (check Claude Code status)
2. For manual installation, ensure `npm run build` completed successfully
3. Look for error messages in Claude Code's output
