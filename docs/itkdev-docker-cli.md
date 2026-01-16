# ITK Dev Docker CLI Tool

This document describes the `itkdev-docker-compose` CLI tool, template system, and infrastructure setup for ITK Dev projects.

## Overview

The `itkdev-docker-compose` CLI tool provides:

- Template installation for new projects
- Unified command interface for Docker operations
- Database and file synchronization from remote servers
- Traefik reverse proxy management
- Development utilities (Xdebug, shell access, etc.)

**Version:** 3.0.0

## Installation

### Prerequisites

Install required dependencies:

```bash
# Shell completion support (required for completions)
brew install bash-completion

# MySQL client for database operations
brew install mysql-client

# Optional but recommended
brew install jq   # Improved Traefik host parsing
brew install pv   # Progress display for database sync
```

Follow the post-install instructions from brew for each package:

```bash
brew info bash-completion
brew info mysql-client
```

### Adding to PATH

Clone the repository and add the scripts directory to your PATH.

**Bash:**

```bash
git clone https://github.com/itk-dev/devops_itkdev-docker.git ~/itkdev-docker
echo 'export PATH="$HOME/itkdev-docker/scripts:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Zsh:**

```bash
git clone https://github.com/itk-dev/devops_itkdev-docker.git ~/itkdev-docker
echo 'export PATH="$HOME/itkdev-docker/scripts:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Shell Completions

**Bash:**

```bash
ln -s ~/itkdev-docker/completion/bash/itkdev-docker-compose-completion.bash \
  $(brew --prefix)/etc/bash_completion.d/itkdev-docker-compose
```

**Zsh:**

```bash
echo 'fpath=(~/itkdev-docker/completion/zsh $fpath)' >> ~/.zshrc
```

### Self-Update

Keep the tool updated:

```bash
itkdev-docker-compose self:update
```

## CLI Commands Reference

### Template Management

#### template:install

Install a template in the current directory:

```bash
# List available templates
itkdev-docker-compose template:install --list

# Install a template
itkdev-docker-compose template:install drupal-11

# Force overwrite existing files
itkdev-docker-compose template:install drupal-11 --force
```

The installer will prompt for:

- Project name (defaults to directory name)
- Domain (defaults to `<project-name>.local.itkdev.dk`)

Creates `.env` file with:

```env
COMPOSE_PROJECT_NAME=<project-name>
COMPOSE_DOMAIN=<project-name>.local.itkdev.dk
ITKDEV_TEMPLATE=<template-name>
```

#### template:update

Update an existing template installation:

```bash
# Update template (reads ITKDEV_TEMPLATE from .env)
itkdev-docker-compose template:update

# Force update without confirmation
itkdev-docker-compose template:update --force
```

### Traefik Reverse Proxy

The Traefik reverse proxy handles domain routing for all local projects.

#### traefik:start

Start the reverse proxy (creates frontend network if needed):

```bash
itkdev-docker-compose traefik:start
```

#### traefik:stop

Stop the reverse proxy:

```bash
itkdev-docker-compose traefik:stop
```

#### traefik:pull

Pull latest Traefik and socket-proxy images:

```bash
itkdev-docker-compose traefik:pull
```

#### traefik:url

Get the Traefik dashboard URL:

```bash
itkdev-docker-compose traefik:url
# Output: http://traefik.local.itkdev.dk:8080
```

#### traefik:open

Open Traefik dashboard in browser:

```bash
itkdev-docker-compose traefik:open
```

#### traefik:logs

View Traefik logs:

```bash
itkdev-docker-compose traefik:logs
```

### URL and Browser Access

#### url

Get URL for a service:

```bash
# Get main site URL
itkdev-docker-compose url

# Get URL for specific service
itkdev-docker-compose url nginx
itkdev-docker-compose url mail 8025
```

#### open

Open service in default browser:

```bash
# Open main site
itkdev-docker-compose open

# Open specific service
itkdev-docker-compose open mail 8025
```

#### mail:url / mail:open

Access the Mailpit web interface:

```bash
itkdev-docker-compose mail:url
itkdev-docker-compose mail:open
```

### Database Operations

#### sql:cli

Open MySQL client connected to the database:

```bash
# Interactive session
itkdev-docker-compose sql:cli

# Execute a query
itkdev-docker-compose sql:cli --table <<< 'SHOW TABLES'

# Run a SQL script
itkdev-docker-compose sql:cli < query.sql
```

