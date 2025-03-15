# community-addon-template

> [!IMPORTANT]
> Community add-ons are currently not supported. Please see [#184](https://github.com/sveltejs/cli/issues/184) for details.

> [!IMPORTANT]
> This template's dependencies may not be up-to-date; be sure to update them to the latest!
> If you get stuck, check out the [implementations of official add-ons](https://github.com/sveltejs/cli/tree/main/packages/add-ons).

The add-on template for community add-ons for [`sv`](https://github.com/sveltejs/cli).

## Cloning the template

Use [`degit`](https://github.com/Rich-Harris/degit) to clone the template:

```shell
npx degit sveltejs/cli/community-addon-template addon-name
```

## Using the add-on

To run the add-on, we'll first need a project to apply it to.

Create the project with the following script:

```shell
npm run create-temp
```

This will create a SvelteKit project in the `temp` directory.

To execute the add-on, run:

```shell
npm start
```

## Sharing your add-on

When you're ready to publish your add-on to npm, run:

```shell
npm publish
```

Your published add-on can now be used by anyone!

To execute the newly published package with `sv`, run:

```shell
npx sv add --community npm:addon-package-name
```

After that, feel free to open a pull request to [`sv`](https://github.com/sveltejs/cli) and add your add-on to the [community list](/community-addons/).

## Things to be aware of

Community add-ons are **not permitted** to have any external dependencies outside of `@sveltejs/cli-core`. If the use of a dependency is absolutely necessary, then they can be bundled using a bundler of your choosing (e.g. Rollup, Rolldown, tsup, etc.).
