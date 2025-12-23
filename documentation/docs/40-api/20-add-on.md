---
title: add-on
---

Typically, an `add-on` looks like this:

_hover keywords in the code to have some more context_

```js
import { defineAddon, defineAddonOptions, js, parse, svelte } from 'sv/core';

// You can define options that will be prompted to the user
// if they are not provided when calling the cli directly
const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string', // string, number, boolean, select, multiselect
		default: ''
	})
	.build();

// define the addon
export default defineAddon({
	id: 'your-addon-name',
	options,

	// preparing step, check if the addon is compatible with the project
	// and if it depends on other addons
	setup: ({ kit, unsupported, dependsOn }) => {
		if (!kit) unsupported('Requires SvelteKit');
		dependsOn('tailwindcss');
	},

	// This is the actual execution of the addon.
	// Add files, edit files, etc.
	run: ({ kit, sv, options, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');

		// Add "Hello World" to the root page
		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);

			ast.fragment.nodes.push(...svelte.toFragment('<p>Hello World</p>'));

			return generateCode();
		});
	}
});
```
