# adder-template-js

> [!IMPORTANT]
> This template's dependencies may not be up-to-date; be sure to update them to the latest!
> If you get stuck, check out the [implementations of official adders](https://github.com/sveltejs/cli/tree/main/packages/adders).

The adder template for community adders for [`sv`](https://github.com/sveltejs/cli).

## Using the adder

To run the adder, we'll first need a project to apply it to.

Create the project with the following script:

```shell
npm run create-temp
```

This will create a SvelteKit project in the `temp` directory.

To execute the adder, run:

```shell
npm start
```

## Sharing your adder

When you're ready to publish your adder to NPM, run:

```shell
npm publish
```

Your published adder can now be used by anyone!

To execute the newly published package with `sv`, run:

```shell
npx sv add --community npm:adder-package-name
```

Share your adders here! [some link ???]()

## Things to be aware of

Community adders are **not permitted** to have any external dependencies outside of `@svelte-cli/core`. If the use of a dependency is absolutely necessary, then they can be bundled using a bundler of your choosing (e.g. Rollup, Rolldown, tsup, etc.).
