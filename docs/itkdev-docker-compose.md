# ITK Dev Docker Compose Setup

This document describes the Docker Compose patterns used in ITK Dev projects.
It covers both local development and server deployment configurations.

## Overview

ITK Dev projects use a layered Docker Compose approach:

- **Local development**: Standard `docker compose` with multiple compose files
- **Server deployments**: `itkdev-docker-compose-server` CLI wrapper for production environments

## Version Tracking

ITK Dev compose files include a version comment at the top for tracking template versions:

```yaml
# itk-version: 3.2.1
networks:
  frontend:
    external: true
  # ...
```

This helps identify which template version a project is based on and when updates are needed.

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root:

```env
COMPOSE_PROJECT_NAME=<project-name>
COMPOSE_DOMAIN=<project-name>.local.itkdev.dk
ITKDEV_TEMPLATE=<template-type>
```

| Variable | Description | Example |
|----------|-------------|---------|
| `COMPOSE_PROJECT_NAME` | Docker project namespace | `myproject` |
| `COMPOSE_DOMAIN` | Local development domain | `myproject.local.itkdev.dk` |
| `ITKDEV_TEMPLATE` | Template type identifier | `drupal-10`, `symfony` |

### Local Overrides

Create `.env.local` for environment-specific settings (not committed to git):

```env
COMPOSE_SERVER_DOMAIN=staging.example.com
PHP_XDEBUG_MODE=debug
```

## Docker Compose File Structure

### Base Configuration (docker-compose.yml)

The base file defines core services. Standard structure:

```yaml
networks:
  frontend:
    external: true
  app:
    driver: bridge
    internal: false

services:
  mariadb:
    image: itkdev/mariadb:latest
    networks:
      - app
    ports:
      - "3306"
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      start_period: 10s
      interval: 10s
      timeout: 5s
      retries: 3
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_USER=db
      - MYSQL_PASSWORD=db
      - MYSQL_DATABASE=db
    labels:
      com.symfony.server.service-prefix: "DATABASE"

  phpfpm:
    image: itkdev/php8.3-fpm:latest
    user: ${COMPOSE_USER:-deploy}
    networks:
      - app
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - PHP_XDEBUG_MODE=${PHP_XDEBUG_MODE:-off}
      - PHP_MAX_EXECUTION_TIME=30
      - PHP_MEMORY_LIMIT=256M
      - PHP_SENDMAIL_PATH=/usr/bin/msmtp --host=mail --port=1025 --read-recipients --read-envelope-from
      - DOCKER_HOST_DOMAIN=${COMPOSE_DOMAIN}
      - PHP_IDE_CONFIG=serverName=localhost
      - DRUSH_OPTIONS_URI=http://${COMPOSE_DOMAIN}
    depends_on:
      mariadb:
        condition: service_healthy
      memcached:
        condition: service_healthy
    volumes:
      - .:/app

  nginx:
    image: nginxinc/nginx-unprivileged:alpine
    networks:
      - app
      - frontend
    depends_on:
      - phpfpm
    ports:
      - "8080"
    volumes:
      - ./.docker/templates:/etc/nginx/templates:ro
      - .:/app
    environment:
      NGINX_FPM_SERVICE: ${COMPOSE_PROJECT_NAME}-phpfpm-1:9000
      NGINX_WEB_ROOT: /app/web
      NGINX_PORT: 8080
      NGINX_MAX_BODY_SIZE: 5M
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=frontend"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`${COMPOSE_DOMAIN}`)"

  memcached:
    image: memcached:alpine
    networks:
      - app
    ports:
      - "11211"
    healthcheck:
      test: echo "version" | nc -vn -w 1 127.0.0.1 11211
      interval: 10s
      retries: 60
    environment:
      - MEMCACHED_CACHE_SIZE=64

  mail:
    image: axllent/mailpit
    networks:
      - app
      - frontend
    ports:
      - "1025"
      - "8025"
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=frontend"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}mail.rule=Host(`mail-${COMPOSE_DOMAIN}`)"
      - "traefik.http.services.${COMPOSE_PROJECT_NAME}mail.loadbalancer.server.port=8025"
```

### Development Override (docker-compose.override.yml)

Extends base config for local development. Can include additional compose files:

```yaml
include:
  - docker-compose.oidc.yml
  - docker-compose.playwright.yml

services:
  node:
    image: node:22
    profiles:
      - dev
    working_dir: /app
    volumes:
      - .:/app

  phpfpm:
    image: itkdev/php8.4-fpm:latest
    environment:
      - PHP_POST_MAX_SIZE=90M
      - PHP_UPLOAD_MAX_FILESIZE=80M
      - PHP_MEMORY_LIMIT=512M
```

