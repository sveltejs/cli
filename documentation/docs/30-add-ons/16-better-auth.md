---
title: better-auth
---

[Better Auth](https://www.better-auth.com/) is a framework-agnostic authentication library for TypeScript.

## Usage

```sh
npx sv add better-auth
```

## What you get

- a complete auth setup for SvelteKit with Drizzle as the database adapter
- email/password authentication enabled by default
- optional demo registration and login pages

## Options

### demo

Which demo pages to include. Available values: `password` (Email & Password), `github` (GitHub OAuth).

```sh
# Email & Password only (default)
npx sv add better-auth="demo:password"

# GitHub OAuth only
npx sv add better-auth="demo:github"

# Both Email & Password and GitHub OAuth
npx sv add better-auth="demo:password,github"
```
