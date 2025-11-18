---
title: mcp
---

[Svelte MCP](/docs/mcp/overview) can help your LLM write better Svelte code.

## Usage

```sh
npx sv add mcp
```

## What you get

Depending on your IDE selection, you’ll receive:

- A [MCP configuration](https://svelte.dev/docs/mcp/overview#Setup)
- A [`README for agents`](https://agents.md/)

## Options

### ide

The IDE you want to use like `'claude-code'`, `'cursor'`, `'gemini'`, `'opencode'`, `'vscode'`, `'other'`.

```sh
npx sv add mcp="ide:cursor,vscode"
```

### setup

The setup you want to use.

```sh
npx sv add mcp="setup:local"
```
