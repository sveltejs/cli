---
title: drizzle
---

[Drizzle ORM](https://orm.drizzle.team/) is a TypeScript ORM offering both relational and SQL-like query APIs, and which is serverless-ready by design.

## Usage

```bash
npx sv add drizzle
```

## What you get

- a setup that keeps your database access in SvelteKit's server files
- an `.env` file to store your credentials
- compatibility with the Lucia auth add-on
- an optional Docker configuration to help with running a local database

## Options

### database

Which database variant to use:

- `postgresql` — the most popular open source database
- `mysql` — another popular open source database
- `sqlite` — file-based database not requiring a database server

```bash
npx sv add --drizzle=postgresql
```

### client

The SQL client to use, depends on `database`:

- For `postgresql`: `postgres.js`, `neon`,
- For `mysql`: `mysql2`, `planetscale`
- For `sqlite`: `better-sqlite3`, `libsql`, `turso`

```bash
npx sv add --drizzle=postgresql;postgres.js
```

Drizzle is compatible with well over a dozen database drivers. We just offer a few of the most common ones here for simplicity, but if you'd like to use another one you can choose one as a placeholder and swap it out for another after setup by choosing from [Drizzle's full list of compatible drivers](https://orm.drizzle.team/docs/connect-overview#next-steps).

### docker

Whether to add Docker Compose configuration. Only available for [`database`](#Options-database) `postgresql` or `mysql`

- `docker` - generates `docker-compose.yml`
- `no-docker` - does not generate docker config

```bash
npx sv add --drizzle=postgresql,postgres.js,docker
```