#### sql:connect

Print the MySQL connection command:

```bash
itkdev-docker-compose sql:connect
# Output: docker compose exec mariadb mysql --user=db --password=db db
```

#### sql:open

Open database in GUI application (TablePlus, Sequel Pro, etc.):

```bash
itkdev-docker-compose sql:open
```

#### sql:port

Display the exposed MariaDB port:

```bash
itkdev-docker-compose sql:port
# Output: 32768
```

#### sql:log

Enable and tail SQL query logging:

```bash
itkdev-docker-compose sql:log
# Press Ctrl-C to stop logging (automatically disables logging)
```

### Remote Synchronization

Requires environment variables in `.env` or `.env.local`:

```env
REMOTE_HOST=example.com
REMOTE_DB_DUMP_CMD='drush --root=/var/www/html sql-dump'
REMOTE_PATH='/var/www/html/sites/default/files'
REMOTE_EXCLUDE=(styles css js advagg_*)
LOCAL_PATH='web/sites/default/files'
SYNC_DB_POST_SCRIPT='itkdev-docker-compose drush cr'
```

#### sync:db

Synchronize database from remote server:

```bash
itkdev-docker-compose sync:db
```

Executes `REMOTE_DB_DUMP_CMD` on `REMOTE_HOST` and imports to local database.
Runs `SYNC_DB_POST_SCRIPT` after import if defined.

#### sync:files

Synchronize files from remote server:

```bash
itkdev-docker-compose sync:files
```

Uses rsync to copy `REMOTE_PATH` to `LOCAL_PATH`, respecting `REMOTE_EXCLUDE` patterns.

#### sync

Synchronize both database and files:

```bash
itkdev-docker-compose sync
```

### PHP and Development Commands

#### drush

Run Drush commands:

```bash
itkdev-docker-compose drush cache:rebuild
itkdev-docker-compose drush --yes deploy
itkdev-docker-compose drush user:login
```

Automatically detects whether to use `vendor/bin/drush` or the drush container (Drupal 7).

#### composer

Run Composer commands:

```bash
itkdev-docker-compose composer install
itkdev-docker-compose composer require drupal/module
itkdev-docker-compose composer update --with-dependencies
```

#### php

Run PHP commands:

```bash
itkdev-docker-compose php -v
itkdev-docker-compose php script.php
```

#### bin/*and vendor/bin/*

Run any binary from the project:

```bash
itkdev-docker-compose bin/console cache:clear
itkdev-docker-compose vendor/bin/phpcs
itkdev-docker-compose vendor/bin/phpstan analyse
```

#### shell

Enter a shell inside a container:

```bash
# Default: phpfpm
itkdev-docker-compose shell phpfpm

# Other containers
itkdev-docker-compose shell nginx
itkdev-docker-compose shell mariadb
```

### Debugging

#### xdebug

Start containers with Xdebug enabled (interactive mode):

```bash
itkdev-docker-compose xdebug
```

Displays IDE configuration instructions for PhpStorm and VS Code.
Press Ctrl-C to restart containers with Xdebug disabled.

#### xdebug3

Start containers with Xdebug enabled (detached mode):

```bash
itkdev-docker-compose xdebug3
```

### System Commands

#### hosts:insert

Add domain to /etc/hosts:

```bash
itkdev-docker-compose hosts:insert
# Adds: 0.0.0.0 <COMPOSE_DOMAIN> # itkdev-docker-compose
```

#### images:pull

Update all Docker images:

```bash
itkdev-docker-compose images:pull
```

#### down

Stop and remove containers, networks, and volumes:

```bash
itkdev-docker-compose down
```

#### version

Display tool version:

```bash
itkdev-docker-compose version
# Output: Version: 3.0.0
```

### Docker Compose Passthrough

Any unrecognized command is passed to `docker compose`:

```bash
itkdev-docker-compose up -d
itkdev-docker-compose ps
itkdev-docker-compose logs -f phpfpm
itkdev-docker-compose exec phpfpm bash
```

## Available Templates

### Template Comparison

