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

Which demo pages to include. Available values: `password` (Email & Password), `github` (GitHub OAuth), and `github-mock` (GitHub OAuth through Mockatoo in development).

```sh
# Email & Password only (default)
npx sv add better-auth="demo:password"

# GitHub OAuth only
npx sv add better-auth="demo:github"

# Both Email & Password and GitHub OAuth
npx sv add better-auth="demo:password,github"
```

### demo:github-mock

Run the GitHub demo without registering a GitHub OAuth app. In development, sign-in goes through [Mockatoo](https://mockatoo.globalunderdog.com), a free hosted mock of GitHub's OAuth flow; production uses the real GitHub provider with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

```sh
npx sv add better-auth="demo:github-mock"
```
