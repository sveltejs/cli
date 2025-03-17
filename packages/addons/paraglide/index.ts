import MagicString from 'magic-string';
import { colors, defineAddon, defineAddonOptions, log } from '@sveltejs/cli-core';
import {
	array,
	common,
	functions,
	imports,
	object,
	variables,
	exports,
	kit as kitJs
} from '@sveltejs/cli-core/js';
import * as html from '@sveltejs/cli-core/html';
import { parseHtml, parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import { addToDemoPage } from '../common.ts';

const DEFAULT_INLANG_PROJECT = {
	$schema: 'https://inlang.com/schema/project-settings',
	modules: [
		'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@2/dist/index.js'
	],
	'plugin.inlang.messageFormat': {
		pathPattern: './messages/{locale}.json'
	}
};

const options = defineAddonOptions({
	availableLanguageTags: {
		question: `Which languages would you like to support? ${colors.gray('(e.g. en,de-ch)')}`,
		type: 'string',
		default: 'en, es',
		validate(input) {
			const { invalidLanguageTags, validLanguageTags } = parseLanguageTagInput(input);

			if (invalidLanguageTags.length > 0) {
				if (invalidLanguageTags.length === 1) {
					return `The input "${invalidLanguageTags[0]}" is not a valid IETF BCP 47 language tag`;
				} else {
					const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
					return `The inputs ${listFormat.format(invalidLanguageTags.map((x) => `"${x}"`))} are not valid BCP47 language tags`;
				}
			}
			if (validLanguageTags.length === 0)
				return 'Please enter at least one valid BCP47 language tag. Eg: en';

			return undefined;
		}
	},
	demo: {
		type: 'boolean',
		default: true,
		question: 'Do you want to include a demo?'
	}
});

export default defineAddon({
	id: 'paraglide',
	shortDescription: 'i18n',
	homepage: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, typescript, kit }) => {
		const ext = typescript ? 'ts' : 'js';
		if (!kit) throw new Error('SvelteKit is required');

		const paraglideOutDir = 'src/lib/paraglide';

		sv.dependency('@inlang/paraglide-js', '^2.0.0');

		sv.file('project.inlang/settings.json', (content) => {
			if (content) return content;

			const { data, generateCode } = parseJson(content);

			for (const key in DEFAULT_INLANG_PROJECT) {
				data[key] = DEFAULT_INLANG_PROJECT[key as keyof typeof DEFAULT_INLANG_PROJECT];
			}
			const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
			const baseLocale = validLanguageTags[0];

			data.baseLocale = baseLocale;
			data.locales = validLanguageTags;

			return generateCode();
		});

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'paraglideVitePlugin';
			imports.addNamed(ast, '@inlang/paraglide-js', { paraglideVitePlugin: vitePluginName });

			const { value: rootObject } = exports.defaultExport(ast, functions.call('defineConfig', []));
			const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

			const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
			const pluginFunctionCall = functions.call(vitePluginName, []);
			const pluginConfig = object.create({
				project: common.createLiteral('./project.inlang'),
				outdir: common.createLiteral(`./${paraglideOutDir}`)
			});
			functions.argumentByIndex(pluginFunctionCall, 0, pluginConfig);
			array.push(pluginsArray, pluginFunctionCall);

			return generateCode();
		});

		// reroute hook
		sv.file(`src/hooks.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, '$lib/paraglide/runtime', {
				deLocalizeUrl: 'deLocalizeUrl'
			});

			const expression = common.expressionFromString(
				'(request) => deLocalizeUrl(request.url).pathname'
			);
			const rerouteIdentifier = variables.declaration(ast, 'const', 'reroute', expression);

			const existingExport = exports.namedExport(ast, 'reroute', rerouteIdentifier);
			if (existingExport.declaration !== rerouteIdentifier) {
				log.warn('Adding the reroute hook automatically failed. Add it manually');
			}

			return generateCode();
		});

		// handle hook
		sv.file(`src/hooks.server.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, '$lib/paraglide/server', {
				paraglideMiddleware: 'paraglideMiddleware'
			});

			const hookHandleContent = `({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});`;
			kitJs.addHooksHandle(ast, typescript, 'handleParaglide', hookHandleContent);

			return generateCode();
		});

		// add the text-direction and lang attribute placeholders to app.html
		sv.file('src/app.html', (content) => {
			const { ast, generateCode } = parseHtml(content);

			const htmlNode = ast.children.find(
				(child): child is html.HtmlElement =>
					child.type === html.HtmlElementType.Tag && child.name === 'html'
			);
			if (!htmlNode) {
				log.warn(
					"Could not find <html> node in app.html. You'll need to add the language placeholder manually"
				);
				return generateCode();
			}
			htmlNode.attribs = {
				...htmlNode.attribs,
				lang: '%paraglide.lang%'
			};

			return generateCode();
		});

		sv.file('.gitignore', (content) => {
			if (!content) return content;

			if (!content.includes(`\n${paraglideOutDir}`)) {
				content = content.trimEnd() + `\n\n# Paraglide\n${paraglideOutDir}`;
			}
			return content;
		});

		if (options.demo) {
			sv.file(`${kit.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, 'paraglide');
			});

			// add usage example
			sv.file(`${kit.routesDirectory}/demo/paraglide/+page.svelte`, (content) => {
				const { script, template, generateCode } = parseSvelte(content, { typescript });

				imports.addNamed(script.ast, '$lib/paraglide/messages.js', { m: 'm' });
				imports.addNamed(script.ast, '$app/navigation', { goto: 'goto' });
				imports.addNamed(script.ast, '$app/state', { page: 'page' });
				imports.addNamed(script.ast, '$lib/paraglide/runtime', {
					setLocale: 'setLocale'
				});

				const scriptCode = new MagicString(script.generateCode());

				const templateCode = new MagicString(template.source);

				// add localized message
				templateCode.append("\n\n<h1>{m.hello_world({ name: 'SvelteKit User' })}</h1>\n");

				// add links to other localized pages, the first one is the default
				// language, thus it does not require any localized route
				const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
				const links = validLanguageTags
					.map(
						(x) =>
							`${templateCode.getIndentString()}<button onclick={() => setLocale('${x}')}>${x}</button>`
					)
					.join('\n');
				templateCode.append(`<div>\n${links}\n</div>`);

				templateCode.append(
					'<p>\nIf you use VSCode, install the <a href="https://marketplace.visualstudio.com/items?itemName=inlang.vs-code-extension" target="_blank">Sherlock i18n extension</a> for a better i18n experience.\n</p>'
				);

				return generateCode({ script: scriptCode.toString(), template: templateCode.toString() });
			});
		}

		const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
		for (const languageTag of validLanguageTags) {
			sv.file(`messages/${languageTag}.json`, (content) => {
				const { data, generateCode } = parseJson(content);
				data['$schema'] = 'https://inlang.com/schema/inlang-message-format';
				data.hello_world = `Hello, {name} from ${languageTag}!`;
				return generateCode();
			});
		}
	},

	nextSteps: ({ highlighter }) => {
		const steps = [`Edit your messages in ${highlighter.path('messages/en.json')}`];
		if (options.demo) {
			steps.push(`Visit ${highlighter.route('/demo/paraglide')} route to view the demo`);
		}

		return steps;
	}
});

const isValidLanguageTag = (languageTag: string): boolean =>
	// Regex vendored in from https://github.com/opral/monorepo/blob/94c2298cc1da5378b908e4c160b0fa71a45caadb/inlang/source-code/versioned-interfaces/language-tag/src/interface.ts#L16
	RegExp(
		'^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?))(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*))$'
	).test(languageTag);

function parseLanguageTagInput(input: string): {
	validLanguageTags: string[];
	invalidLanguageTags: string[];
} {
	const probablyLanguageTags = input
		.replace(/[,:\s]/g, ' ') // replace common separators with spaces
		.split(' ')
		.filter(Boolean) // remove empty segments
		.map((tag) => tag.toLowerCase());

	const validLanguageTags: string[] = [];
	const invalidLanguageTags: string[] = [];

	for (const tag of probablyLanguageTags) {
		if (isValidLanguageTag(tag)) validLanguageTags.push(tag);
		else invalidLanguageTags.push(tag);
	}

	return {
		validLanguageTags,
		invalidLanguageTags
	};
}
