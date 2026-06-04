---
title: prisma
---

[Prisma](https://www.prisma.io/) is a another TypeScript ORM for Node.js applications, with a schema-driven workflow and generated client.

## Usage

```sh
npx sv add prisma
```

## What you get

- a Prisma setup for SvelteKit projects
- a generated Prisma client wired into the app
- a `prisma/schema.prisma` schema file
- a `prisma.config.ts` or `prisma.config.js` config file
- an `.env` file with a database connection string

## Options

### database

Which database to use:

- `postgresql` — a common default for hosted and production setups
- `sqlite` — a file-based option for local and lightweight setups

```sh
# PostgreSQL (default)
npx sv add prisma="database:postgresql"

# SQLite
npx sv add prisma="database:sqlite"
```

This initial implementation focuses on PostgreSQL and SQLite, which are the most common starting points for Prisma projects.

### adapter

The Prisma adapter depends on the selected [`database`](#database):

- For `postgresql`: `@prisma/adapter-pg`
- For `sqlite`: `@prisma/adapter-better-sqlite3`

```sh
# PostgreSQL uses @prisma/adapter-pg
npx sv add prisma="database:postgresql"

# SQLite uses @prisma/adapter-better-sqlite3
npx sv add prisma="database:sqlite"
```

The adapter is chosen automatically based on the selected database.
