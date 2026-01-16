#!/usr/bin/env node

/**
 * ITK Dev Docker MCP Server
 *
 * Provides AI assistants with access to ITK Dev Docker documentation
 * and tools for project detection and analysis.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root of the itkdev-docker repository (parent of mcp/)
const REPO_ROOT = join(__dirname, "../..");

// Documentation files
const DOCS = {
  cli: {
    path: join(REPO_ROOT, "docs/itkdev-docker-cli.md"),
    name: "ITK Dev Docker CLI",
    description:
      "CLI tool commands, templates, Traefik setup, and complete setup procedures",
  },
  compose: {
    path: join(REPO_ROOT, "docs/itkdev-docker-compose.md"),
    name: "ITK Dev Docker Compose",
    description:
      "Docker Compose patterns, service configurations, and server deployments",
  },
  taskfile: {
    path: join(REPO_ROOT, "docs/itkdev-task-files.md"),
    name: "ITK Dev Taskfile",
    description: "Taskfile automation patterns for development workflows",
  },
};

// Templates directory
const TEMPLATES_DIR = join(REPO_ROOT, "templates");

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: "itkdev-docker",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register resource handlers
  registerResourceHandlers(server);

  // Register tool handlers
  registerToolHandlers(server);

  return server;
}

/**
 * Register handlers for documentation resources
 */
function registerResourceHandlers(server: Server): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: Object.entries(DOCS).map(([key, doc]) => ({
      uri: `itkdev://docs/${key}`,
      name: doc.name,
      description: doc.description,
      mimeType: "text/markdown",
    })),
  }));

  // Read a specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^itkdev:\/\/docs\/(\w+)$/);

    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const docKey = match[1] as keyof typeof DOCS;
    const doc = DOCS[docKey];

    if (!doc) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    if (!existsSync(doc.path)) {
      throw new Error(`Documentation file not found: ${doc.path}`);
    }

    const content = readFileSync(doc.path, "utf-8");

    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: content,
        },
      ],
    };
  });
}

/**
 * Register handlers for tools
 */
