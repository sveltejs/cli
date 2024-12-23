# svelte-migrate

A CLI for migrating Svelte(Kit) codebases.

Run it directly using:

```
npx svelte-migrate [migration]
```

Or via the unified Svlete CLI with:

```
npx sv migrate [migration]
```

## Migrations

| Migration           | From                  | To                    | Guide                                                           |
| ------------------- | --------------------- | --------------------- | --------------------------------------------------------------- |
| `app-state`         | `$app/stores`         | `$app/state`          | [#13140](https://github.com/sveltejs/kit/pull/13140)            |
| `svelte-5`          | Svelte 4              | Svelte 5              | [Website](https://svelte.dev/docs/svelte/v5-migration-guide)    |
| `self-closing-tags` | Svelte 4              | Svelte 4              | [#12128](https://github.com/sveltejs/kit/pull/12128)            |
| `svelte-4`          | Svelte 3              | Svelte 4              | [Website](https://svelte.dev/docs/svelte/v4-migration-guide)    |
| `sveltekit-2`       | SvelteKit 1.0         | SvelteKit 2.0         | [Website](https://svelte.dev/docs/kit/migrating-to-sveltekit-2) |
| `package`           | `@sveltejs/package@1` | `@sveltejs/package@2` | [#8922](https://github.com/sveltejs/kit/pull/8922)              |
| `routes`            | SvelteKit pre-1.0     | SvelteKit 1.0         | [#5774](https://github.com/sveltejs/kit/discussions/5774)       |

Some migrations may annotate your codebase with tasks for completion that you can find by searching for `@migration`.

## Documentation

[Documentation](https://svelte.dev/docs/cli/sv-migrate)

## Changelog

[The Changelog for this package is available on GitHub](https://github.com/sveltejs/kit/blob/main/packages/migrate/CHANGELOG.md).
