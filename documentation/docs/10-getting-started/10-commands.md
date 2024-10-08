---
title: Commands
---

## Intorduction

The svelte cli `sv` aims to combine multiple tools into one single easy to remember command.

## Usage

The best way to use our cli is to run one of the following commands, depending on your package manager

```bash
npx sv <command> <args>
pnpx sv <command> <args>
# todo: should we add other package managers or just leave npx? Same goes for all other snippets
```

## Commands

| Command            | Sample usage                     | Description                                    |
| ------------------ | -------------------------------- | ---------------------------------------------- |
| [`create`](create) | `npx sv create ./my-project`     | Scaffolds new projects                         |
| [add](add)         | `npx sv add tailwindcss`         | Customize your projects to add different tools |
| migrate            | `npx sv migrate {migrationName}` | Migrate your project                           |
| check              | `npx sv check`                   | ???                                            |
