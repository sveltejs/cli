---
title: mcp
---

[Svelte MCP](/docs/mcp/overview) can help your LLM write better Svelte code.

## Usage

```sh
npx sv add mcp
```

## What you get

Depending on your IDE setup, you’ll receive:

- A MCP configuration
- A `readme` for agent, either [`AGENTS.md`](https://agents.md/), `CLAUDE.md`, or `GEMINI.md`

## Options

### ide

The IDE you want to use like `'claude-code'`, `'cursor'`, `'gemini'`, `'opencode'`, `'vscode'`, `'other'`.

```sh
npx sv add mcp=ide:cursor,vscode
```

### setup

The setup you want to use.

```sh
npx sv add mcp=setup:local
```
