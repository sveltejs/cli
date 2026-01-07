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

```sh
npm i -g pnpm
```

_(Optional)_ For running certain packages and tests locally you will need to install [docker](https://docs.docker.com/get-started/get-docker).
Linux users, you will have to ensure 'sudo' is not required. See [docker post install](https://docs.docker.com/engine/install/linux-postinstall/)

`pnpm` commands run in the project's root directory will run on all sub-projects. You can checkout the code and install the dependencies with:

```sh
git clone https://github.com/sveltejs/cli.git
cd cli
pnpm install
```

## Build and run

To build the project and all packages. Run the 'build' script:

```sh
# from root of project
pnpm build
```

This outputs into /packages/PACKAGE/dist/.

Run the 'cli' package:

```sh
pnpm sv
```

Run build with watch mode:

```sh
pnpm dev
```

## Testing

For each add-on we have integration tests setup. These install the deps, build the app, run the dev server and then run a few small snippets against the add-on to see if the changes introduced by the add-on are working as expected.

Run all tests:

```sh
# from root of project
pnpm test
```

Run tests with vitest ui:

```sh
# from root of project
pnpm test:ui
```

We split tests into packages & sub projects.
Run specific tests by specifying a project flag to the package and running the test command. Eg:

```sh
pnpm test --project cli # core / addons / create / migrate
```

### Debugging

Example of how to debug an addon failing test. Once, you ran the test command, you will have a directory in `.test-output` with the test id. A good starting point is to `cd` into the failing tests dir. Proceed to `build` it. Then `preview` it. From here you will have increased information to help in the debug process. E.g.:

```sh
pnpm test --project addons tailwind # to debug the tailwind addon failing test
# Each test is a standalone app
cd .test-output/addons/[addon-test]/[test-id]
pnpm build
pnpm preview
```

### Update snapshots

Some snapshots are testing the output of `sv` directly from the generated binary. They are located in `packages/sv/lib/cli/tests/snapshots`. Make sure to generate a new binary before updating these snapshots.

In one command:

```sh
pnpm build && pnpm test:ui --project cli
# Press `u` when prompted to update snapshots.
```

## Style Guide

### Coding style

There are a few guidelines we follow:

- Ensure `pnpm lint` and `pnpm check` pass. You can run `pnpm format` to format the code
- linting

```sh
# from root of project
pnpm lint
```

- formatting

```sh
# from root of project
pnpm format
```

- type checking

```sh
# from root of project
pnpm check
```

## svelte-migrate

To run svelte-migrate locally:

```sh
# from root of project
node ./packages/migrate/bin.js
```

## Generating changelogs

Here is the command to generate a change set:

```sh
# from root of project
pnpm changeset
```
