# sv - the Svelte CLI

A CLI for creating new [SvelteKit](https://kit.svelte.dev) projects and adding functionality to existing ones. Just run...

```bash
npx sv
```

...and follow the prompts.

## API

You can also use `sv` programmatically:

```js
import { create } from 'sv';

await create('my-new-app', {
  name: 'my-new-app',
  template: 'default', // or 'skeleton' or 'skeletonlib'
  types: 'checkjs', // or 'typescript' or null;
  prettier: false,
  eslint: false,
  playwright: false,
  vitest: false
});
```

`checkjs` means your project will use TypeScript to typecheck JavaScript via [JSDoc comments](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).

## Acknowledgements

Thank you to [Christopher Brown](https://github.com/chbrown) who originally owned the `sv` name on npm for graciously allowing it to be used for this package. You can find the original `sv` package at [`@chbrown/sv`](https://www.npmjs.com/package/@chbrown/sv).

Thank you to [J](https://github.com/babichjacob) for starting the community-led `svelte-add` project, which — together with `create-svelte` — was a precursor to this one.

## License

[MIT](../../LICENSE).
