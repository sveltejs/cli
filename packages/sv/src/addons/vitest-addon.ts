import { color, dedent, js, parse, json } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const options = defineAddonOptions()
	.add('usages', {
		question: 'What do you want to use vitest for?',
		type: 'multiselect',
		default: ['unit', 'component'],
		options: [
			{ value: 'unit', label: 'unit testing' },
			{ value: 'component', label: 'component testing' }
		],
		required: true
	})
	.build();

// Manage only version before current
let vitestV3Installed = false;

export default defineAddon({
	id: 'vitest',
	shortDescription: 'unit testing',
	homepage: 'https://vitest.dev',
	options,

	run: ({ sv, file, language, kit, options, dependencyVersion }) => {
		const unitTesting = options.usages.includes('unit');
		const componentTesting = options.usages.includes('component');

		vitestV3Installed = (dependencyVersion('vitest') ?? '')
			.replaceAll('^', '')
			.replaceAll('~', '')
			?.startsWith('3.');

		sv.devDependency('vitest', '^4.1.0');

		if (componentTesting) {
			sv.devDependency('@vitest/browser-playwright', '^4.1.0');
			sv.devDependency('vitest-browser-svelte', '^2.0.2');
			sv.devDependency('playwright', '^1.58.2');
		}

		sv.file(file.package, (content) => {
			const { data, generateCode } = parse.json(content);

			json.packageScriptsUpsert(data, 'test:unit', 'vitest');
			// we use `--run` so that vitest doesn't run in watch mode when running `npm run test`
			json.packageScriptsUpsert(data, 'test', 'npm run test:unit -- --run', { mode: 'prepend' });

			return generateCode();
		});

		const examplesDir = (kit ? kit.libDirectory : 'src/lib') + '/vitest-examples';
		const typed = language === 'ts';

		if (unitTesting || componentTesting) {
			sv.file(`${examplesDir}/greet.${language}`, (content) => {
				if (content) return content;

				return dedent`
					export function greet(${typed ? 'name: string' : 'name'})${typed ? ': string' : ''} {
						return 'Hello, ' + name + '!';
					}
				`;
			});
		}

		if (unitTesting) {
			sv.file(`${examplesDir}/greet.spec.${language}`, (content) => {
				if (content) return content;

				return dedent`
					import { describe, it, expect } from 'vitest';
					import { greet } from './greet';

					describe('greet', () => {
						it('returns a greeting', () => {
							expect(greet('Svelte')).toBe('Hello, Svelte!');
						});
					});
				`;
			});
		}

		if (componentTesting) {
			sv.file(`${examplesDir}/Welcome.svelte`, (content) => {
				if (content) return content;

				return dedent`
					<script>
						import { greet } from './greet';

						let { host = 'SvelteKit', guest = 'Vitest' } = $props();
					</script>

					<h1>{greet(host)}</h1>
					<p>{greet(guest)}</p>
				`;
			});

			sv.file(`${examplesDir}/Welcome.svelte.spec.${language}`, (content) => {
				if (content) return content;

				return dedent`
					import { page } from 'vitest/browser';
					import { describe, expect, it } from 'vitest';
					import { render } from 'vitest-browser-svelte';
					import Welcome from './Welcome.svelte';

					describe('Welcome.svelte', () => {
						it('renders greetings for host and guest', async () => {
							render(Welcome, { host: 'SvelteKit', guest: 'Vitest' });

							await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, SvelteKit!');
							await expect.element(page.getByText('Hello, Vitest!')).toBeInTheDocument();
						});
					});
				`;
			});
		}

		sv.file(file.viteConfig, (content) => {
			const { ast, generateCode } = parse.script(content);

			const clientObjectExpression = js.object.create({
				extends: `./${file.viteConfig}`,
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: js.functions.createCall({ name: 'playwright', args: [] }),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			});

			const serverObjectExpression = js.object.create({
				extends: `./${file.viteConfig}`,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			});

			const viteConfig = js.vite.getConfig(ast);

			const testObject = js.object.property(viteConfig, {
				name: 'test',
				fallback: js.object.create({
					expect: {
						requireAssertions: true
					}
				})
			});

			const workspaceArray = js.object.property(testObject, {
				name: 'projects',
				fallback: js.array.create()
			});

			if (componentTesting) js.array.append(workspaceArray, clientObjectExpression);
			if (unitTesting) js.array.append(workspaceArray, serverObjectExpression);

			// Manage imports
			if (componentTesting)
				js.imports.addNamed(ast, { imports: ['playwright'], from: '@vitest/browser-playwright' });
			const importName = 'defineConfig';
			const { statement, alias } = js.imports.find(ast, { name: importName, from: 'vite' });
			if (statement) {
				// Switch the import from 'vite' to 'vitest/config' (keeping the alias)
				js.imports.addNamed(ast, { imports: { defineConfig: alias }, from: 'vitest/config' });

				// Remove the old import
				js.imports.remove(ast, { name: importName, from: 'vite', statement });
			}

			return generateCode();
		});
	},

	nextSteps: ({ language, options }) => {
		const toReturn: string[] = [];

		if (vitestV3Installed) {
			const componentTesting = options.usages.includes('component');
			if (componentTesting) {
				toReturn.push(`Uninstall ${color.command('@vitest/browser')} package`);
				toReturn.push(
					`Update usage from ${color.command("'@vitest/browser...'")} to ${color.command("'vitest/browser'")}`
				);
			}
			toReturn.push(
				`${color.optional('Optional')} Check ${color.path('./vite.config.ts')} and remove duplicate project definitions`
			);
			toReturn.push(
				`${color.optional('Optional')} Remove ${color.path(`./vitest-setup-client.${language}`)} file`
			);
		}

		return toReturn;
	}
});