### Profile-Based Services

Use Docker Compose profiles for optional services:

```yaml
services:
  markdownlint:
    image: itkdev/markdownlint
    profiles:
      - dev
    volumes:
      - ./:/md

  prettier:
    image: jauderho/prettier
    profiles:
      - dev
    volumes:
      - ./:/work

  clamav:
    image: clamav/clamav:1.4
    profiles:
      - clamav
    ports:
      - "3310"
      - "7357"
```

Enable profiles via environment variable:

```bash
COMPOSE_PROFILES=dev,clamav docker compose up -d
```

### OIDC Server Mock (docker-compose.oidc.yml)

For local authentication testing, use the OIDC Server Mock:

```yaml
services:
  idp-citizen:
    image: ghcr.io/soluto/oidc-server-mock:0.8.6
    profiles:
      - oidc
      - test
    # Let this container be accessible both internally and externally on the same domain
    container_name: idp-citizen.${COMPOSE_DOMAIN}
    networks:
      - app
      - frontend
    ports:
      - '443'
    volumes:
      - .:/tmp/config:ro
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=frontend"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}_idp-citizen.rule=Host(`idp-citizen.${COMPOSE_DOMAIN}`)"
      - "traefik.http.services.${COMPOSE_PROJECT_NAME}_idp-citizen.loadbalancer.server.port=443"
      - "traefik.http.services.${COMPOSE_PROJECT_NAME}_idp-citizen.loadbalancer.server.scheme=https"
    environment:
      # HTTPS configuration
      ASPNETCORE_URLS: https://+:443;http://+:80
      ASPNETCORE_Kestrel__Certificates__Default__Password: mock
      ASPNETCORE_Kestrel__Certificates__Default__Path: /tmp/config/.docker/oidc-server-mock/cert/docker.pfx
      ASPNETCORE_ENVIRONMENT: Development

      SERVER_OPTIONS_INLINE: |
        AccessTokenJwtType: JWT
        Discovery:
          ShowKeySet: true
        Authentication:
          CookieSameSiteMode: Lax
          CheckSessionCookieSameSiteMode: Lax

      LOGIN_OPTIONS_INLINE: |
        {
          "AllowRememberLogin": false
        }

      LOGOUT_OPTIONS_INLINE: |
        {
          "AutomaticRedirectAfterSignOut": true
        }

      CLIENTS_CONFIGURATION_INLINE: |
        - ClientId: client-id
          ClientSecrets: [client-secret]
          Description: Mock IdP
          AllowedGrantTypes:
            - authorization_code
          RequireClientSecret: false
          AllowAccessTokensViaBrowser: true
          AlwaysIncludeUserClaimsInIdToken: true
          AllowedScopes:
            - openid
            - profile
            - email
          ClientClaimsPrefix: ''
          RedirectUris:
            - '*'
          PostLogoutRedirectUris:
            - '*'
          RequirePkce: false

      # Custom claim types
      OVERRIDE_STANDARD_IDENTITY_RESOURCES: 'true'
      IDENTITY_RESOURCES_INLINE: |
        - Name: openid
          ClaimTypes:
            - sub
        - Name: email
          ClaimTypes:
            - email
        - Name: profile
          ClaimTypes:
            - dk_ssn
            - name
            - zip
            - uuid

      USERS_CONFIGURATION_INLINE: |
        - SubjectId: 1
          Username: citizen1
          Password: citizen1
          Claims:
          - Type: dk_ssn
            Value: '1111111111'
            ValueType: string
          - Type: name
            Value: 'Anders And'
            ValueType: string
```

Certificate setup for OIDC mock requires a `.docker/oidc-server-mock/cert/docker.pfx` file.

For server OIDC (`docker-compose.server.oidc.yml`), use `COMPOSE_SERVER_DOMAIN` instead of
`COMPOSE_DOMAIN` in the container name and labels.

## Server Configuration (docker-compose.server.yml)

Optimized for production deployments:

```yaml
networks:
  frontend:
    external: true
  app:
    driver: bridge
    internal: false

services:
  phpfpm:
    image: itkdev/php8.3-fpm:alpine
    restart: unless-stopped
    networks:
      - app
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - PHP_MAX_EXECUTION_TIME=30
      - PHP_MEMORY_LIMIT=128M
      - DRUSH_OPTIONS_URI=https://${COMPOSE_SERVER_DOMAIN}
    depends_on:
      - memcached
    volumes:
      - .:/app

  nginx:
    image: nginxinc/nginx-unprivileged:alpine
    restart: unless-stopped
    networks:
      - app
      - frontend
    depends_on:
      - phpfpm
    volumes:
      - ./.docker/templates:/etc/nginx/templates:ro
      - ./.docker/nginx.conf:/etc/nginx/nginx.conf:ro
      - .:/app
    environment:
      NGINX_FPM_SERVICE: ${COMPOSE_PROJECT_NAME}-phpfpm-1:9000
      NGINX_WEB_ROOT: /app/web
      NGINX_PORT: 8080
      NGINX_MAX_BODY_SIZE: 5M
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=frontend"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.rule=Host(`${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.entrypoints=web"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.middlewares=redirect-to-https"
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=websecure"

  memcached:
    image: "memcached:latest"
    restart: unless-stopped
    networks:
      - app
    environment:
      - MEMCACHED_CACHE_SIZE=64
```

Key differences from development:

- Uses Alpine-based images (smaller footprint)
- Lower memory limits (128M vs 256M+)
- `restart: unless-stopped` policy
- HTTPS redirect middleware
- No database container (external database)

### Development/Staging Server (docker-compose.dev.yml)

Used for development and staging servers with additional services like mail capture and basic auth protection:

```yaml
# itk-version: 3.2.1
services:
  phpfpm:
    environment:
      - PHP_SENDMAIL_PATH=/usr/sbin/sendmail -S mail:1025

  nginx:
    labels:
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.middlewares=ITKBasicAuth@file"

  mail:
    image: axllent/mailpit
    restart: unless-stopped
    networks:
      - app
      - frontend
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=frontend"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}-http.rule=Host(`mail.${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}-http.entrypoints=web"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}-http.middlewares=redirect-to-https"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}.rule=Host(`mail.${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}.entrypoints=websecure"
      - "traefik.http.services.mail_${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=8025"
      - "traefik.http.routers.mail_${COMPOSE_PROJECT_NAME}.middlewares=ITKMailhogAuth@file"
