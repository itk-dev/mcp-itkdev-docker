# ITK Dev Docker MCP Server

Model Context Protocol (MCP) server that provides AI coding assistants with access to
ITK Dev Docker documentation and project analysis tools.

## What is MCP?

MCP (Model Context Protocol) is an open protocol that enables AI assistants like Claude to
access external resources and tools. This server provides:

- **Documentation Resources**: Access to ITK Dev Docker documentation
- **Project Tools**: Analyze, detect, and compare ITK Dev projects

## Installation

### Prerequisites

- Node.js 18 or later
- npm

### Build

```bash
cd mcp
npm install
npm run build
```

### Configure Claude Code

Configure Claude Code using one of these methods:

#### Option 1: User-wide configuration (all projects)

Create or edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "itkdev": {
      "command": "node",
      "args": ["/path/to/itkdev-docker/mcp/dist/index.js"]
    }
  }
}
```

Replace `/path/to/itkdev-docker` with the actual path to your itkdev-docker clone.

#### Option 2: Project-specific configuration

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "itkdev": {
      "command": "node",
      "args": ["/path/to/itkdev-docker/mcp/dist/index.js"]
    }
  }
}
```

#### Option 3: CLI command

```bash
claude mcp add itkdev --scope user -- node /path/to/itkdev-docker/mcp/dist/index.js
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
mcp/
├── src/
│   └── index.ts      # MCP server implementation
├── dist/             # Compiled output (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Server Not Connecting

1. Check that the path in `settings.json` is absolute and correct
2. Ensure `npm run build` completed successfully
3. Check Node.js version (`node --version` should be 18+)
4. Restart Claude Code after configuration changes

### Tools Not Working

1. Verify the itkdev-docker repository is complete (has templates/, documentation files)
2. Check file permissions on the mcp/dist directory
3. Look for error messages in Claude Code's output

### Documentation Not Found

Ensure these files exist in `itkdev-docker/docs/`:

- `docs/itkdev-docker-cli.md`
- `docs/itkdev-docker-compose.md`
- `docs/itkdev-task-files.md`
