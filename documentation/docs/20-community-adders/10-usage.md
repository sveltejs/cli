---
title: Usage
---

## Before we begin

> The Svelte maintainers have not reviewed community adders for malicious code. Use at your discretion.

That being said, we still want the community to be able to enhance the experience while creating new projects. That's why everyone is allowed to create community adders. The documentation for creating a new community adder can be found [here](docs)

## usage

```bash
npx sv add --community # interactive list
npx sv add --community supabase # apply supabase adder
npx sv add --community npm:your-npm-package # apply any adder from npm
npx sv add --community file:./path-to-your-adder # for local testing
```

## requirements

technical requirements:

- all adders must have exactly one dependency: `@sveltejs/add-core`
- if they need to include any other dependencies they will need to do some bundeling on their side
- the major version of the referenced `@sveltejs/add-core` library must match with the major version `sv` the user is currently executing

See [submission](submission#requirements) to find additional requirements if you want list your community adder inside `sv` for the ease of use of other community members
