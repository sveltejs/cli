---
title: ai-tools
---

[Svelte AI Tools](/docs/ai/overview) can help your LLM write better Svelte code.

## Usage

```sh
npx sv add ai-tools
```

## What you get

You can add the tooling either through the official **Svelte plugin** or as **individual tools**.

- The **Svelte plugin** bundles everything (MCP server, [skills](https://svelte.dev/docs/ai/skills) and sub-agents) and keeps itself up to date. It's available for Claude Code and opencode. For Claude Code it's enabled through a committed `.claude/settings.json` - the first time you open the project you'll be asked to trust the workspace, then it installs automatically (no `/plugin install` needed).
- **Individual tools**, for clients without a plugin (or when you want to pick exactly what to add):
  - An MCP configuration for [local](https://svelte.dev/docs/ai/local-setup) or [remote](https://svelte.dev/docs/ai/remote-setup) setup
  - A [README for agents](https://agents.md/) to help you use the MCP server effectively
  - [Skills](https://svelte.dev/docs/ai/skills) for clients that support them
  - Sub-agents for clients that support them

## Options

### ide

The client(s) you want to use like `'claude-code'`, `'cursor'`, `'gemini'`, `'opencode'`, `'vscode'`, `'other'`.

```sh
npx sv add ai-tools="ide:cursor,vscode"
```

### delivery

How to add the tooling: `'plugin'` (the Svelte plugin, recommended) or `'tools'` (individual tools). Only asked when a selected client supports a plugin.

```sh
npx sv add ai-tools="ide:claude-code+delivery:plugin"
```

### tools

Which individual tools to add when not using the plugin, like `'mcp'`, `'svelte-code-writer'`, `'svelte-core-bestpractices'`, `'svelte-file-editor'`.

```sh
npx sv add ai-tools="ide:cursor+delivery:tools+tools:mcp,svelte-file-editor"
```

### mcpSetup

The MCP setup you want to use (`'local'` or `'remote'`). Only relevant when adding the MCP server as an individual tool.

```sh
npx sv add ai-tools="mcpSetup:local"
```
