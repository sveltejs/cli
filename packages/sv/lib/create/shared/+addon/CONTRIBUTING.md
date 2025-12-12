# Contributing Guide

Some convinient scripts are provided to help develop the add-on.

```sh
## create a new demo project
npm run demo-create

## add your add-on to the demo project
npm run demo-add

## run the tests
npm run test
```

## Sharing your add-on

When you're ready to publish your add-on to npm, run:

```shell
npm publish
```

## Things to be aware of

Community add-ons are **not permitted** to have any external dependencies outside of `sv`. If the use of a dependency is absolutely necessary, then they can be bundled using a bundler of your choosing (e.g. Rollup, Rolldown, tsup, etc.).
