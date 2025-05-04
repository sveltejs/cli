# SV Contributing Guide

## Workflow

We follow the standard fork-based workflow:

1. **Fork** this repository to your GitHub account.
2. **Clone** your fork locally.
3. **Create a new branch** for your change:  
   `git checkout -b your-feature-name`
4. **Commit and push** your changes to your branch.
5. **Open a pull request** from your branch to the `main` branch of this repository.

Please keep your pull requests focused to feature or issue. Focused smaller changes are easier to review and faster to merge.

## Preparing
This is a monorepo, meaning the repo holds multiple packages. It requires the use of [pnpm](https://pnpm.io/). You can [install pnpm](https://pnpm.io/installation) with:

```bash
npm i -g pnpm
```

For running certain packages and tests locally you will need to install [docker](https://docs.docker.com/get-started/get-docker).
Linux users, you will have to ensure 'sudo' is not required. See [docker post install](https://docs.docker.com/engine/install/linux-postinstall/)

`pnpm` commands run in the project's root directory will run on all sub-projects. You can checkout the code and install the dependencies with:

```bash
cd cli
pnpm install
```

## Build and run
To build the project and all packages. Run the 'build' script:

```bash
# from root of project
pnpm build
```
This outputs into /packages/PACKAGE/dist/.

Run the 'cli' package:
```bash
pnpm sv
```

Run build with watch mode:
```bash
pnpm dev
```

## Testing

For each add-on we have integration tests setup. These install the deps, build the app, run the dev server and then run a few small snippets against the add-on to see if the changes introduced by the add-on are working as expected.

Run all tests:
```bash
# from root of project
pnpm test
```

Run tests with vitest ui:
```bash
# from root of project
pnpm test:ui
```

Run package specific tests by specifying a project flag to the package and running the test command. Eg:
```bash
pnpm test --project core # addons / create / migrate / etc.
```

## Style Guide

### Coding style

There are a few guidelines we follow:

- Ensure `pnpm lint` and `pnpm check` pass. You can run `pnpm format` to format the code
- linting
```bash
# from root of project
pnpm lint
```
- formatting
```bash
# from root of project
pnpm format
```
- type checking
```bash
# from root of project
pnpm check
```

## svelte-migrate
To run svelte-migrate locally:
```bash
# from root of project
node ./packages/migrate/bin.js 
```

## Generating changelogs
Only publish a change set if it is in 'sv' or 'svelte-migrate' as all other packages are bundled. 
For changes to be reflected in package changelogs:
```bash
# from root of project
pnpm changeset:publish
```