| Template | PHP | Web Root | Database | Memcached | Drush Container | Mail |
|----------|-----|----------|----------|-----------|-----------------|------|
| `drupal-7` | 7.4 | `/app` | Yes | Yes | Yes | Yes |
| `drupal-8` | 7.2-8.3 | `/app/web` | Yes | Yes | No | Yes |
| `drupal-9` | 7.4+ | `/app/web` | Yes | Yes | No | Yes |
| `drupal-10` | 8.3 | `/app/web` | Yes | Yes | No | Yes |
| `drupal-11` | 8.4 | `/app/web` | Yes | Yes | No | Yes |
| `drupal-module` | 8.4 | `/app` | No | No | No | No |
| `symfony-3` | 7.2 | `/app/web` | Yes | Yes | No | Yes |
| `symfony-4` | 7.4 | `/app/web` | Yes | Yes | No | Yes |
| `symfony-6` | 8.4 | `/app/public` | Yes | No | No | Yes |

### Template Selection Guide

**Drupal Projects:**

- New Drupal 11 projects: `drupal-11`
- New Drupal 10 projects: `drupal-10`
- Legacy Drupal 7 maintenance: `drupal-7`
- Drupal module/theme development: `drupal-module`

**Symfony Projects:**

- New Symfony 6/7 projects: `symfony-6`
- Legacy Symfony 4 maintenance: `symfony-4`

### Drupal 7 Specifics

Drupal 7 template has unique characteristics:

- Web root is `/app` (not `/app/web`)
- Includes dedicated `drush` container (`itkdev/drush6:latest`)
- Uses shared `drush-cache` volume
- HTTPS redirect disabled by default

### Drupal 11 Specifics

Drupal 11 template (newest):

- PHP 8.4
- HTTPS redirect enabled by default
- Uses `vendor/bin/drush` (no drush container)
- Depends on mariadb and memcached health checks

### Symfony 6 Specifics

Symfony 6 template:

- Web root is `/app/public` (Symfony standard)
- No memcached dependency (phpfpm only depends on mariadb)
- PHP 8.4

### Drupal Module Template

Minimal template for module development:

- Only phpfpm and nginx services
- No database, cache, or mail services
- Suitable for isolated module testing

## Template File Structure

When you run `template:install`, these files are created:

```text
project/
├── .env                           # Created interactively (if not exists)
├── docker-compose.yml             # Base service configuration
├── docker-compose.dev.yml         # Server dev/staging overrides
├── docker-compose.redirect.yml    # WWW to non-WWW redirect config
├── docker-compose.server.yml      # Production server configuration
└── .docker/
    ├── data/                      # Persistent data directory
    │   └── .gitignore             # Ignores data files
    ├── nginx.conf                 # Main nginx config (for production)
    └── templates/
        └── default.conf.template  # Nginx vhost template
```

### File Purposes

| File | Purpose | Used By |
|------|---------|---------|
| `docker-compose.yml` | Base services for local development | `docker compose up` |
| `docker-compose.dev.yml` | Staging server with basic auth, mail | `itkdev-docker-compose-server` |
| `docker-compose.redirect.yml` | WWW redirect middleware | `itkdev-docker-compose-server` |
| `docker-compose.server.yml` | Production with HTTPS, no DB | `itkdev-docker-compose-server` |
| `.docker/nginx.conf` | Production nginx main config | Server deployments |
| `.docker/templates/default.conf.template` | Nginx vhost with env substitution | All environments |

## Traefik Infrastructure

### Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Docker Network: frontend               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │   Project A  │  │   Project B  │  │   Project C  │  ││
│  │  │    nginx     │  │    nginx     │  │    nginx     │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │          │                │                │            ││
│  │          └────────────────┼────────────────┘            ││
│  │                           │                              ││
│  │                    ┌──────────────┐                      ││
│  │                    │   Traefik    │ :80, :443, :8080     ││
│  │                    └──────────────┘                      ││
│  │                           │                              ││
│  │                    ┌──────────────┐                      ││
│  │                    │ Socket Proxy │ (Docker socket)      ││
│  │                    └──────────────┘                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Traefik Configuration

**Entry Points:**

| Name | Port | Purpose |
|------|------|---------|
| `web` | 80 | HTTP traffic |
| `websecure` | 443 | HTTPS traffic (TLS enabled) |
| Dashboard | 8080 | Traefik admin UI |

**SSL Certificates:**

Self-signed wildcard certificate for `*.local.itkdev.dk` located at:

- Certificate: `traefik/ssl/docker.crt`
- Key: `traefik/ssl/docker.key`

**Trust Certificate on macOS:**

1. Open `traefik/ssl/docker.crt` in Keychain Access
2. Right-click the certificate and select "Get Info"
3. Expand "Trust" section
4. Set "When using this certificate" to "Always Trust"

