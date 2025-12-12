# Contributing Guide

Some convenient scripts are provided to help develop the add-on.

```sh
## create a new minimal project in the `demo` directory
npm run demo-create

## add your current add-on to the demo project
npm run demo-add

## run the tests
npm run test
```

## Key things to note

Your `add-on` should:

- export a function that returns a `defineAddon` object.
- have a `package.json` with an `exports` field that points to the main entry point of the add-on.

## Sharing your add-on

When you're ready to publish your add-on to npm, run:

```shell
npm publish
```

## Things to be aware of

Community add-ons are **not permitted** to have any external dependencies outside of `sv`. If the use of a dependency is absolutely necessary, then they can be bundled using a bundler of your choosing (e.g. Rollup, Rolldown, tsup, etc.).
