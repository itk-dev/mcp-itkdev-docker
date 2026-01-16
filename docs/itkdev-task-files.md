# ITK Dev Taskfile Patterns

This document describes the Taskfile patterns used in ITK Dev projects.
Tasks are managed using [Task](https://taskfile.dev/) (go-task),
a task runner similar to Make but with YAML configuration.

## Overview

The Taskfile provides:

- Consistent command interface across projects
- Integration with Docker Compose
- Automation of development workflows
- Coding standards enforcement

## Configuration

### Taskfile.yml Structure

```yaml
version: "3"

# Load environment variables from files
dotenv: [".env.local", ".env"]

vars:
  BASE_URL: '{{.TASK_BASE_URL | default .COMPOSE_SERVER_DOMAIN | default .COMPOSE_DOMAIN | default "https://example.local.itkdev.dk"}}'
  DOCKER_COMPOSE: '{{.TASK_DOCKER_COMPOSE | default "docker compose"}}'
  DOCKER_COMPOSE_PROFILES: '{{.TASK_DOCKER_COMPOSE_PROFILES | default ""}}'
  COMPOSER_INSTALL_ARGUMENTS: '{{.TASK_COMPOSER_INSTALL_ARGUMENTS | default ""}}'

tasks:
  default:
    cmds:
      - task --list-all
    silent: true
```

### Variable Hierarchy

Variables can be overridden via environment:

| Variable | Environment Override | Purpose |
|----------|---------------------|---------|
| `BASE_URL` | `TASK_BASE_URL` | Site URL for Drush commands |
| `DOCKER_COMPOSE` | `TASK_DOCKER_COMPOSE` | Docker compose command |
| `DOCKER_COMPOSE_PROFILES` | `TASK_DOCKER_COMPOSE_PROFILES` | Docker profiles to enable |
| `COMPOSER_INSTALL_ARGUMENTS` | `TASK_COMPOSER_INSTALL_ARGUMENTS` | Extra composer install flags |

## Core Tasks

### Docker Compose Wrapper

```yaml
compose:
  cmds:
    - '{{.DOCKER_COMPOSE}} {{if .DOCKER_COMPOSE_PROFILES}}--profile {{.DOCKER_COMPOSE_PROFILES | splitList "," |join " --profile " }}{{end}} {{.CLI_ARGS}}'
  vars:
    DOCKER_COMPOSE_PROFILES: "{{.PROFILES | default .DOCKER_COMPOSE_PROFILES}}"

compose-up:
  cmds:
    - task compose -- up --detach --remove-orphans {{if .COMPOSE_UP_WAIT}}--wait{{end}}
  silent: true
```

Usage:

```bash
# Basic compose commands
task compose -- ps
task compose -- logs -f

# With profiles
PROFILES=dev,oidc task compose-up

# Or via environment variable
TASK_DOCKER_COMPOSE_PROFILES=dev task compose-up
```

### Site Management

```yaml
site-install:
  prompt: "This will reset your setup. Continue?"
  cmds:
    - task compose -- down
    - task compose -- pull
    - task compose-up
    - task composer-install
    - task drush -- --yes site:install --existing-config
    - task: translations:import
    - task drush -- --yes cache:rebuild
    - task assets-build
    - task site-open
    - task site-open-admin
  silent: true

site-update:
  cmds:
    - task compose -- pull
    - task compose-up
    - task composer-install
    - task assets-build
    - task drush -- deploy
    - task: translations:import
    - task drush -- --yes cache:rebuild
  silent: true

site-url:
  cmds:
    - task drush -- browse --no-browser
  silent: true

site-open:
  cmds:
    - if command -v open 2>&1 >/dev/null; then open "$(task site-url)"; else echo "$(task site-url)"; fi
  silent: true

site-open-admin:
  cmds:
    - if command -v open 2>&1 >/dev/null; then open "{{.URL}}"; else echo "{{.URL}}"; fi
  vars:
    URL:
      sh: task drush -- user:login --no-browser
  silent: true
```

Usage:

```bash
# Fresh installation (will prompt for confirmation)
task site-install

# Update existing site
task site-update

# Get site URL
task site-url

# Open site in browser
task site-open

# Get admin login link
task site-open-admin
```

### Composer

```yaml
composer:
  cmds:
    - task compose -- exec phpfpm composer {{.CLI_ARGS}}
  silent: true

composer-install:
  cmds:
    - task composer -- install {{.COMPOSER_INSTALL_ARGUMENTS}} {{.CLI_ARGS}}
  silent: true
```

Usage:

```bash
# Run any composer command
task composer -- require drupal/module

# Install dependencies
task composer-install

# Install with extra arguments
TASK_COMPOSER_INSTALL_ARGUMENTS="--no-dev" task composer-install
```

### Drush (Drupal CLI)

```yaml
drush:
  cmds:
    - >-
      if [[ ! -t 0 ]]; then
        task compose -- exec --no-TTY phpfpm {{.DRUSH_SCRIPT}} --uri={{.BASE_URL}} {{.CLI_ARGS}};
      else
        task compose -- exec phpfpm {{.DRUSH_SCRIPT}} --uri={{.BASE_URL}} {{.CLI_ARGS}};
      fi
  vars:
    DRUSH_SCRIPT: vendor/bin/drush.php
  silent: true
```

Usage:

```bash
# Run drush commands
task drush -- cache:rebuild
task drush -- --yes deploy
task drush -- user:login

# Pipe SQL queries
echo "SELECT * FROM users" | task drush -- sql:query
```

### Asset Building

```yaml
assets-build:
  cmds:
    - |
      if [[ -z "{{.SKIP_BUILD}}" ]]; then
        {{.DOCKER_COMPOSE}} run --rm node npm install --prefix web/themes/custom/<theme-name>
        {{.DOCKER_COMPOSE}} run --rm node npm run build --prefix web/themes/custom/<theme-name>
      fi
  vars:
    SKIP_BUILD: "{{.ASSETS_SKIP_BUILD | default .TASK_ASSETS_SKIP_BUILD}}"

assets-watch:
  cmds:
    - "{{.DOCKER_COMPOSE}} run --rm node npm run watch --prefix web/themes/custom/<theme-name>"
```

Usage:

```bash
# Build assets
task assets-build

# Skip build (useful in CI)
ASSETS_SKIP_BUILD=1 task site-update

# Watch for changes
task assets-watch
```

## Coding Standards

### Unified Check/Apply

```yaml
coding-standards:apply:
  desc: "Apply coding standards"
  cmds:
    - task: coding-standards:javascript:apply
    - task: coding-standards:markdown:apply
    - task: coding-standards:php:apply
    - task: coding-standards:styles:apply
    - task: coding-standards:twig:apply
    - task: coding-standards:yaml:apply
  silent: true

coding-standards:check:
  desc: "Check coding standards"
  cmds:
    - task: coding-standards:javascript:check
    - task: coding-standards:markdown:check
    - task: coding-standards:php:check
    - task: coding-standards:styles:check
    - task: coding-standards:twig:check
    - task: coding-standards:yaml:check
  silent: true
```

### Language-Specific Tasks

```yaml
# PHP (phpcs/phpcbf)
coding-standards:php:apply:
  desc: "Apply coding standards for PHP"
  cmds:
    - docker compose run --rm phpfpm vendor/bin/phpcbf
  silent: true

coding-standards:php:check:
  desc: "Check coding standards for PHP"
  cmds:
    - task: coding-standards:php:apply
    - docker compose run --rm phpfpm vendor/bin/phpcs
  silent: true

# JavaScript (prettier)
coding-standards:javascript:apply:
  desc: "Apply coding standards for JavaScript"
  cmds:
    - docker compose run --rm prettier 'web/themes/custom/**/js/**/*.js' --write

coding-standards:javascript:check:
  desc: "Check coding standards for JavaScript"
  cmds:
    - task: coding-standards:javascript:apply
    - docker compose run --rm prettier 'web/themes/custom/**/js/**/*.js' --check

# Markdown (markdownlint)
coding-standards:markdown:apply:
  desc: "Apply coding standards for Markdown"
  cmds:
    - docker compose run --rm markdownlint markdownlint '**/*.md' --fix

coding-standards:markdown:check:
  desc: "Check coding standards for Markdown"
  cmds:
    - task: coding-standards:markdown:apply
    - docker compose run --rm markdownlint markdownlint '**/*.md'

# Styles (prettier for CSS/SCSS)
coding-standards:styles:apply:
  desc: "Apply coding standards for styles"
  cmds:
    - docker compose run --rm prettier 'web/themes/custom/**/css/**/*.{css,scss}' --write

coding-standards:styles:check:
  desc: "Check coding standards for styles"
  cmds:
    - task: coding-standards:styles:apply
    - docker compose run --rm prettier 'web/themes/custom/**/css/**/*.{css,scss}' --check

# Twig (twig-cs-fixer)
coding-standards:twig:apply:
  desc: "Apply coding standards for Twig"
  cmds:
    - docker compose run --rm phpfpm vendor/bin/twig-cs-fixer fix
  silent: true

coding-standards:twig:check:
  desc: "Check coding standards for Twig"
  cmds:
    - task: coding-standards:twig:apply
    - docker compose run --rm phpfpm vendor/bin/twig-cs-fixer lint
  silent: true

# YAML (prettier)
coding-standards:yaml:apply:
  desc: "Apply coding standards for YAML"
  cmds:
    - docker compose run --rm prettier '**/*.{yml,yaml}' --write

coding-standards:yaml:check:
  desc: "Check coding standards for YAML"
  cmds:
    - task: coding-standards:yaml:apply
    - docker compose run --rm prettier '**/*.{yml,yaml}' --check
```

Usage:

```bash
# Apply all standards
task coding-standards:apply

# Check all standards
task coding-standards:check

# Language-specific
task coding-standards:php:check
task coding-standards:javascript:apply
```

## Code Analysis

```yaml
code-analysis:
  cmds:
    - docker compose run --rm phpfpm vendor/bin/phpstan analyse --configuration=phpstan.neon
    # Check specific modules with higher level
    - docker compose run --rm phpfpm vendor/bin/phpstan analyse --configuration=phpstan.neon --level=9 web/modules/custom/<module>/
```

Usage:

```bash
task code-analysis
```

## Database Operations

```yaml
database-dump:
  cmds:
    - task site-update
    - task drush -- sql:dump --extra-dump='--skip-column-statistics' --structure-tables-list="cache,cache_*,advancedqueue,history,search_*,sessions,watchdog" --gzip --result-file=/app/.docker/drupal/dumps/drupal.sql
```

Usage:

```bash
task database-dump
```

## Development Settings

```yaml
development-settings:do-not-cache-markup-enable:
  desc: "Disable markup cache"
  cmds:
    - task drush -- php:eval "Drupal::keyValue('development_settings')->setMultiple(['disable_rendered_output_cache_bins' => TRUE]);"
    - task drush -- cache:rebuild

development-settings:do-not-cache-markup-disable:
  desc: "Enable markup cache (for production)"
  cmds:
    - task drush -- php:eval "Drupal::keyValue('development_settings')->setMultiple(['disable_rendered_output_cache_bins' => FALSE]);"
    - task drush -- cache:rebuild

development-settings:twig-develoment-mode-enable:
  desc: "Enable Twig development mode"
  cmds:
    - task drush -- php:eval "Drupal::keyValue('development_settings')->setMultiple(['twig_debug' => TRUE, 'twig_cache_disable' => TRUE]);"
    - task drush -- cache:rebuild

development-settings:twig-develoment-mode-disable:
  desc: "Disable Twig development mode"
  cmds:
    - task drush -- php:eval "Drupal::keyValue('development_settings')->setMultiple(['twig_debug' => FALSE, 'twig_cache_disable' => FALSE]);"
    - task drush -- cache:rebuild

development-settings:development:
  desc: "Set cache settings for development"
  cmds:
    - task development-settings:do-not-cache-markup-enable
    - task development-settings:twig-develoment-mode-enable
    - task drush -- cache:rebuild
  silent: true

development-settings:production:
  desc: "Set cache settings for production"
  cmds:
    - task development-settings:do-not-cache-markup-disable
    - task development-settings:twig-develoment-mode-disable
    - task drush -- cache:rebuild
  silent: true
```

Usage:

```bash
# Enable development-friendly settings
task development-settings:development

# Enable production settings locally
task development-settings:production
```

## Translations

```yaml
translations:import:
  cmds:
    - task compose -- exec phpfpm bash -c '(cd web && ../vendor/bin/drush locale:import --type=customized --override=all da ../translations/custom-translations.da.po)'
  silent: true

translations:export:
  cmds:
    - task compose -- exec phpfpm bash -c '(cd web && ../vendor/bin/drush locale:export da --types=customized > ../translations/custom-translations.da.po)'
  silent: true
```

Usage:

```bash
# Import translations
task translations:import

# Export translations
task translations:export
```

## Docker Image Management

```yaml
docker-pull:
  desc: "Pull all development docker images"
  cmds:
    - docker pull jauderho/prettier
    - docker pull peterdavehello/markdownlint
    - task compose -- pull
```

Usage:

```bash
task docker-pull
```

## Fixtures and Test Data

```yaml
fixtures:load:
  prompt: "This will reset your content. Continue?"
  cmds:
    - COMPOSE_PROFILES=<required-profiles> COMPOSE_UP_WAIT=true task compose-up
    - task drush -- --yes pm:enable <fixture-modules>
    - task drush -- --yes content-fixtures:load
    - task drush -- --yes pm:uninstall content_fixtures
    - task compose-up
  silent: true
```

Usage:

```bash
task fixtures:load
```

## Task Patterns

### Prompts for Destructive Operations

```yaml
dangerous-task:
  prompt: "This will reset your setup. Continue?"
  cmds:
    - # destructive commands
```

### Silent Output

Use `silent: true` to suppress command echoing:

```yaml
my-task:
  cmds:
    - echo "hello"
  silent: true
```

### Dynamic Variables

Compute variables from shell commands:

```yaml
my-task:
  vars:
    VALUE:
      sh: some-command-that-outputs-value
  cmds:
    - echo "{{.VALUE}}"
```

### Calling Other Tasks

```yaml
parent-task:
  cmds:
    - task: child-task-1
    - task: child-task-2
    - task drush -- some-command
```

### CLI Arguments

Pass arguments through `{{.CLI_ARGS}}`:

```yaml
my-task:
  cmds:
    - some-command {{.CLI_ARGS}}
```

Usage:

```bash
task my-task -- --flag value
```

## Common Workflows

### New Developer Setup

```bash
# Clone repository
git clone <repo-url>
cd <project>

# Copy environment template
cp .env.example .env.local

# Pull images and start services
task docker-pull
task site-install

# Enable development settings
task development-settings:development
```

### Daily Development

```bash
# Start services
task compose-up

# Update after pulling changes
task site-update

# Watch assets
task assets-watch
```

### Before Committing

```bash
# Apply and check all standards
task coding-standards:apply
task coding-standards:check
task code-analysis
```

### Creating Database Dump

```bash
task database-dump
# Creates .docker/drupal/dumps/drupal.sql.gz
```