```

Key features:

- Basic Auth middleware (`ITKBasicAuth@file`) for protected staging environments
- Mailpit with authentication middleware for mail capture on server

### WWW Redirect (docker-compose.redirect.yml)

Handles www to non-www redirects:

```yaml
# itk-version: 3.2.1
services:
  nginx:
    labels:
      # Add www before domain and set redirect to non-www
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}-http.rule=Host(`www.${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}-http.entrypoints=web"
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}-http.middlewares=redirect-to-https,non_www"
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}.rule=Host(`www.${COMPOSE_SERVER_DOMAIN}`)"
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}.entrypoints=websecure"
      - "traefik.http.routers.www_${COMPOSE_PROJECT_NAME}.middlewares=non_www"

      - traefik.http.middlewares.non_www.redirectregex.regex=^(http|https)?://(?:www\.)?(.+)
      - traefik.http.middlewares.non_www.redirectregex.replacement=https://$${2}
      - traefik.http.middlewares.non_www.redirectregex.permanent=true
```

### Server Override (docker-compose.server.override.yml)

Environment-specific overrides for server deployments:

```yaml
services:
  phpfpm:
    environment:
      - PHP_OPCACHE_VALIDATE_TIMESTAMPS=0
      - PHP_POST_MAX_SIZE=18M
      - PHP_UPLOAD_MAX_FILESIZE=15M

  nginx:
    environment:
      - NGINX_MAX_BODY_SIZE=20M
```

Key settings:

- `PHP_OPCACHE_VALIDATE_TIMESTAMPS=0` - Disables OPcache timestamp validation for performance
- Customized upload size limits for the specific environment

### Production Shared Volumes (docker-compose.server.prod.yml)

Production-specific volume mounts for shared files between deployments:

```yaml
services:
  phpfpm:
    volumes:
      - ../../shared/settings.local.php:/app/web/sites/default/settings.local.php
      - ../../shared/files:/app/web/sites/default/files
      - ../../shared/private:/app/private

  nginx:
    volumes:
      - ../../shared/files:/app/web/sites/default/files
```

This pattern allows:

- Persistent settings across deployments
- Shared file storage between releases
- Private files directory for sensitive uploads

## itkdev-docker-compose-server CLI

### Purpose

`itkdev-docker-compose-server` is a wrapper CLI used in production/staging deployments. It:

- Automatically uses `docker-compose.server.yml` configuration
- Integrates with deployment pipelines (Woodpecker, Ansible)
- Provides consistent command interface across environments

### Common Commands

```bash
# Pull latest images
itkdev-docker-compose-server pull

# Start services
itkdev-docker-compose-server up --detach --force-recreate --remove-orphans

# Execute commands in running containers
itkdev-docker-compose-server exec phpfpm composer install --no-dev --optimize-autoloader
itkdev-docker-compose-server exec phpfpm vendor/bin/drush --yes cache:rebuild
itkdev-docker-compose-server exec phpfpm vendor/bin/drush --yes deploy

# Run one-off commands (creates new container)
itkdev-docker-compose-server run --rm phpfpm vendor/bin/drush --yes cache:rebuild
```

### CI/CD Integration (Woodpecker)

Example staging deployment (`.woodpecker/stg.yml`):

```yaml
when:
  - branch: release/*
    event: push

skip_clone: true

labels:
  zone: CLOUD

steps:
  - name: Run test site update
    image: itkdev/ansible-plugin:1
    pull: true
    settings:
      id:
        from_secret: id
      secret:
        from_secret: secret
      host:
        from_secret: stg_host
      path:
        from_secret: stg_path
      user:
        from_secret: user
      actions:
        # Make Drupal settings writable before git operations
        - chmod +w web/sites/default
        - chmod +w web/sites/default/settings.php
        - git reset --hard
        - git fetch origin ${CI_COMMIT_BRANCH}
        - git checkout ${CI_COMMIT_BRANCH}
        - git pull
        - itkdev-docker-compose-server up -d --force-recreate
        - itkdev-docker-compose-server exec phpfpm composer install --no-dev -o --classmap-authoritative
        # Workaround for autoloader issues
        - itkdev-docker-compose-server run --rm phpfpm composer dump-autoload
        - itkdev-docker-compose-server exec phpfpm vendor/bin/drush --yes cache:rebuild
        - itkdev-docker-compose-server exec phpfpm vendor/bin/drush --yes deploy
```

Example production deployment (`.woodpecker/prod.yml`):

```yaml
when:
  - event: release

skip_clone: true

labels:
  zone: CLOUD

steps:
  - name: Ansible playbook
    image: itkdev/ansible-plugin:1
    pull: true
    settings:
      id:
        from_secret: id
      secret:
        from_secret: secret
      host:
        from_secret: prod_host
      path:
        from_secret: prod_path
      user:
        from_secret: user
      playbook: 'release'
      pre_up:
        # Workaround for 'Drupal\mysql\Driver\Database\mysql\Connection' not found
        - itkdev-docker-compose-server run --rm phpfpm composer dump-autoload
        - itkdev-docker-compose-server run --rm phpfpm vendor/bin/drush --yes cache:rebuild
        - itkdev-docker-compose-server run --rm phpfpm vendor/bin/drush --yes deploy
      cron:
        cron:
          minute: '*/5'
          hour: '*'
          day: '*'
          month: '*'
          weekday: '*'
          job: 'itkdev-docker-compose-server exec phpfpm vendor/bin/drush --yes core:cron'
```

Key Woodpecker patterns:

| Setting | Purpose |
|---------|---------|
| `skip_clone: true` | Skip automatic git clone (code already on server) |
| `labels: zone: CLOUD` | Route to specific runner pool |
| `pull: true` | Always pull latest plugin image |
| `chmod +w` | Make Drupal settings writable before git operations |
| `composer dump-autoload` | Fix autoloader issues after composer install |

## Networks

### Frontend Network

External network shared with Traefik reverse proxy. Must be created before starting containers:

```bash
docker network create frontend
```

### App Network

Internal bridge network for service communication. Created automatically.

## Standard ITK Dev Docker Images

| Image | Purpose |
|-------|---------|
| `itkdev/mariadb:latest` | MySQL-compatible database |
| `itkdev/php8.3-fpm:latest` | PHP-FPM for development |
| `itkdev/php8.3-fpm:alpine` | PHP-FPM for production |
| `itkdev/php8.4-fpm:latest` | PHP 8.4 variant |
| `nginxinc/nginx-unprivileged:alpine` | Web server |
| `memcached:alpine` | Cache server |
| `axllent/mailpit` | Development mail capture |
| `itkdev/markdownlint` | Markdown linting |
| `jauderho/prettier` | Code formatting |

## Directory Structure

```text
.docker/
├── templates/
│   └── default.conf.template    # Nginx vhost template
├── nginx.conf                   # Nginx main config (for production)
├── data/                        # Local data storage (gitignored)
├── oidc-server-mock/
│   └── cert/
│       └── docker.pfx           # OIDC mock certificate
└── drupal/
    └── dumps/
        └── drupal.sql.gz        # Database dump
```

## Nginx Configuration

### Main Configuration (nginx.conf)

Used in production for proper client IP logging behind Traefik:

```nginx
worker_processes  auto;

error_log  /dev/stderr notice;
pid        /tmp/nginx.pid;

events {
    worker_connections  1024;
}

http {
    proxy_temp_path /tmp/proxy_temp;
    client_body_temp_path /tmp/client_temp;
    fastcgi_temp_path /tmp/fastcgi_temp;
    uwsgi_temp_path /tmp/uwsgi_temp;
    scgi_temp_path /tmp/scgi_temp;

    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Real IP configuration for Traefik proxy
    set_real_ip_from 172.16.0.0/16;
    real_ip_recursive on;
    real_ip_header X-Forwarded-For;

    log_format  main  '$http_x_real_ip - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /dev/stdout main;

    sendfile        on;
    keepalive_timeout  65;
    gzip  on;

    include /etc/nginx/conf.d/*.conf;
}
```

### Vhost Template (default.conf.template)

Drupal-optimized nginx configuration with security rules:

```nginx
server {
    listen ${NGINX_PORT};
    server_name localhost;

    root ${NGINX_WEB_ROOT};
    client_max_body_size ${NGINX_MAX_BODY_SIZE};

    # Real IP for proper logging behind proxy
    set_real_ip_from 172.16.0.0/16;
    real_ip_recursive on;
    real_ip_header X-Forwarded-For;

    # Static file handling
    location = /favicon.ico { log_not_found off; access_log off; }
    location = /robots.txt { allow all; log_not_found off; access_log off; }

    # Security rules
    location ~* \.(txt|log)$ { deny all; }
    location ~ \..*/.*\.php$ { return 403; }
    location ~ ^/sites/.*/private/ { return 403; }
    location ~ ^/sites/[^/]+/files/.*\.php$ { deny all; }
    location ~ (^|/)\. { return 403; }
    location ~ /vendor/.*\.php$ { deny all; return 404; }

    # Protect sensitive files
    location ~* \.(engine|inc|install|make|module|profile|po|sh|.*sql|.tar|.gz|.bz2|theme|twig|tpl(\.php)?|xtmpl|yml)(~|\.sw[op]|\.bak|\.orig|\.save)?$|^(\.(?!well-known).*|Entries.*|Repository|Root|Tag|Template|composer\.(json|lock)|web\.config)$|^#.*#$|\.php(~|\.sw[op]|\.bak|\.orig|\.save)$ {
        deny all;
        return 404;
    }

    # Main location
    location / {
        try_files $uri /index.php?$query_string;
    }

    # PHP handling
    location ~ '\.php$|^/update.php' {
        fastcgi_buffers 16 32k;
        fastcgi_buffer_size 64k;
        fastcgi_busy_buffers_size 64k;
        fastcgi_split_path_info ^(.+?\.php)(|/.*)$;
        include fastcgi_params;
        fastcgi_param HTTP_PROXY "";
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_intercept_errors on;
        fastcgi_pass ${NGINX_FPM_SERVICE};
    }

    # Drupal image styles
    location ~ ^/sites/.*/files/styles/ { try_files $uri @rewrite; }

    # Private files
    location ~ ^(/[a-z\-]+)?/system/files/ {
        try_files $uri /index.php?$query_string;
    }

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        try_files $uri @rewrite;
        expires max;
        log_not_found off;
    }

    location @rewrite { rewrite ^/(.*)$ /index.php?q=$1; }

    # Clean URLs
    absolute_redirect off;
    if ($request_uri ~* "^(.*/)index\.php/(.*)") {
        return 301 /$2;
    }

    error_log /dev/stderr;
    access_log /dev/stdout main;
}
```

## Traefik Labels

Standard Traefik labels for routing:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=frontend"
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`${COMPOSE_DOMAIN}`)"
```

For HTTPS with redirect:

```yaml
labels:
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.rule=Host(`${COMPOSE_SERVER_DOMAIN}`)"
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.entrypoints=web"
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-http.middlewares=redirect-to-https"
  - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`${COMPOSE_SERVER_DOMAIN}`)"
  - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=websecure"
```
