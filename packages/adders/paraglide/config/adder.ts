import fs from 'node:fs';
import path from 'node:path';
import { defineAdderConfig } from '@svelte-cli/core';
import { options, parseLanguageTagInput } from './options.ts';
import { array, common, functions, imports, object, variables, exports } from '@svelte-cli/core/js';
import * as html from '@svelte-cli/core/html';

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

const warnings: string[] = [];
export const adder = defineAdderConfig({
	metadata: {
		id: 'paraglide',
		name: 'Paraglide',
		description: 'Typesafe i18n with localized routing',
		environments: { svelte: false, kit: true },
		website: {
			logo: './paraglide.png',
			keywords: [
				'i18n',
				'internationalization',
				'l10n',
				'localization',
				'routing',
				'paraglide',
				'paraglide-js',
				'paraglide-sveltekit',
				'inlang'
			],
			documentation: 'https://inlang.com/m/dxnzrydw/paraglide-sveltekit-i18n'
		}
	},
	options,
	integrationType: 'inline',
	packages: [
		{
			name: '@inlang/paraglide-sveltekit',
			version: '^0.11.0',
			dev: false
		}
	],
	files: [
		{
			// create an inlang project if it doesn't exist yet
			name: () => 'project.inlang/settings.json',
			condition: ({ cwd }) => !fs.existsSync(path.join(cwd, 'project.inlang/settings.josn')),
			contentType: 'json',
			content: ({ options, data }) => {
				for (const key in DEFAULT_INLANG_PROJECT) {
					data[key] = DEFAULT_INLANG_PROJECT[key as keyof typeof DEFAULT_INLANG_PROJECT];
				}
				const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
				const sourceLanguageTag = validLanguageTags[0];

				data.sourceLanguageTag = sourceLanguageTag;
				data.languageTags = validLanguageTags;
			}
		},
		{
			// add the vite plugin
			name: ({ typescript }) => `vite.config.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content: ({ ast }) => {
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
			}
		},
		{
			// src/lib/i18n file
			name: ({ typescript }) => `src/lib/i18n.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content({ ast }) {
				imports.addNamed(ast, '@inlang/paraglide-sveltekit', { createI18n: 'createI18n' });
				imports.addDefault(ast, '$lib/paraglide/runtime', '* as runtime');

				const createI18nExpression = common.expressionFromString('createI18n(runtime)');
				const i18n = variables.declaration(ast, 'const', 'i18n', createI18nExpression);

				const existingExport = exports.namedExport(ast, 'i18n', i18n);
				if (existingExport) {
					warnings.push('Setting up $lib/i18n failed because it aleady exports an i18n function');
				}
			}
		},
		{
			// reroute hook
			name: ({ typescript }) => `src/hooks.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content({ ast }) {
				imports.addNamed(ast, '$lib/i18n', {
					i18n: 'i18n'
				});

				const expression = common.expressionFromString('i18n.reroute()');
				const rerouteIdentifier = variables.declaration(ast, 'const', 'reroute', expression);

				const existingExport = exports.namedExport(ast, 'reroute', rerouteIdentifier);
				if (existingExport) {
					warnings.push('Adding the reroute hook automatically failed. Add it manually');
				}
			}
		},
		{
			// handle hook
			name: ({ typescript }) => `src/hooks.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content({ ast }) {
				imports.addNamed(ast, '$lib/i18n', {
					i18n: 'i18n'
				});

				const i18nHandleExpression = common.expressionFromString('i18n.handle()');
				const rerouteIdentifier = variables.declaration(
					ast,
					'const',
					'handle',
					i18nHandleExpression
				);
				const existingExport = exports.namedExport(ast, 'handle', rerouteIdentifier);
				if (existingExport) {
					// if there is an existing `handle` hook, use the `sequence` function to add i18n.handle to it
					imports.addNamed(ast, '@sveltejs/kit/hooks', {
						sequence: 'sequence'
					});

					const existingHandle = existingExport.declaration;
					if (!existingHandle || existingHandle.type !== 'VariableDeclaration') {
						warnings.push('Adding the handle hook automatically failed. Add it manually');
						return;
					}

					const sequenceExpression = functions.call('sequence', []);

					type VariableDeclarator = Extract<
						(typeof existingHandle.declarations)[number],
						{ type: 'VariableDeclarator' }
					>;
					type ExpressionKind = Exclude<VariableDeclarator['init'], null | undefined>;

					sequenceExpression.arguments = [
						i18nHandleExpression,
						...existingHandle.declarations
							.filter((decl) => decl.type === 'VariableDeclarator')
							.map((decl) => decl.init)
							.filter((exp): exp is ExpressionKind => !!exp)
					];

					const newHandle = variables.declaration(ast, 'const', 'handle', sequenceExpression);
					existingExport.declaration = newHandle;
				}
			}
		},
		{
			// add the <ParaglideJS> component to the layout
			name: ({ kit }) => `${kit?.routesDirectory}/+layout.svelte`,
			contentType: 'svelte',
			content: ({ jsAst, htmlAst }) => {
				imports.addNamed(jsAst, '@inlang/paraglide-sveltekit', {
					ParaglideJS: 'ParaglideJS'
				});
				imports.addNamed(jsAst, '$lib/i18n', {
					i18n: 'i18n'
				});

				// wrap the HTML in a ParaglideJS instance
				// TODO if (alreadyContainsParaglideJS(html.ast)) return;
				const rootChildren = htmlAst.children;
				if (rootChildren.length === 0) {
					const slot = html.element('slot');
					rootChildren.push(slot);
				}
				const root = html.element('ParaglideJS', {});
				root.attribs = {
					'{i18n}': ''
				};
				root.children = rootChildren;
				htmlAst.children = [root];
			}
		},
		{
			// add the text-direction and lang attribute placeholders to app.html
			name: () => 'src/app.html',
			contentType: 'html',
			content(editor) {
				const htmlNode = editor.ast.children.find(
					(child): child is html.HtmlElement =>
						child.type === html.HtmlElementType.Tag && child.name === 'html'
				);
				if (!htmlNode) {
					warnings.push(
						"Could not find <html> node in app.html. You'll need to add the language placeholder manually"
					);
					return;
				}
				htmlNode.attribs = {
					...htmlNode.attribs,
					lang: '%paraglide.lang%',
					dir: '%paraglide.textDirection%'
				};
			}
		},
		{
			// add usage example
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			contentType: 'svelte',
			condition: ({ options }) => options.demo,
			content({ jsAst, htmlAst, options }) {
				imports.addDefault(jsAst, '$lib/paraglide/messages.js', '* as m');
				imports.addNamed(jsAst, '$app/navigation', { goto: 'goto' });
				imports.addNamed(jsAst, '$app/stores', { page: 'page' });
				imports.addNamed(jsAst, '$lib/i18n', { i18n: 'i18n' });

				const methodStatement = common.statementFromString(`
					/**
					 * @param { import("$lib/paraglide/runtime").AvailableLanguageTag } newLanguage
					 */
					function switchToLanguage(newLanguage) {
						const canonicalPath = i18n.route($page.url.pathname);
						const localisedPath = i18n.resolveRoute(canonicalPath, newLanguage);
						goto(localisedPath);
					}
				`);
				jsAst.body.push(methodStatement);

				// add localized message
				html.addFromRawHtml(
					htmlAst.childNodes,
					`<h1>{m.hello_world({ name: 'SvelteKit User' })}</h1>`
				);

				// add links to other localized pages, the first one is the default
				// language, thus it does not require any localized route
				const { validLanguageTags } = parseLanguageTagInput(options.availableLanguageTags);
				const links = validLanguageTags
					.map((x) => `<button onclick="{() => switchToLanguage('${x}')}">${x}</button>`)
					.join('');
				const div = html.element('div');
				html.addFromRawHtml(div.childNodes, links);
				html.appendElement(htmlAst.childNodes, div);
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
			fs.writeFileSync(fullFilePath, JSON.stringify(jsonData, null, 2));
		}
	},
	nextSteps: ({ colors }) => [
		...warnings.map(colors.yellow),
		'Edit your messages in `messages/en.json`',
		'Consider installing the Sherlock IDE Extension'
	]
});