import fs from 'node:fs';
import path from 'node:path';
import MagicString from 'magic-string';
import { dedent, defineAdder, defineAdderOptions, log, utils } from '@sveltejs/cli-core';
import {
	array,
	common,
	functions,
	imports,
	object,
	variables,
	exports,
	kit
} from '@sveltejs/cli-core/js';
import * as html from '@sveltejs/cli-core/html';
import { parseHtml, parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';

const DEFAULT_INLANG_PROJECT = {
	$schema: 'https://inlang.com/schema/project-settings',
	modules: [
		'https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-empty-pattern@1/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-identical-pattern@1/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-missing-translation@1/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-without-source@1/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-valid-js-identifier@1/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@2/dist/index.js',
		'https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@0/dist/index.js'
	],
	'plugin.inlang.messageFormat': {
		pathPattern: './messages/{languageTag}.json'
	}
};

export const options = defineAdderOptions({
	availableLanguageTags: {
		question: 'Which language tags would you like to support?',
		type: 'string',
		default: '',
		placeholder: 'en,de-ch',
		validate(input: any) {
			const { invalidLanguageTags, validLanguageTags } = parseLanguageTagInput(input);

			if (invalidLanguageTags.length > 0) {
				if (invalidLanguageTags.length === 1) {
					return `The input "${invalidLanguageTags[0]}" is not a valid BCP47 language tag`;
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
		default: false,
		question: 'Do you want to include a demo?'
	}
});

export default defineAdder({
	id: 'paraglide',
	name: 'Paraglide',
	description: 'Typesafe i18n with localised routing',
	environments: { svelte: false, kit: true },
	documentation: 'https://inlang.com/m/dxnzrydw/paraglide-sveltekit-i18n',
	options,
	packages: [
		{
			name: '@inlang/paraglide-sveltekit',
			version: '^0.11.1',
			dev: false
		}
	],
	files: [
		{
			// create an inlang project if it doesn't exist yet
			name: () => 'project.inlang/settings.json',
			condition: ({ cwd }) => !fs.existsSync(path.join(cwd, 'project.inlang/settings.json')),
			content: ({ options, content }) => {
				const { data, generateCode } = parseJson(content);

				for (const key in DEFAULT_INLANG_PROJECT) {
					data[key] = DEFAULT_INLANG_PROJECT[key as keyof typeof DEFAULT_INLANG_PROJECT];
				}
				const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
				const sourceLanguageTag = validLanguageTags[0];

				data.sourceLanguageTag = sourceLanguageTag;
				data.languageTags = validLanguageTags;

				return generateCode();
			}
		},
		{
			// add the vite plugin
			name: ({ typescript }) => `vite.config.${typescript ? 'ts' : 'js'}`,
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);

				const vitePluginName = 'paraglide';
				imports.addNamed(ast, '@inlang/paraglide-sveltekit/vite', {
					paraglide: vitePluginName
				});

				const { value: rootObject } = exports.defaultExport(
					ast,
					functions.call('defineConfig', [])
				);
				const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

				const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
				const pluginFunctionCall = functions.call(vitePluginName, []);
				const pluginConfig = object.create({
					project: common.createLiteral('./project.inlang'),
					outdir: common.createLiteral('./src/lib/paraglide')
				});
				functions.argumentByIndex(pluginFunctionCall, 0, pluginConfig);
				array.push(pluginsArray, pluginFunctionCall);

				return generateCode();
			}
		},
		{
			// src/lib/i18n file
			name: ({ typescript }) => `src/lib/i18n.${typescript ? 'ts' : 'js'}`,
			content({ content }) {
				const { ast, generateCode } = parseScript(content);

				imports.addNamed(ast, '@inlang/paraglide-sveltekit', { createI18n: 'createI18n' });
				imports.addDefault(ast, '$lib/paraglide/runtime', '* as runtime');

				const createI18nExpression = common.expressionFromString('createI18n(runtime)');
				const i18n = variables.declaration(ast, 'const', 'i18n', createI18nExpression);

				const existingExport = exports.namedExport(ast, 'i18n', i18n);
				if (existingExport.declaration != i18n) {
					log.warn('Setting up $lib/i18n failed because it already exports an i18n function');
				}

				return generateCode();
			}
		},
		{
			// reroute hook
			name: ({ typescript }) => `src/hooks.${typescript ? 'ts' : 'js'}`,
			content({ content }) {
				const { ast, generateCode } = parseScript(content);

				imports.addNamed(ast, '$lib/i18n', {
					i18n: 'i18n'
				});

				const expression = common.expressionFromString('i18n.reroute()');
				const rerouteIdentifier = variables.declaration(ast, 'const', 'reroute', expression);

				const existingExport = exports.namedExport(ast, 'reroute', rerouteIdentifier);
				if (existingExport.declaration != rerouteIdentifier) {
					log.warn('Adding the reroute hook automatically failed. Add it manually');
				}

				return generateCode();
			}
		},
		{
			// handle hook
			name: ({ typescript }) => `src/hooks.server.${typescript ? 'ts' : 'js'}`,
			content({ content, typescript }) {
				const { ast, generateCode } = parseScript(content);

				imports.addNamed(ast, '$lib/i18n', {
					i18n: 'i18n'
				});

				const hookHandleContent = 'i18n.handle()';
				kit.addHooksHandle(ast, typescript, 'paraglide', hookHandleContent);

				return generateCode();
			}
		},
		{
			// add the <ParaglideJS> component to the layout
			name: ({ kit }) => `${kit?.routesDirectory}/+layout.svelte`,
			content: ({ content, dependencyVersion, typescript }) => {
				const { script, template, generateCode } = parseSvelte(content, { typescript });

				const paraglideComponentName = 'ParaglideJS';
				imports.addNamed(script.ast, '@inlang/paraglide-sveltekit', {
					[paraglideComponentName]: paraglideComponentName
				});
				imports.addNamed(script.ast, '$lib/i18n', {
					i18n: 'i18n'
				});

				if (template.source.length === 0) {
					const svelteVersion = dependencyVersion('svelte');
					if (!svelteVersion) throw new Error('Failed to determine svelte version');

					html.addSlot(script.ast, template.ast, svelteVersion);
				}

				const templateCode = new MagicString(template.generateCode());
				if (!templateCode.original.includes('<ParaglideJS')) {
					templateCode.indent();
					templateCode.prepend('<ParaglideJS {i18n}>\n');
					templateCode.append('\n</ParaglideJS>');
				}

				return generateCode({ script: script.generateCode(), template: templateCode.toString() });
			}
		},
		{
			// add the text-direction and lang attribute placeholders to app.html
			name: () => 'src/app.html',
			content: ({ content }) => {
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
					lang: '%paraglide.lang%',
					dir: '%paraglide.textDirection%'
				};

				return generateCode();
			}
		},
		{
			// add usage example
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			condition: ({ options }) => options.demo,
			content({ content, options, typescript }) {
				const { script, template, generateCode } = parseSvelte(content);

				imports.addDefault(script.ast, '$lib/paraglide/messages.js', '* as m');
				imports.addNamed(script.ast, '$app/navigation', { goto: 'goto' });
				imports.addNamed(script.ast, '$app/stores', { page: 'page' });
				imports.addNamed(script.ast, '$lib/i18n', { i18n: 'i18n' });
				if (typescript) {
					imports.addNamed(
						script.ast,
						'$lib/paraglide/runtime',
						{ AvailableLanguageTag: 'AvailableLanguageTag' },
						true
					);
				}

				const { ts } = utils.createPrinter({ ts: typescript });

				const scriptCode = new MagicString(script.generateCode());
				if (!scriptCode.original.includes('function switchToLanguage')) {
					scriptCode.trim();
					scriptCode.append('\n\n');
					scriptCode.append(dedent`
					${ts('', '/**')} 
					${ts('', '* @param import("$lib/paraglide/runtime").AvailableLanguageTag newLanguage')} 
					${ts('', '*/')} 
					function switchToLanguage(newLanguage${ts(': AvailableLanguageTag')}) {
						const canonicalPath = i18n.route($page.url.pathname);
						const localisedPath = i18n.resolveRoute(canonicalPath, newLanguage);
						goto(localisedPath);
					}
				`);
				}

				// add localized message
				html.addFromRawHtml(
					template.ast.childNodes,
					`\n\n<h1>{m.hello_world({ name: 'SvelteKit User' })}</h1>\n`
				);

				// add links to other localized pages, the first one is the default
				// language, thus it does not require any localized route
				const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
				const links = validLanguageTags
					.map((x) => `\n\t<button onclick="{() => switchToLanguage('${x}')}">${x}</button>`)
					.join('');
				const div = html.element('div');
				html.addFromRawHtml(div.childNodes, `${links}\n`);
				html.appendElement(template.ast.childNodes, div);

				return generateCode({ script: scriptCode.toString(), template: template.generateCode() });
			}
		}
	],
	postInstall: ({ cwd, options }) => {
		const jsonData: Record<string, string> = {};
		jsonData['$schema'] = 'https://inlang.com/schema/inlang-message-format';

		const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
		for (const languageTag of validLanguageTags) {
			jsonData.hello_world = `Hello, {name} from ${languageTag}!`;

			const filePath = `messages/${languageTag}.json`;
			const directoryPath = path.dirname(filePath);
			const fullDirectoryPath = path.join(cwd, directoryPath);
			const fullFilePath = path.join(cwd, filePath);

			fs.mkdirSync(fullDirectoryPath, { recursive: true });
			fs.writeFileSync(fullFilePath, JSON.stringify(jsonData, null, 2) + '\n');
		}
	},
	nextSteps: ({ highlighter }) => [
		`Edit your messages in ${highlighter.path('messages/en.json')}`,
		'Consider installing the Sherlock IDE Extension'
	]
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