function registerToolHandlers(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "itkdev_list_templates",
        description:
          "List all available ITK Dev Docker templates with their PHP versions and characteristics",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "itkdev_detect_project",
        description:
          "Analyze a directory to detect ITK Dev project configuration, template type, PHP version, and framework",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description:
                "Absolute path to the project directory to analyze",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "itkdev_get_template_files",
        description:
          "List all files that would be installed by a specific template",
        inputSchema: {
          type: "object" as const,
          properties: {
            template: {
              type: "string",
              description:
                "Template name (e.g., drupal-11, symfony-6, drupal-module)",
            },
          },
          required: ["template"],
        },
      },
      {
        name: "itkdev_compare_project",
        description:
          "Compare a project's Docker configuration against its template to find missing, outdated, or extra files",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the project directory",
            },
            template: {
              type: "string",
              description:
                "Template to compare against (auto-detected from .env if not provided)",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "itkdev_get_template_content",
        description:
          "Get the content of a specific file from a template",
        inputSchema: {
          type: "object" as const,
          properties: {
            template: {
              type: "string",
              description: "Template name (e.g., drupal-11)",
            },
            file: {
              type: "string",
              description:
                "Relative file path within the template (e.g., docker-compose.yml)",
            },
          },
          required: ["template", "file"],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "itkdev_list_templates":
          return { content: [{ type: "text", text: listTemplates() }] };

        case "itkdev_detect_project":
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  detectProject(args?.path as string),
                  null,
                  2
                ),
              },
            ],
          };

        case "itkdev_get_template_files":
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  getTemplateFiles(args?.template as string),
                  null,
                  2
                ),
              },
            ],
          };

        case "itkdev_compare_project":
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  compareProject(args?.path as string, args?.template as string),
                  null,
                  2
                ),
              },
            ],
          };

        case "itkdev_get_template_content":
          return {
            content: [
              {
                type: "text",
                text: getTemplateContent(
                  args?.template as string,
                  args?.file as string
                ),
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}

/**
 * List all available templates with details
 */
function listTemplates(): string {
  if (!existsSync(TEMPLATES_DIR)) {
    return "Templates directory not found";
  }

  const templates: Array<{
    name: string;
    phpVersion: string | null;
    webRoot: string | null;
    hasMemcached: boolean;
    hasDrush: boolean;
    itkVersion: string | null;
  }> = [];

  const entries = readdirSync(TEMPLATES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const templateName = entry.name;
    const composePath = join(TEMPLATES_DIR, templateName, "docker-compose.yml");

    if (!existsSync(composePath)) continue;

    const content = readFileSync(composePath, "utf-8");

    // Extract details from docker-compose.yml
    const phpMatch = content.match(/itkdev\/php([\d.]+)-fpm/);
    const webRootMatch = content.match(/NGINX_WEB_ROOT:\s*(\/app\S*)/);
    const versionMatch = content.match(/# itk-version:\s*([\d.]+)/);
    const hasMemcached = content.includes("memcached:");
    const hasDrush = content.includes("drush:");

    templates.push({
      name: templateName,
      phpVersion: phpMatch ? phpMatch[1] : null,
      webRoot: webRootMatch ? webRootMatch[1] : null,
      hasMemcached,
      hasDrush,
      itkVersion: versionMatch ? versionMatch[1] : null,
    });
  }

  // Sort by name with version sorting
  templates.sort((a, b) => {
    const aName = a.name.replace(/(\d+)/g, (m) => m.padStart(10, "0"));
    const bName = b.name.replace(/(\d+)/g, (m) => m.padStart(10, "0"));
    return aName.localeCompare(bName);
  });

  // Format output
  let output = "Available ITK Dev Docker Templates:\n\n";
  output +=
    "| Template | PHP | Web Root | Memcached | Drush | ITK Version |\n";
  output +=
    "|----------|-----|----------|-----------|-------|-------------|\n";

  for (const t of templates) {
    output += `| ${t.name} | ${t.phpVersion || "-"} | ${t.webRoot || "-"} | ${t.hasMemcached ? "Yes" : "No"} | ${t.hasDrush ? "Yes" : "No"} | ${t.itkVersion || "-"} |\n`;
  }

  output += `\nTotal: ${templates.length} templates\n`;
  output += `\nUse 'itkdev-docker-compose template:install <name>' to install a template.`;

  return output;
}

/**
 * Detect project configuration from a directory
 */
function detectProject(projectPath: string): object {
  if (!projectPath) {
    throw new Error("Project path is required");
  }

  if (!existsSync(projectPath)) {
    throw new Error(`Path does not exist: ${projectPath}`);
  }

  const result: Record<string, unknown> = {
    path: projectPath,
    isItkDevProject: false,
    hasDockerCompose: false,
    hasEnv: false,
    template: null,
    itkVersion: null,
    projectName: null,
    domain: null,
    framework: null,
    phpVersion: null,
    webRoot: null,
    services: [] as string[],
  };

  // Check for docker-compose.yml
  const composePath = join(projectPath, "docker-compose.yml");
  if (existsSync(composePath)) {
    result.hasDockerCompose = true;
    const content = readFileSync(composePath, "utf-8");

    // Check if it's an ITK Dev compose file
    const versionMatch = content.match(/# itk-version:\s*([\d.]+)/);
    if (versionMatch) {
      result.isItkDevProject = true;
      result.itkVersion = versionMatch[1];
    }

    // Extract PHP version
    const phpMatch = content.match(/itkdev\/php([\d.]+)-fpm/);
    if (phpMatch) result.phpVersion = phpMatch[1];

    // Extract web root
    const webRootMatch = content.match(/NGINX_WEB_ROOT:\s*(\/app\S*)/);
    if (webRootMatch) result.webRoot = webRootMatch[1];

    // Detect services
    const services: string[] = [];
    const serviceMatches = content.matchAll(/^\s{2}(\w+):\s*$/gm);
    for (const match of serviceMatches) {
      if (match[1] !== "networks" && match[1] !== "volumes") {
        services.push(match[1]);
      }
    }
    result.services = services;
  }

  // Check for .env
  const envPath = join(projectPath, ".env");
  if (existsSync(envPath)) {
    result.hasEnv = true;
    const content = readFileSync(envPath, "utf-8");

    const templateMatch = content.match(/ITKDEV_TEMPLATE=(\S+)/);
    if (templateMatch) result.template = templateMatch[1];

    const projectMatch = content.match(/COMPOSE_PROJECT_NAME=(\S+)/);
    if (projectMatch) result.projectName = projectMatch[1];

    const domainMatch = content.match(/COMPOSE_DOMAIN=(\S+)/);
    if (domainMatch) result.domain = domainMatch[1];
  }

  // Detect framework
  if (existsSync(join(projectPath, "web/core/lib/Drupal.php"))) {
    result.framework = "drupal";
    // Try to detect Drupal version
    const drupalPath = join(projectPath, "web/core/lib/Drupal.php");
    const drupalContent = readFileSync(drupalPath, "utf-8");
    const versionMatch = drupalContent.match(/VERSION\s*=\s*'([\d.]+)'/);
    if (versionMatch) {
      result.frameworkVersion = versionMatch[1];
    }
  } else if (existsSync(join(projectPath, "core/lib/Drupal.php"))) {
    // Drupal 7 style (no web/ prefix)
    result.framework = "drupal";
    result.frameworkVersion = "7.x";
  } else if (existsSync(join(projectPath, "bin/console"))) {
    result.framework = "symfony";
    // Try to detect Symfony version from composer.json
    const composerPath = join(projectPath, "composer.json");
    if (existsSync(composerPath)) {
      try {
        const composer = JSON.parse(readFileSync(composerPath, "utf-8"));
        const symfonyVersion =
          composer.require?.["symfony/framework-bundle"] ||
          composer.require?.["symfony/symfony"];
        if (symfonyVersion) {
          result.frameworkVersion = symfonyVersion;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  // Check for Taskfile
  result.hasTaskfile = existsSync(join(projectPath, "Taskfile.yml"));

  // Check for GitHub Actions
  result.hasGitHubActions = existsSync(
    join(projectPath, ".github/workflows")
  );

  return result;
}

/**
 * Get list of files in a template
 */
function getTemplateFiles(template: string): object {
  if (!template) {
    throw new Error("Template name is required");
  }

  const templateDir = join(TEMPLATES_DIR, template);

  if (!existsSync(templateDir)) {
    // List available templates in error message
    const available = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .join(", ");
    throw new Error(
      `Template '${template}' not found. Available: ${available}`
    );
  }

  const files: string[] = [];

  function walk(dir: string, prefix = ""): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  walk(templateDir);

  return {
    template,
    path: templateDir,
    files: files.sort(),
    count: files.length,
  };
}

/**
 * Compare project against template
 */
function compareProject(
  projectPath: string,
  template?: string
): object {
  if (!projectPath) {
    throw new Error("Project path is required");
  }

  if (!existsSync(projectPath)) {
    throw new Error(`Path does not exist: ${projectPath}`);
  }

  // Auto-detect template if not provided
  if (!template) {
    const envPath = join(projectPath, ".env");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      const match = content.match(/ITKDEV_TEMPLATE=(\S+)/);
      if (match) template = match[1];
    }
  }

  if (!template) {
    throw new Error(
      "Could not detect template. Please specify the template parameter."
    );
  }

  const templateDir = join(TEMPLATES_DIR, template);
  if (!existsSync(templateDir)) {
    throw new Error(`Template '${template}' not found`);
  }

  const result: Record<string, unknown> = {
    projectPath,
    template,
    missing: [] as string[],
    outdated: [] as object[],
    matching: [] as string[],
  };

  // Key files to compare
  const keyFiles = [
    "docker-compose.yml",
    "docker-compose.server.yml",
    "docker-compose.dev.yml",
    "docker-compose.redirect.yml",
    ".docker/nginx.conf",
    ".docker/templates/default.conf.template",
  ];

  for (const file of keyFiles) {
    const templateFile = join(templateDir, file);
    const projectFile = join(projectPath, file);

    if (!existsSync(templateFile)) continue;

    if (!existsSync(projectFile)) {
      (result.missing as string[]).push(file);
      continue;
    }

    // Compare itk-version in compose files
    if (file.endsWith(".yml")) {
      const templateContent = readFileSync(templateFile, "utf-8");
      const projectContent = readFileSync(projectFile, "utf-8");

      const templateVersion = templateContent.match(
        /# itk-version:\s*([\d.]+)/
      );
      const projectVersion = projectContent.match(
        /# itk-version:\s*([\d.]+)/
      );

      if (templateVersion && projectVersion) {
        if (templateVersion[1] !== projectVersion[1]) {
          (result.outdated as object[]).push({
            file,
            projectVersion: projectVersion[1],
            templateVersion: templateVersion[1],
          });
        } else {
          (result.matching as string[]).push(file);
        }
      } else if (templateVersion && !projectVersion) {
        (result.outdated as object[]).push({
          file,
          projectVersion: "unknown",
          templateVersion: templateVersion[1],
          note: "Project file missing itk-version comment",
        });
      }
    }
  }

  // Summary
  result.summary = {
    total: keyFiles.length,
    missing: (result.missing as string[]).length,
    outdated: (result.outdated as object[]).length,
    matching: (result.matching as string[]).length,
    upToDate:
      (result.missing as string[]).length === 0 &&
      (result.outdated as object[]).length === 0,
  };

  if (!(result.summary as Record<string, unknown>).upToDate) {
    result.recommendation =
      "Run 'itkdev-docker-compose template:update' to update template files";
  }

  return result;
}

/**
 * Get content of a specific template file
 */
function getTemplateContent(template: string, file: string): string {
  if (!template) {
    throw new Error("Template name is required");
  }
  if (!file) {
    throw new Error("File path is required");
  }

  const filePath = join(TEMPLATES_DIR, template, file);

  if (!existsSync(filePath)) {
    throw new Error(
      `File '${file}' not found in template '${template}'`
    );
  }

  return readFileSync(filePath, "utf-8");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
