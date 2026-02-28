---
title: mcp
---

[Svelte MCP](/docs/ai/overview) can help your LLM write better Svelte code.

## Usage

```sh
npx sv add mcp
```

## What you get

- An MCP configuration for [local](https://svelte.dev/docs/ai/local-setup) or [remote](https://svelte.dev/docs/ai/remote-setup) setup
- A [README for agents](https://agents.md/) to help you use the MCP server effectively

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
