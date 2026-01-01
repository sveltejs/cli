---
title: add-on
---

Typically, an `add-on` looks like this:

_hover keywords in the code to have some more context_

```js
import { defineAddon, defineAddonOptions, parse, svelte } from 'sv/core';

// Define options that will be prompted to the user (or passed as arguments)
const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string' // boolean | number | select | multiselect
	})
	.build();

// your add-on definition, the entry point
export default defineAddon({
	id: 'your-addon-name',

	options,

	// preparing step, check requirements and dependencies
	setup: ({ dependsOn }) => {
		dependsOn('tailwindcss');
	},

	// actual execution of the addon
	run: ({ kit, cancel, sv, options }) => {
		if (!kit) return cancel('SvelteKit is required');

		// Add "Hello [who]!"" to the root page
		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);

			svelte.addFragment(ast, `<p>Hello ${options.who}!</p>`);

			return generateCode();
		});
	}
});
```
