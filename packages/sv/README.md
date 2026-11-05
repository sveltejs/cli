# sv - the Svelte CLI

A command line interface (CLI) for creating and maintaining [Svelte](https://svelte.dev) applications. Just run:

```sh
npx sv
```

## Commands

| Command                                                                                            | Description                           |
| -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [`sv create \[path\]](https://svelte.dev/docs/cli/sv-create)                       | Scaffold a new Svelte(Kit) project    |
| [`sv add \[add-on...\]](https://svelte.dev/docs/cli/sv-add)                        | Apply add-ons into a project          |
| [`sv migrate \[migration\]](https://svelte.dev/docs/cli/sv-migrate)                | Migrate Svelte(Kit) codebases         |
| [`sv check`](https://svelte.dev/docs/cli/sv-check)                                 | Analyze your code with `svelte-check` |

Run `sv <command> --help` to see all options for a command.

See [Documentation](https://svelte.dev/docs/cli/overview) for more detail.

## Changelog

[Changelog](./CHANGELOG.md)

## License

[MIT](../../LICENSE)

## Acknowledgements

Thank you to [Christopher Brown](https://github.com/chbrown) who originally owned the `sv` name on npm for graciously allowing it to be used for this package. You can find the original `sv` package at [`@chbrown/sv`](https://www.npmjs.com/package/@chbrown/sv).

This project was formed by merging the `create-svelte` and `svelte-add` CLIs. Thank you to [J](https://github.com/babichjacob) for starting the community-led `svelte-add` project and to the [`svelte-add` contributors](https://github.com/svelte-add/svelte-add/graphs/contributors).
