import { transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'handle devtools json in dev mode',
	options: {},

	run: ({ sv, language }) => {
		sv.file(
			`src/hooks.server.${language}`,
			transforms.script(({ ast, comments, js }) => {
				js.imports.addNamed(ast, { imports: ['dev'], from: '$app/environment' });

				const handleContent = `({ event, resolve }) => {
		if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
			return new Response(undefined, { status: 404 });
		}
		return resolve(event);
	};`;

				js.kit.addHooksHandle(ast, {
					language,
					newHandleName: 'handleDevtoolsJson',
					handleContent,
					comments
				});
			})
		);
	}
});
