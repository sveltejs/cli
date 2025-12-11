# [sv](https://svelte.dev/docs/cli/overview) community add-on: sv-hello

> [!IMPORTANT]
> Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion

## Usage

To use sv-hello, run:

```shell
npx sv add sv-hello
```

## What you get

- A super cool stuff
- Another one!

---

## Developing the add-on

Some convinient scripts are provided to help you develop the add-on.

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