**Generate Custom Certificate:**

```bash
openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:2048 \
  -keyout docker.key -out docker.crt \
  -subj "/CN=*.example.local" \
  -reqexts SAN -extensions SAN \
  -config <(cat /usr/local/etc/openssl/openssl.cnf \
    <(printf '[SAN]\nsubjectAltName=DNS:*.example.local'))
```

### Socket Proxy Security

Traefik connects to Docker via a socket proxy (`itkdev/docker-socket-proxy`) instead of direct socket access:

- Limits Docker API exposure
- Only `CONTAINERS=1` permission enabled
- Runs on internal `proxy` network

## GitHub Actions Workflows

Templates include GitHub Actions workflow files for CI/CD.

### Available Workflows

**Universal (all project types):**

| Workflow | Purpose |
|----------|---------|
| `changelog.yaml` | Verify CHANGELOG.md is updated |
| `composer.yaml` | Validate composer.json/lock |
| `markdown.yaml` | Lint markdown files |
| `yaml.yaml` | Lint YAML files |
| `twig.yaml` | Lint Twig templates |

**Drupal Projects:**

| Workflow | Purpose |
|----------|---------|
| `drupal/php.yaml` | PHP coding standards (drupal/coder) |
| `drupal/javascript.yaml` | JavaScript linting (Prettier) |
| `drupal/styles.yaml` | CSS/SCSS linting |
| `drupal/site.yaml` | Site install/update tests |

**Drupal Modules:**

| Workflow | Purpose |
|----------|---------|
| `drupal-module/php.yaml` | PHP coding standards |
| `drupal-module/javascript.yaml` | JavaScript linting |
| `drupal-module/styles.yaml` | CSS/SCSS linting |

**Symfony Projects:**

| Workflow | Purpose |
|----------|---------|
| `symfony/php.yaml` | PHP coding standards (PHP-CS-Fixer) |
| `symfony/javascript.yaml` | JavaScript linting |
| `symfony/styles.yaml` | CSS/SCSS linting |

### Workflow Requirements

**Drupal PHP workflow requires:**

```bash
# Add drupal/coder as dev dependency
docker compose run --rm phpfpm composer require --dev drupal/coder
```

**Symfony PHP workflow requires:**

```bash
# Add friendsofphp/php-cs-fixer as dev dependency
docker compose run --rm phpfpm composer require --dev friendsofphp/php-cs-fixer
```

### Workflow Assumptions

All workflows assume:

1. A `phpfpm` service exists in docker-compose.yml
2. `COMPOSE_USER: runner` works in CI environment
3. `docker network create frontend` can be run

The `drupal/site.yaml` workflow additionally assumes:

1. Database and dependent services are defined
2. Site can be installed with `drush site:install --existing-config`
3. Site can be updated with `drush deploy`

## Configuration Files

### PHP CodeSniffer (Drupal)

Template location: `config/drupal/php/.phpcs.xml.dist`

```xml
<?xml version="1.0"?>
<ruleset name="PHP_CodeSniffer">
  <description>The coding standard.</description>

  <file>web/modules/custom/</file>
  <file>web/themes/custom/</file>

  <exclude-pattern>node_modules</exclude-pattern>
  <exclude-pattern>vendor</exclude-pattern>
  <exclude-pattern>web/*/custom/*/build/</exclude-pattern>

  <arg name="extensions" value="php,module,inc,install,test,profile,theme,css,info,txt,yml"/>

  <config name="drupal_core_version" value="11"/>

  <rule ref="Drupal">
    <exclude name="Drupal.InfoFiles.AutoAddedKeys.Project"/>
    <exclude name="Drupal.InfoFiles.AutoAddedKeys.Version"/>
  </rule>
</ruleset>
```

### PHP-CS-Fixer (Symfony)

Template location: `config/symfony/php/.php-cs-fixer.dist.php`

Standard Symfony PHP-CS-Fixer configuration.

### Twig CS Fixer

Template location: `config/drupal/twig/.twig-cs-fixer.dist.php`

Twig template linting configuration.

### Markdown Lint

Template location: `config/markdown/.markdownlint.jsonc`

