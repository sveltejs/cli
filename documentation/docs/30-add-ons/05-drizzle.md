---
title: drizzle
---

## Usage

```bash
npx sv add drizzle
```

## Description

[Drizzle ORM](https://orm.drizzle.team/) is a headless TypeScript ORM with a head.
Some short description about what drizzle is and what we set up

## Options

### database

Which database variant to use:

- `postgresql` — tbd
- `mysql` — tbd
- `sqlite` — runs everywhere, local database

```bash
npx sv add --drizzle=postgresql
```

### client

The sql client to use, depends on `database`:

- For `postgresql`: `postgres.js`, `neon`,
- For `mysql`: `mysql2`, `planetscale`
- For `sqlite`: `better-sqlite3`, `libsql`, `turso`

```bash
npx sv add --drizzle=postgresql,postgres.js
```

Drizzle is compatible with well over a dozen database drivers. We just offer a few of the most common ones here for simplicity, but if you'd like to use another one you can choose one as a placeholder and swap it out for another after setup by choosing from [Drizzle's full list of compatible drivers](https://orm.drizzle.team/docs/connect-overview#next-steps).

### docker

Whether to add docker compose configuration. Only available for [`database`](#Options-database) `postgresql` or `mysql`

- `docker` - generates `docker-compose.yml`
- `no-docker` - does not generate docker config

```bash
npx sv add --drizzle=postgresql,postgres.js,docker
```
