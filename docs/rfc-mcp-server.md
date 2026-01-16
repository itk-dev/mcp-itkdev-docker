# RFC: MCP Server for ITK Dev Docker

**Status:** Proposal
**Author:** AI-assisted development
**Date:** 2025-12-20
**Branch:** feature/mcp

## Summary

This RFC proposes adding a Model Context Protocol (MCP) server to the itkdev-docker repository.
The MCP server will provide AI coding assistants (like Claude Code) with structured access to
ITK Dev documentation, project detection capabilities, and template management tools.

## Motivation

### Problem Statement

When developers use AI coding assistants on ITK Dev projects, the assistants lack context about:

1. ITK Dev Docker patterns and conventions
2. Available templates and their differences
3. The `itkdev-docker-compose` CLI tool and its commands
4. Taskfile patterns used across projects
5. How to detect and compare project configurations against templates

This leads to:

- Inconsistent AI-generated configurations
- Manual explanation of ITK Dev patterns in every session
- Inability to leverage AI for project setup/maintenance tasks

### Proposed Solution

Create an MCP server that provides:

1. **Resources**: Documentation accessible to AI assistants
2. **Tools**: Capabilities to detect, analyze, and compare ITK Dev projects

## Background Research

### What is MCP?

Model Context Protocol (MCP) is an open protocol developed by Anthropic that enables AI
applications to connect with external data sources and tools. It provides a standardized way to:

- Expose resources (documents, data) to AI models
- Provide tools that AI can invoke
- Maintain context across interactions

### Hosting Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **Local stdio** | Process spawned by Claude Code, communicates via stdin/stdout | Simple, secure, no infrastructure | Per-machine setup |
| **npx package** | Published to npm, run via npx | Easy distribution | Requires npm maintenance |
| **HTTP/SSE server** | Persistent network service | Centralized, team-wide | Infrastructure overhead, security concerns |
| **Docker container** | Packaged in Docker image | Portable | Additional complexity |

### Chosen Approach: Local Stdio

We chose the **local stdio** approach because:

1. **Simplicity**: No network infrastructure required
2. **Security**: No exposed ports or authentication needed
3. **Reliability**: No dependency on external services
4. **Integration**: Natural fit with existing itkdev-docker repository
5. **Offline support**: Works without network access

The MCP server will be added to the existing itkdev-docker repository, allowing developers to
configure it once after cloning/updating the repo.

## Documentation Created

As part of this research, we created comprehensive documentation:

### 1. itkdev-docker-cli.md

Documents the `itkdev-docker-compose` CLI tool:

- Installation and prerequisites
- All 25+ CLI commands with examples
- Available templates and selection guide
- Template file structure
- Traefik infrastructure setup
- Environment variables reference
- Complete setup workflows
- Troubleshooting guide

### 2. itkdev-docker-compose.md

Documents Docker Compose patterns:

- Service configurations (mariadb, phpfpm, nginx, memcached, mail)
- Environment configuration
- Profile-based services
- OIDC mock setup
- Server configurations
- Traefik labels and routing
- Nginx configuration patterns

### 3. itkdev-task-files.md

Documents Taskfile automation:

- Taskfile.yml structure
- Docker Compose wrapper tasks
- Site management tasks
- Coding standards tasks
- Asset building patterns
- Database operations
- Development workflows

## Technical Design

### Repository Structure

```text
itkdev-docker/
├── mcp/                          # NEW: MCP server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts              # MCP server implementation
│   └── dist/                     # Compiled JavaScript (gitignored)
├── docs/
│   ├── rfc-mcp-server.md         # This document
│   └── github-actions-templates.md
├── scripts/
│   └── itkdev-docker-compose
├── templates/
│   └── [template directories]
├── itkdev-docker-cli.md          # NEW: CLI documentation
├── itkdev-docker-compose.md      # NEW: Compose documentation
└── itkdev-task-files.md          # NEW: Taskfile documentation
```

### MCP Server Capabilities

#### Resources

| URI | Description |
|-----|-------------|
| `itkdev://docs/cli` | CLI tool documentation |
| `itkdev://docs/compose` | Docker Compose patterns |
| `itkdev://docs/taskfile` | Taskfile automation patterns |

#### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `itkdev_list_templates` | List available templates | None |
| `itkdev_detect_project` | Detect project type and configuration | `path` |
| `itkdev_get_template_files` | List files in a template | `template` |
| `itkdev_compare_project` | Compare project against template | `path`, `template` (optional) |

### User Configuration

See [mcp/README.md](../mcp/README.md) for build and configuration instructions.

## Use Cases

### 1. New Project Setup

Developer: "Set up a new Drupal 11 project called 'citizen-portal'"

AI assistant can:

1. Read `itkdev://docs/cli` for setup instructions
2. Use `itkdev_list_templates` to confirm template exists
3. Provide exact commands based on documentation

### 2. Project Analysis

Developer: "Is this project using the latest template version?"

AI assistant can:

1. Use `itkdev_detect_project` to analyze current configuration
2. Use `itkdev_compare_project` to find differences
3. Suggest specific updates needed

### 3. Troubleshooting

Developer: "Docker containers won't start"

AI assistant can:

1. Read documentation for troubleshooting steps
2. Use `itkdev_detect_project` to understand configuration
3. Provide targeted solutions

### 4. Template Migration

Developer: "Upgrade this project from drupal-10 to drupal-11"

AI assistant can:

1. Use `itkdev_compare_project` with both templates
2. Identify specific changes needed
3. Guide through migration steps

## Implementation Plan

### Phase 1: Core Implementation

1. Create MCP server with documentation resources
2. Implement basic tools (list templates, detect project)
3. Add installation documentation to README

### Phase 2: Enhanced Tools

1. Add `itkdev_compare_project` tool
2. Add `itkdev_get_template_files` tool
3. Consider additional tools based on usage

### Phase 3: Distribution (Future)

1. Consider npm package publication
2. Evaluate team adoption and feedback
3. Iterate on tool capabilities

## Alternatives Considered

### 1. CLAUDE.md Files Only

Add CLAUDE.md to each project template pointing to documentation.

**Rejected because:**

- No tool capabilities
- Requires path assumptions
- Less discoverable

### 2. Central HTTP Server

Run MCP server as shared team service.

**Rejected because:**

- Infrastructure overhead
- Single point of failure
- Overkill for current needs

### 3. Separate Repository

Create standalone mcp-itkdev repository.

**Rejected because:**

- Fragmented maintenance
- Documentation sync issues
- Additional repo to manage

## Security Considerations

- MCP server runs locally with user permissions
- No network exposure
- Read-only access to template files
- No credentials or secrets handled

## Open Questions

1. Should we publish to npm for easier distribution?
2. What additional tools would be valuable?
3. Should CLAUDE.md templates also be added to project templates?

## Success Metrics

- Developers can configure MCP server in < 5 minutes
- AI assistants correctly reference ITK Dev patterns
- Reduced time explaining conventions in AI sessions
- Successful project setup/analysis via AI tools

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP Integration](https://docs.anthropic.com/en/docs/claude-code)
