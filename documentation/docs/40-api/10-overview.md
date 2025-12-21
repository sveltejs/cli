---
title: Overview
---

Typically, add `add-on` looks like this:

```js
import { defineAddon, defineAddonOptions, js, parse, svelte } from 'sv/core';

// You can define options that will be prompted to the user if they are not provided when calling the cli.
const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string', // string, number, boolean, select, multiselect
		default: ''
	})
	.build();

export default defineAddon({
	id: 'your-addon-name',
	options,

	// This is called before the addon is run.
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},

	// This is the actual execution of the addon... Add files, edit files, etc.
	run: ({ kit, sv, options, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');

		// add/edit a file
		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);

			ast.fragment.nodes.push(...svelte.toFragment('<p>Hello World</p>'));

			return generateCode();
		});
	}
});
```