Markdown linting rules configuration.

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `COMPOSE_PROJECT_NAME` | Docker project namespace | `myproject` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COMPOSE_DOMAIN` | Local development domain | `<project>.docker.localhost` |
| `COMPOSE_USER` | User inside containers | `deploy` |
| `COMPOSE_SERVER_DOMAIN` | Server deployment domain | - |
| `PHP_XDEBUG_MODE` | Xdebug mode | `off` |

### Sync Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REMOTE_HOST` | SSH host for sync | `example.com` |
| `REMOTE_DB_DUMP_CMD` | Database dump command | `drush sql-dump` |
| `REMOTE_PATH` | Remote files path | `/var/www/files` |
| `REMOTE_EXCLUDE` | Rsync exclude patterns | `(styles css js)` |
| `LOCAL_PATH` | Local files path | `web/sites/default/files` |
| `SYNC_DB_POST_SCRIPT` | Post-sync script | `drush cr` |

### Local Overrides

Create `.env.local` for machine-specific settings (not committed to git):

```env
# Override sync host for different environment
REMOTE_HOST=staging.example.com

# Enable Xdebug by default
PHP_XDEBUG_MODE=debug

# Different domain
COMPOSE_DOMAIN=myproject.local
```

## Complete Setup Workflows

### New Drupal 11 Project

```bash
# 1. Start Traefik (once per machine)
itkdev-docker-compose traefik:start

# 2. Create project directory
mkdir myproject && cd myproject

# 3. Install Drupal via Composer
composer create-project drupal/recommended-project .

# 4. Install Docker template
itkdev-docker-compose template:install drupal-11

# 5. Start containers
docker compose up -d

# 6. Install Drupal
itkdev-docker-compose drush site:install --yes

# 7. Open site
itkdev-docker-compose open
```

### New Symfony 6 Project

```bash
# 1. Start Traefik (once per machine)
itkdev-docker-compose traefik:start

# 2. Create project
composer create-project symfony/skeleton myproject
cd myproject

# 3. Install Docker template
itkdev-docker-compose template:install symfony-6

# 4. Start containers
docker compose up -d

# 5. Open site
itkdev-docker-compose open
```

### Existing Project Setup

```bash
# 1. Clone repository
git clone git@github.com:org/project.git
cd project

# 2. Start Traefik if not running
itkdev-docker-compose traefik:start

# 3. Copy environment template
cp .env.example .env.local

# 4. Pull images and start
docker compose pull
docker compose up -d

# 5. Install dependencies
itkdev-docker-compose composer install

# 6. Sync database from remote (if configured)
itkdev-docker-compose sync:db

# 7. Run site update
itkdev-docker-compose drush deploy

# 8. Open site
itkdev-docker-compose open
```

### Daily Development Workflow

```bash
# Start containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f phpfpm

# Run drush commands
itkdev-docker-compose drush cr
itkdev-docker-compose drush cex

# Enable Xdebug for debugging session
itkdev-docker-compose xdebug

# Open database GUI
itkdev-docker-compose sql:open

# Access mail interface
itkdev-docker-compose mail:open
```

## Troubleshooting

### Traefik Not Running

```bash
# Check if traefik container exists
docker ps -a | grep traefik

# Start traefik
itkdev-docker-compose traefik:start

# Check traefik logs
itkdev-docker-compose traefik:logs
```

### Port Conflicts

If port 80, 443, or 8080 are in use:

```bash
# Find process using port
lsof -i :80

# Stop conflicting service (e.g., Apache)
sudo apachectl stop
```

### Database Connection Issues

```bash
# Check if mariadb is healthy
docker compose ps mariadb

# View mariadb logs
docker compose logs mariadb

# Test connection
itkdev-docker-compose sql:cli <<< 'SELECT 1'
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Make Drupal settings writable
chmod +w web/sites/default
chmod +w web/sites/default/settings.php
```

### Container User Mismatch

If files created in container have wrong ownership:

```bash
# Set COMPOSE_USER in .env.local to match your UID
echo "COMPOSE_USER=$(id -u):$(id -g)" >> .env.local
docker compose up -d --force-recreate
```

### SSL Certificate Not Trusted

1. Open `~/itkdev-docker/traefik/ssl/docker.crt`
2. Add to Keychain Access
3. Set trust to "Always Trust"
4. Restart browser

### Sync Failing

```bash
# Test SSH connection
ssh $REMOTE_HOST "echo 'Connected'"

# Test dump command
ssh $REMOTE_HOST "$REMOTE_DB_DUMP_CMD" | head -20

# Check LOCAL_PATH exists
ls -la $LOCAL_PATH
```
