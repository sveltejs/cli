import {
	type AstTypes,
	Walker,
	addToDemoPage,
	dedent,
	defineAddon,
	defineAddonOptions,
	flat,
	js,
	json,
	log,
	parse,
	resolveCommand,
	color,
	createPrinter
} from '../core.ts';
import crypto from 'node:crypto';

type Dialect = 'mysql' | 'postgresql' | 'sqlite' | 'turso';

const options = defineAddonOptions()
	.add('demo', {
		question: 'Which demo would you like to include?',
		type: 'multiselect',
		default: ['password'],
		options: [
			{ value: 'password', label: 'Email & Password' },
			{ value: 'github', label: 'GitHub OAuth' }
		],
		required: true
	})
	.build();

export default defineAddon({
	id: 'better-auth',
	shortDescription: 'auth library',
	homepage: 'https://www.better-auth.com',
	options,
	setup: ({ kit, dependencyVersion, unsupported, dependsOn, runsAfter }) => {
		if (!kit) unsupported('Requires SvelteKit');
		if (!dependencyVersion('drizzle-orm')) dependsOn('drizzle');

		runsAfter('tailwindcss');
	},
	run: ({ sv, language, options, kit, dependencyVersion, files }) => {
		if (!kit) throw new Error('SvelteKit is required');

		const demoPassword = options.demo.includes('password');
		const demoGithub = options.demo.includes('github');
		const hasDemo = demoPassword || demoGithub;

		let drizzleDialect: Dialect;

		sv.devDependency('better-auth', '^1.4.17');

		sv.file(`drizzle.config.${language}`, (content) => {
			const { ast, generateCode } = parse.script(content);
			const isProp = (name: string, node: AstTypes.Property) =>
				node.key.type === 'Identifier' && node.key.name === name;

			Walker.walk(ast as AstTypes.Node, null, {
				Property(node) {
					if (
						isProp('dialect', node) &&
						node.value.type === 'Literal' &&
						typeof node.value.value === 'string'
					) {
						drizzleDialect = node.value.value as Dialect;
					}
				}
			});

			if (!drizzleDialect) {
				throw new Error('Failed to detect DB dialect in your `drizzle.config.[js|ts]` file');
			}
			return generateCode();
		});

		sv.file('.env', (content) => {
			return flat.upsert(content, 'BETTER_AUTH_SECRET', { value: `"${crypto.randomUUID()}"` });
		});
		sv.file('.env.example', (content) => {
			content = flat.upsert(content, 'BETTER_AUTH_SECRET', { value: `""` });

			if (demoGithub) {
				content = flat.upsert(content, 'GITHUB_CLIENT_ID', {
					value: `""`,
					comment: 'GitHub OAuth'
				});
				content = flat.upsert(content, 'GITHUB_CLIENT_SECRET', { value: `""` });
			}
			return content;
		});

		sv.file(`${kit?.libDirectory}/server/auth.${language}`, (content) => {
			const { ast, generateCode, comments } = parse.script(content);

			js.imports.addNamed(ast, { from: '$lib/server/db', imports: ['db'] });
			js.imports.addNamed(ast, { from: '$app/server', imports: ['getRequestEvent'] });
			js.imports.addNamed(ast, { from: '$env/dynamic/private', imports: ['env'] });
			js.imports.addNamed(ast, { from: 'better-auth/svelte-kit', imports: ['sveltekitCookies'] });
			js.imports.addNamed(ast, {
				from: 'better-auth/adapters/drizzle',
				imports: ['drizzleAdapter']
			});
			js.imports.addNamed(ast, { from: 'better-auth', imports: ['betterAuth'] });

			const dialectMap: Record<Dialect, string> = {
				mysql: 'mysql',
				postgresql: 'pg',
				sqlite: 'sqlite',
				turso: 'sqlite'
			};
			const provider = dialectMap[drizzleDialect];

			const githubProvider = demoGithub
				? `
				socialProviders: {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET,
					},
				},`
				: '';

			const authConfig = dedent`
				export const auth = betterAuth({
					secret: env.BETTER_AUTH_SECRET,
					database: drizzleAdapter(db, {
						provider: '${provider}'
					}),
					emailAndPassword: {
						enabled: true
					},${githubProvider}
					plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
				});`;
			js.common.appendFromString(ast, { code: authConfig, comments });

			return generateCode();
		});

		const authConfigPath = `${kit?.libDirectory}/server/auth.${language}`;
		const authSchemaPath = `${kit?.libDirectory}/server/db/auth.schema.${language}`;
		// Workaround: better-auth CLI only checks tsconfig.json for path aliases,
		// so JS projects (which use jsconfig.json) need a tsconfig.json copy.
		// See: https://github.com/better-auth/better-auth/issues/7649
		if (language === 'js') {
			sv.file('tsconfig.json', (content) => {
				if (content) return content;
				// Create a tsconfig.json mirroring jsconfig.json so the CLI can resolve aliases
				return JSON.stringify({ extends: './.svelte-kit/tsconfig.json' }, null, '\t') + '\n';
			});
		}
		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);
			json.packageScriptsUpsert(
				data,
				'auth:schema',
				`npx @better-auth/cli generate --config ${authConfigPath} --output ${authSchemaPath} --yes`
			);
			return generateCode();
		});

		sv.file(`${kit?.libDirectory}/server/db/auth.schema.${language}`, (content) => {
			if (content) return content;
			return dedent`
				// This file will be overwritten when running the auth:schema script
				export const user = {};
				export const session = {};
				export const account = {};
			`;
		});

		// Re-export auth schema from the main schema file
		// Remove the default user export from drizzle (if it exists) since better-auth provides its own
		sv.file(`${kit?.libDirectory}/server/db/schema.${language}`, (content) => {
			const { ast, generateCode } = parse.script(content);

			// Import and re-export auth schema tables
			js.imports.addNamed(ast, { imports: ['user', 'session', 'account'], from: './auth.schema' });
			js.common.appendFromString(ast, { code: 'export { user, session, account };' });

			return generateCode();
		});

		sv.file('src/app.d.ts', (content) => {
			const { ast, generateCode } = parse.script(content);

			js.imports.addNamed(ast, {
				imports: ['User', 'Session'],
				from: 'better-auth',
				isType: true
			});

			const locals = js.kit.addGlobalAppInterface(ast, { name: 'Locals' });
			if (!locals) {
				throw new Error('Failed detecting `locals` interface in `src/app.d.ts`');
			}

			const user = locals.body.body.find((prop) =>
				js.common.hasTypeProperty(prop, { name: 'user' })
			);
			const session = locals.body.body.find((prop) =>
				js.common.hasTypeProperty(prop, { name: 'session' })
			);

			function addProps(
				name: string,
				value: string,
				optional = false
			): AstTypes.TSInterfaceBody['body'][number] {
				return {
					type: 'TSPropertySignature',
					key: {
						type: 'Identifier',
						name
					},
					computed: false,
					optional,
					typeAnnotation: {
						type: 'TSTypeAnnotation',
						typeAnnotation: {
							type: 'TSTypeReference',
							typeName: {
								type: 'Identifier',
								name: value
							}
						}
					}
				};
			}

			if (!user) {
				locals.body.body.push(addProps('user', 'User', true));
			}
			if (!session) {
				locals.body.body.push(addProps('session', 'Session', true));
			}
			return generateCode();
		});

		sv.file(`src/hooks.server.${language}`, (content) => {
			const { ast, generateCode, comments } = parse.script(content);

			js.imports.addNamed(ast, { imports: ['svelteKitHandler'], from: 'better-auth/svelte-kit' });
			js.imports.addNamed(ast, { imports: ['auth'], from: '$lib/server/auth' });
			js.imports.addNamed(ast, { imports: ['building'], from: '$app/environment' });

			const handleContent = dedent`
				async ({ event, resolve }) => {
					// Fetch current session from Better Auth
					const session = await auth.api.getSession({
						headers: event.request.headers
					});
					// Make session and user available on server
					if (session) {
						event.locals.session = session.session;
						event.locals.user = session.user;
					}
					return svelteKitHandler({ event, resolve, auth, building });
				};

				export const handle = sequence(handleBetterAuth, handleSession);
			`;
			js.kit.addHooksHandle(ast, {
				language,
				newHandleName: 'handleBetterAuth',
				handleContent,
				comments
			});

			return generateCode();
		});

		if (hasDemo) {
			sv.file(`${kit?.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, 'better-auth', language);
			});

			sv.file(
				`${kit!.routesDirectory}/demo/better-auth/login/+page.server.${language}`,
				(content) => {
					if (content) {
						const filePath = `${kit!.routesDirectory}/demo/better-auth/login/+page.server.${language}`;
						log.warn(`Existing ${color.warning(filePath)} file. Could not update.`);
						return content;
					}

					const [ts] = createPrinter(language === 'ts');

					const signInEmailAction = demoPassword
						? `
						signInEmail: async (event) => {
							const formData = await event.request.formData();
							const email = formData.get('email')?.toString() ?? '';
							const password = formData.get('password')?.toString() ?? '';

							try {
								await auth.api.signInEmail({
									body: {
										email,
										password,
										callbackURL: '/auth/verification-success'
									}
								});
							} catch (error) {
								if (error instanceof APIError) {
									return fail(400, { message: error.message || 'Signin failed' });
								}
								return fail(500, { message: 'Unexpected error' });
							}

							return redirect(302, '/demo/better-auth');
						},
						signUpEmail: async (event) => {
							const formData = await event.request.formData();
							const email = formData.get('email')?.toString() ?? '';
							const password = formData.get('password')?.toString() ?? '';
							const name = formData.get('name')?.toString() ?? '';

							try {
								await auth.api.signUpEmail({
									body: {
										email,
										password,
										name,
										callbackURL: '/auth/verification-success'
									}
								});
							} catch (error) {
								if (error instanceof APIError) {
									return fail(400, { message: error.message || 'Registration failed' });
								}
								return fail(500, { message: 'Unexpected error' });
							}

							return redirect(302, '/demo/better-auth');
						},`
						: '';

					const signInSocialAction = demoGithub
						? `
						signInSocial: async (event) => {
							const formData = await event.request.formData();
							const provider = formData.get('provider')?.toString() ?? 'github';
							const callbackURL = formData.get('callbackURL')?.toString() ?? '/demo/better-auth';

							const result = await auth.api.signInSocial({
								body: {
									provider: provider${ts(' as "github"')},
									callbackURL
								}
							});

							if (result.url) {
								return redirect(302, result.url);
							}
							return fail(400, { message: 'Social sign-in failed' });
						},`
						: '';

					const needsAPIError = demoPassword;

					return dedent`
					import { fail, redirect } from '@sveltejs/kit';
					${ts("import type { Actions } from './$types';")}
					${ts("import type { PageServerLoad } from './$types';")}
					import { auth } from '$lib/server/auth';
					${needsAPIError ? "import { APIError } from 'better-auth';" : ''}

					export const load${ts(': PageServerLoad')} = async (event) => {
						if (event.locals.user) {
							return redirect(302, '/demo/better-auth');
						}
						return {};
					};

					export const actions${ts(': Actions')} = {${signInEmailAction}${signInSocialAction}
					};
				`;
				}
			);

			sv.file(`${kit!.routesDirectory}/demo/better-auth/login/+page.svelte`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/better-auth/login/+page.svelte`;
					log.warn(`Existing ${color.warning(filePath)} file. Could not update.`);
					return content;
				}

				const tailwind = dependencyVersion('@tailwindcss/vite') !== undefined;
				const input = tailwind
					? ' class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"'
					: '';
				const btn = tailwind
					? ' class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"'
					: '';

				const svelte5 = !!dependencyVersion('svelte')?.startsWith('5');
				const [ts, s5] = createPrinter(language === 'ts', svelte5);

				const passwordForm = demoPassword
					? `
					<form method="post" action="?/signInEmail" use:enhance>
						<label>
							Email
							<input type="email" name="email"${input} />
						</label>
						<label>
							Password
							<input type="password" name="password"${input} />
						</label>
						<label>
							Name (for registration)
							<input name="name"${input} />
						</label>
						<button${btn}>Login</button>
						<button formaction="?/signUpEmail"${btn}>Register</button>
					</form>
					${tailwind ? `<p class="text-red-500">{form?.message ?? ''}</p>` : `<p style="color: red">{form?.message ?? ''}</p>`}`
					: '';

				const separator =
					demoPassword && demoGithub ? `\n\n					<hr ${tailwind ? 'class="my-4"' : ''} />` : '';

				const githubForm = demoGithub
					? `
					<form method="post" action="?/signInSocial" use:enhance>
						<input type="hidden" name="provider" value="github" />
						<input type="hidden" name="callbackURL" value="/demo/better-auth" />
						<button${btn}>Sign in with GitHub</button>
					</form>`
					: '';

				return dedent`
					<script ${ts("lang='ts'")}>
						import { enhance } from '$app/forms';
						${ts("import type { ActionData } from './$types';\n")}
						${s5(`let { form }${ts(': { form: ActionData }')} = $props();`, `export let form${ts(': ActionData')};`)}
					</script>

					<h1>Login</h1>${passwordForm}${separator}${githubForm}
				`;
			});

			sv.file(`${kit!.routesDirectory}/demo/better-auth/+page.server.${language}`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/better-auth/+page.server.${language}`;
					log.warn(`Existing ${color.warning(filePath)} file. Could not update.`);
					return content;
				}

				const [ts] = createPrinter(language === 'ts');
				return dedent`
					import { redirect } from '@sveltejs/kit';
					${ts("import type { Actions } from './$types';")}
					${ts("import type { PageServerLoad } from './$types';")}
					import { auth } from '$lib/server/auth';

					export const load${ts(': PageServerLoad')} = async (event) => {
						if (!event.locals.user) {
							return redirect(302, '/demo/better-auth/login');
						}
						return { user: event.locals.user };
					};

					export const actions${ts(': Actions')} = {
						signOut: async (event) => {
							await auth.api.signOut({
								headers: event.request.headers
							});
							return redirect(302, '/demo/better-auth/login');
						}
					};
				`;
			});

			sv.file(`${kit!.routesDirectory}/demo/better-auth/+page.svelte`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/better-auth/+page.svelte`;
					log.warn(`Existing ${color.warning(filePath)} file. Could not update.`);
					return content;
				}

				const tailwind = dependencyVersion('@tailwindcss/vite') !== undefined;
				const twBtnClasses =
					'class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"';

				const svelte5 = !!dependencyVersion('svelte')?.startsWith('5');
				const [ts, s5] = createPrinter(language === 'ts', svelte5);
				return dedent`
					<script ${ts("lang='ts'")}>
						import { enhance } from '$app/forms';
						${ts("import type { PageServerData } from './$types';\n")}
						${s5(`let { data }${ts(': { data: PageServerData }')} = $props();`, `export let data${ts(': PageServerData')};`)}
					</script>

					<h1>Hi, {data.user.name}!</h1>
					<p>Your user ID is {data.user.id}.</p>
					<form method="post" action="?/signOut" use:enhance>
						<button ${tailwind ? twBtnClasses : ''}>Sign out</button>
					</form>
				`;
			});
		}
	},

	nextSteps: ({ options, packageManager }) => {
		const { command: authCmd, args: authArgs } = resolveCommand(packageManager, 'run', [
			'auth:schema'
		])!;
		const { command: dbCmd, args: dbArgs } = resolveCommand(packageManager, 'run', ['db:push'])!;
		const steps = [
			`Run ${color.command(`${authCmd} ${authArgs.join(' ')}`)} to generate the auth schema`,
			`Run ${color.command(`${dbCmd} ${dbArgs.join(' ')}`)} to update your database`,
			`Check ${color.env('BETTER_AUTH_SECRET')} in ${color.path('.env')} and adjust it to your needs`,
			`Set ${color.env('BETTER_AUTH_SECRET')} in your production environment`
		];
		if (options.demo.includes('github')) {
			steps.push(
				`Set ${color.env('GITHUB_CLIENT_ID')} and ${color.env('GITHUB_CLIENT_SECRET')} in ${color.path('.env')} for GitHub OAuth`
			);
		}
		if (options.demo.length > 0) {
			steps.push(`Visit ${color.route('/demo/better-auth')} route to view the demo`);
		}

		return steps;
	}
});
