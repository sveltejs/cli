---
title: ai-tools
---

[Svelte AI Tools](/docs/ai/overview) can help your LLM write better Svelte code.

## Usage

```sh
npx sv add ai-tools
```

## What you get

- An MCP configuration for [local](https://svelte.dev/docs/ai/local-setup) or [remote](https://svelte.dev/docs/ai/remote-setup) setup
- A [README for agents](https://agents.md/) to help you use the MCP server effectively
- [Skills](https://svelte.dev/docs/ai/skills) for clients that support them (claude code, opencode)

## Options

### ide

The IDE you want to use like `'claude-code'`, `'cursor'`, `'gemini'`, `'opencode'`, `'vscode'`, `'other'`.

```sh
npx sv add ai-tools="ide:cursor,vscode"
```

### setup

The setup you want to use.

```sh
npx sv add ai-tools="setup:local"
```
