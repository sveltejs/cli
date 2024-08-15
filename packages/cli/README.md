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

## License

[MIT](../../LICENSE).
