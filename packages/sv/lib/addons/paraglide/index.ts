import { colors, defineAddon, defineAddonOptions, log } from '../../core/index.ts';
import {
	common,
	imports,
	variables,
	exports,
	kit as kitJs,
	vite
} from '../../core/tooling/js/index.ts';
import * as html from '../../core/tooling/html/index.ts';
import * as svelte from '../../core/tooling/svelte/index.ts';
import { parseHtml, parseJson, parseScript, parseSvelte } from '../../core/tooling/parsers.ts';
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

const options = defineAddonOptions()
	.add('languageTags', {
		question: `Which languages would you like to support? ${colors.gray('(e.g. en,de-ch)')}`,
		type: 'string',
		default: 'en, es',
		validate(input) {
			if (!input) return;

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
	})
	.add('demo', {
		type: 'boolean',
		default: true,
		question: 'Do you want to include a demo?'
	})
	.build();

export default defineAddon({
	id: 'paraglide',
	shortDescription: 'i18n',
	homepage: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, files, ext, kit }) => {
		if (!kit) throw new Error('SvelteKit is required');

		const paraglideOutDir = 'src/lib/paraglide';

		sv.devDependency('@inlang/paraglide-js', '^2.6.0');

		// add the vite plugin
		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'paraglideVitePlugin';
			imports.addNamed(ast, { imports: [vitePluginName], from: '@inlang/paraglide-js' });
			vite.addPlugin(ast, {
				code: `${vitePluginName}({ 
					project: './project.inlang', 
					outdir: './${paraglideOutDir}' 
				})`
			});

			return generateCode();
		});

		// reroute hook
		sv.file(`src/hooks.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);
			imports.addNamed(ast, {
				from: '$lib/paraglide/runtime',
				imports: ['deLocalizeUrl']
			});

			const expression = common.parseExpression('(request) => deLocalizeUrl(request.url).pathname');
			const rerouteIdentifier = variables.declaration(ast, {
				kind: 'const',
				name: 'reroute',
				value: expression
			});

			const existingExport = exports.createNamed(ast, {
				name: 'reroute',
				fallback: rerouteIdentifier
			});
			if (existingExport.declaration !== rerouteIdentifier) {
				log.warn('Adding the reroute hook automatically failed. Add it manually');
			}

			return generateCode();
		});

		// handle hook
		sv.file(`src/hooks.server.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);
			imports.addNamed(ast, {
				from: '$lib/paraglide/server',
				imports: ['paraglideMiddleware']
			});

			const hookHandleContent = `({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});`;
			kitJs.addHooksHandle(ast, {
				ext,
				newHandleName: 'handleParaglide',
				handleContent: hookHandleContent
			});

			return generateCode();
		});

		// add the lang attribute placeholder to app.html
		sv.file('src/app.html', (content) => {
			const { ast, generateCode } = parseHtml(content);

			const htmlNode = ast.nodes.find(
				(child): child is html.SvelteAst.RegularElement =>
					child.type === 'RegularElement' && child.name === 'html'
			);
			if (!htmlNode) {
				log.warn(
					"Could not find <html> node in app.html. You'll need to add the language placeholder manually"
				);
				return generateCode();
			}
			html.addAttribute(htmlNode, 'lang', '%paraglide.lang%');

			return generateCode();
		});

		sv.file(files.gitignore, (content) => {
			if (!content) return content;

			if (!content.includes(`\n${paraglideOutDir}`)) {
				content = content.trimEnd() + `\n\n# Paraglide\n${paraglideOutDir}\nproject.inlang/cache/`;
			}
			return content;
		});

		sv.file('project.inlang/settings.json', (content) => {
			if (content) return content;

			const { data, generateCode } = parseJson(content);

			for (const key in DEFAULT_INLANG_PROJECT) {
				data[key] = DEFAULT_INLANG_PROJECT[key as keyof typeof DEFAULT_INLANG_PROJECT];
			}
			const { validLanguageTags } = parseLanguageTagInput(options.languageTags);
			const baseLocale = validLanguageTags[0];

			data.baseLocale = baseLocale;
			data.locales = validLanguageTags;

			return generateCode();
		});

		sv.file(`${kit.routesDirectory}/+layout.svelte`, (content) => {
			const { ast, script, generateCode } = parseSvelte(content, {
				ensureScript: { ext }
			});

			imports.addNamed(script, {
				imports: ['locales', 'localizeHref'],
				from: '$lib/paraglide/runtime'
			});
			imports.addNamed(script, { imports: ['page'], from: '$app/state' });
			ast.fragment.nodes.push(
				...svelte.toFragment(`<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>`)
			);
			return generateCode();
		});

		if (options.demo) {
			sv.file(`${kit.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, 'paraglide', ext);
			});

			// add usage example
			sv.file(`${kit.routesDirectory}/demo/paraglide/+page.svelte`, (content) => {
				const { ast, script, generateCode } = parseSvelte(content, {
					ensureScript: { ext }
				});

				imports.addNamed(script, { imports: { m: 'm' }, from: '$lib/paraglide/messages.js' });
				imports.addNamed(script, {
					imports: {
						setLocale: 'setLocale'
					},
					from: '$lib/paraglide/runtime'
				});

				// add localized message
				let templateCode = "<h1>{m.hello_world({ name: 'SvelteKit User' })}</h1>";

				// add links to other localized pages, the first one is the default
				// language, thus it does not require any localized route
				const { validLanguageTags } = parseLanguageTagInput(options.languageTags);
				const links = validLanguageTags
					.map((x) => `<button onclick={() => setLocale('${x}')}>${x}</button>`)
					.join('');
				templateCode += `<div>${links}</div>`;

				templateCode +=
					'<p>If you use VSCode, install the <a href="https://marketplace.visualstudio.com/items?itemName=inlang.vs-code-extension" target="_blank">Sherlock i18n extension</a> for a better i18n experience.</p>';

				ast.fragment.nodes.push(...svelte.toFragment(templateCode));

				return generateCode();
			});
		}

		const { validLanguageTags } = parseLanguageTagInput(options.languageTags);
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
