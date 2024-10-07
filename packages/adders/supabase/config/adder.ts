import { defineAdderConfig, dedent } from '@svelte-cli/core';
import { options as availableOptions } from './options.ts';
import { addHooksHandle, addGlobalAppInterface, hasTypeProp } from '../../common.ts';
import { common, imports } from '@svelte-cli/core/js';
import { addFromRawHtml } from '@svelte-cli/core/html';
import { demos } from './demos.ts';
import {
	appendContent,
	createSafeGetSessionType,
	createSessionType,
	createSupabaseType,
	createUserType,
	generateEnvFileContent,
	getAuthGuardHandleContent,
	getSupabaseHandleContent
} from './helpers.ts';

export const adder = defineAdderConfig({
	metadata: {
		id: 'supabase',
		name: 'Supabase',
		description: 'Supabase is an open source Firebase alternative.',
		environments: { svelte: false, kit: true },
		website: {
			logo: './supabase.svg',
			keywords: ['supabase', 'database', 'postgres', 'auth'],
			documentation: 'https://supabase.com/docs'
		}
	},
	options: availableOptions,
	packages: [
		{ name: '@supabase/supabase-js', version: '^2.45.3', dev: false },
		{
			name: '@supabase/ssr',
			version: '^0.5.1',
			dev: false,
			condition: ({ options }) => options.auth.length > 0
		},
		// Local development CLI
		{
			name: 'supabase',
			version: '^1.191.3',
			dev: true,
			condition: ({ options }) => options.cli
		}
	],
	scripts: [
		{
			description: 'Supabase CLI initialization',
			args: [
				'supabase',
				'init',
				'--force',
				'--with-intellij-settings=false',
				'--with-vscode-settings=false'
			],
			stdio: 'pipe',
			condition: ({ options }) => options.cli
		}
	],
	files: [
		{
			name: () => '.env',
			contentType: 'text',
			content: generateEnvFileContent
		},
		{
			name: () => '.env.example',
			contentType: 'text',
			content: generateEnvFileContent
		},
		// Common to all Auth options
		{
			name: ({ typescript }) => `./src/hooks.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			condition: ({ options }) => options.auth.length > 0,
			content: ({ ast, options, typescript }) => {
				const isTs = typescript;
				const { demo: isDemo } = options;

				imports.addNamed(ast, '@supabase/ssr', { createServerClient: 'createServerClient' });

				if (!isTs && isDemo) imports.addNamed(ast, '@sveltejs/kit', { redirect: 'redirect' });
				if (isTs && isDemo) {
					imports.addNamed(ast, '@sveltejs/kit', { redirect: 'redirect' });
				}

				imports.addNamed(ast, '$env/static/public', {
					PUBLIC_SUPABASE_URL: 'PUBLIC_SUPABASE_URL',
					PUBLIC_SUPABASE_ANON_KEY: 'PUBLIC_SUPABASE_ANON_KEY'
				});

				addHooksHandle(ast, typescript, 'supabase', getSupabaseHandleContent(), true);
				addHooksHandle(ast, typescript, 'authGuard', getAuthGuardHandleContent(isDemo));
			}
		},
		{
			name: () => './src/app.d.ts',
			contentType: 'script',
			condition: ({ options, typescript }) => typescript && options.auth.length > 0,
			content: ({ ast, options, typescript }) => {
				const { cli: isCli, helpers: isHelpers } = options;

				imports.addNamed(
					ast,
					'@supabase/supabase-js',
					{
						Session: 'Session',
						SupabaseClient: 'SupabaseClient',
						User: 'User'
					},
					true
				);

				if (isCli && isHelpers)
					imports.addNamed(ast, '$lib/supabase-types', { Database: 'Database' }, true);

				const locals = addGlobalAppInterface(ast, 'Locals');
				if (!locals) {
					throw new Error('Failed detecting `locals` interface in `src/app.d.ts`');
				}

				const supabase = locals.body.body.find((prop) => hasTypeProp('supabase', prop));
				const safeGetSession = locals.body.body.find((prop) => hasTypeProp('safeGetSession', prop));
				const session = locals.body.body.find((prop) => hasTypeProp('session', prop));
				const user = locals.body.body.find((prop) => hasTypeProp('user', prop));

				if (!supabase) locals.body.body.push(createSupabaseType('supabase', typescript));
				if (!safeGetSession) locals.body.body.push(createSafeGetSessionType('safeGetSession'));
				if (!session) locals.body.body.push(createSessionType('session'));
				if (!user) locals.body.body.push(createUserType('user'));

				const pageData = addGlobalAppInterface(ast, 'PageData');
				if (!pageData) {
					throw new Error('Failed detecting `pageData` interface in `src/app.d.ts`');
				}

				const pageDataSession = pageData.body.body.find((prop) => hasTypeProp('session', prop));
				if (!pageDataSession) pageData.body.body.push(createSessionType('session'));
			}
		},
		{
			name: ({ kit, typescript }) => `${kit?.routesDirectory}/+layout.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			condition: ({ options }) => options.auth.length > 0,
			content: ({ ast, typescript }) => {
				imports.addNamed(ast, '@supabase/ssr', {
					createBrowserClient: 'createBrowserClient',
					createServerClient: 'createServerClient',
					isBrowser: 'isBrowser'
				});

				imports.addNamed(ast, '$env/static/public', {
					PUBLIC_SUPABASE_ANON_KEY: 'PUBLIC_SUPABASE_ANON_KEY',
					PUBLIC_SUPABASE_URL: 'PUBLIC_SUPABASE_URL'
				});

				if (typescript) {
					imports.addNamed(ast, './$types', { LayoutLoad: 'LayoutLoad' }, true);
				}

				common.addFromString(
					ast,
					`
					export const load${typescript ? ': LayoutLoad' : ''} = async ({ data, depends, fetch }) => {
						depends('supabase:auth')

						const supabase = isBrowser()
							? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
									global: { fetch }
								})
							: createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
									global: { fetch },
									cookies: {
										getAll() {
											return data.cookies;
										}
									}
								});						

						const {
							data: { session },
						} = await supabase.auth.getSession()

						const {
							data: { user },
						} = await supabase.auth.getUser()

						return { session, supabase, user }
					}
					`
				);
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/+layout.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			condition: ({ options }) => options.auth.length > 0,
			content: ({ ast, typescript }) => {
				if (typescript) {
					imports.addNamed(ast, './$types', { LayoutServerLoad: 'LayoutServerLoad' }, true);
				}

				common.addFromString(
					ast,
					`
					export const load${typescript ? ': LayoutServerLoad' : ''} = async ({ locals: { session }, cookies }) => {
						return {
							session,
							cookies: cookies.getAll(),
						}
					}
					`
				);
			}
		},
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+layout.svelte`,
			contentType: 'svelte',
			condition: ({ options }) => options.auth.length > 0,
			content: ({ jsAst, htmlAst }) => {
				imports.addNamed(jsAst, '$app/navigation', { invalidate: 'invalidate' });
				imports.addNamed(jsAst, 'svelte', { onMount: 'onMount' });

				common.addFromString(
					jsAst,
					`
					let { children, data } = $props();
					let { session, supabase } = $derived(data);

					onMount(() => {
						const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
							if (newSession?.expires_at !== session?.expires_at) {
								invalidate('supabase:auth');
							}
						});

						return () => data.subscription.unsubscribe();
					});
					`
				);

				addFromRawHtml(htmlAst.childNodes, '{@render children?.()}');
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/auth/+page.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ options }) =>
				options.auth.includes('basic') || options.auth.includes('magic-link'),
			content: ({ options, typescript }) => {
				const isTs = typescript;
				const { auth, demo: isDemo } = options;

				const isBasic = auth.includes('basic');
				const isMagicLink = auth.includes('magic-link');

				return dedent`
					${isBasic ? `import { redirect } from '@sveltejs/kit'` : ''}
					${isDemo ? `import { PUBLIC_BASE_URL } from '$env/static/public'` : ''}
					${isTs ? `import type { Actions } from './$types'` : ''}
					
					export const actions${isTs ? ': Actions' : ''} = {${
						isBasic
							? `
						signup: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${isTs ? ' as string' : ''}
							const password = formData.get('password')${isTs ? ' as string' : ''}

							const { error } = await supabase.auth.signUp({${
								isDemo
									? `
								email,
								password,
								options: {
									emailRedirectTo: \`\${PUBLIC_BASE_URL}/private\`,
								}
							})`
									: ' email, password })'
							}
							if (error) {
								console.error(error)
								return { message: 'Something went wrong, please try again.' }
							} else {
								${
									isDemo
										? `// Redirect to local Inbucket for demo purposes
											redirect(303, \`http://localhost:54324/m/\${email}\`)`
										: `return { message: 'Sign up succeeded! Please check your email inbox.' }`
								}
							}
						},
						login: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${isTs ? ' as string' : ''}
							const password = formData.get('password')${isTs ? ' as string' : ''}

							const { error } = await supabase.auth.signInWithPassword({ email, password })
							if (error) {
								console.error(error)
								return { message: 'Something went wrong, please try again.' }
							}
							
							redirect(303, '${isDemo ? '/private' : '/'}')
						},`
							: ''
					}${
						isMagicLink
							? `
						magic: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${isTs ? ' as string' : ''}

							const { error } = await supabase.auth.signInWithOtp({ email })
							if (error) {
								console.error(error)
								return { message: 'Something went wrong, please try again.' }
							}
							
							return { message: 'Check your email inbox.' }
							
						},`
							: ''
					}
					}
					`;
			}
		},
		{
			name: ({ kit }) => `${kit?.routesDirectory}/auth/+page.svelte`,
			contentType: 'text',
			condition: ({ options }) => options.auth.length > 0,
			content: ({ options, typescript }) => {
				const isTs = typescript;
				const { auth } = options;

				const isBasic = auth.includes('basic');
				const isMagicLink = auth.includes('magic-link');

				return dedent`
					<script${isTs ? ' lang="ts"' : ''}>
						${isBasic || isMagicLink ? `import { enhance } from '$app/forms'` : ''}
						${(isBasic || isMagicLink) && isTs ? `import type { ActionData } from './$types'` : ''}

						${isBasic || isMagicLink ? `export let form${isTs ? ': ActionData' : ''}` : ''}
					</script>

					<form method="POST" use:enhance>
					${
						isBasic || isMagicLink
							? `
						<label>
							Email
							<input name="email" type="email" />
						</label>`
							: ''
					}
					${
						isBasic
							? `
						<label>
							Password
							<input name="password" type="password" />
						</label>
						<a href="/auth/forgot-password">Forgot password?</a>

						<button formaction="?/login">Login</button>
						<button formaction="?/signup">Sign up</button>`
							: ''
					}
					${isMagicLink ? '<button formaction="?/magic">Send Magic Link</button>' : ''}
					</form>
					
					
					{#if form?.message}
						<p>{form.message}</p>
					{/if}
					`;
			}
		},
		// Basic auth specific
		{
			name: ({ kit }) => `${kit?.routesDirectory}/auth/forgot-password/+page.svelte`,
			contentType: 'text',
			condition: ({ options }) => options.auth.includes('basic'),
			content: ({ typescript }) => {
				const isTs = typescript;

				return dedent`
					<script${isTs ? ' lang="ts"' : ''}>
						import { enhance } from '$app/forms'
						
						${isTs ? `import type { ActionData } from './$types'` : ''}

						export let form${isTs ? ': ActionData' : ''}
					</script>

					<form method="POST" use:enhance>
						<label>
							Email
							<input name="email" type="email" />
						</label>
						<button>Request password reset</button>
					</form>

					{#if form?.message}
						<p>{form.message}</p>
					{/if}
					`;
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/auth/forgot-password/+page.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ options }) => options.auth.includes('basic'),
			content: ({ typescript }) => {
				const isTs = typescript;

				return dedent`
					import { PUBLIC_BASE_URL } from '$env/static/public'
					${isTs ? `import type { Actions } from './$types'` : ''}

					export const actions${isTs ? ': Actions' : ''} = {
						default: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${isTs ? ' as string' : ''}

							const { error } = await supabase.auth.resetPasswordForEmail(
								email,
								{ redirectTo: \`\${PUBLIC_BASE_URL}/auth/reset-password\` }
							)
							if (error) {
								console.error(error)
								return { message: 'Something went wrong, please try again.' }
							} else {
								return { message: 'Please check your email inbox.' }
							}
						},
					}
					`;
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/auth/reset-password/+page.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ options }) => options.auth.includes('basic'),
			content: ({ typescript }) => {
				const isTs = typescript;

				return dedent`
					${isTs ? `import type { Actions } from './$types'` : ''}

					export const actions${isTs ? ': Actions' : ''} = {
						default: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const password = formData.get('password')${isTs ? ' as string' : ''}

							const { error } = await supabase.auth.updateUser({ password })
							if (error) {
								console.error(error)
								return { message: 'Something went wrong, please try again.' }
							} else {
								return { message: 'Password has been reset' }
							}
						},
					}
					`;
			}
		},
		{
			name: ({ kit }) => `${kit?.routesDirectory}/auth/reset-password/+page.svelte`,
			contentType: 'text',
			condition: ({ options }) => options.auth.includes('basic'),
			content: ({ typescript }) => {
				const isTs = typescript;

				return dedent`
					<script${isTs ? ' lang="ts"' : ''}>
						import { enhance } from '$app/forms'
						
						${isTs ? `import type { ActionData } from './$types'` : ''}

						export let form${isTs ? ': ActionData' : ''}
					</script>

					<form method="POST" use:enhance>
						<label>
							New Password
							<input name="password" type="password" />
						</label>
						<button>Reset password</button>
					</form>

					{#if form?.message}
						<p>{form.message}</p>
					{/if}
					`;
			}
		},
		// Basic auth and/or magic link
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/auth/confirm/+server.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ options }) =>
				options.auth.includes('basic') || options.auth.includes('magic-link'),
			content: ({ typescript }) => {
				const isTs = typescript;

				return dedent`
					import { error, redirect } from '@sveltejs/kit'
					import { PUBLIC_BASE_URL } from '$env/static/public'
					${
						isTs
							? dedent`import type { EmailOtpType } from '@supabase/supabase-js'
							         import type { RequestHandler } from './$types'\n`
							: ''
					}
					export const GET${isTs ? ': RequestHandler' : ''} = async ({ url, locals: { supabase } }) => {
						const token_hash = url.searchParams.get('token_hash')
						const type = url.searchParams.get('type')${isTs ? ' as EmailOtpType | null' : ''}
						const next = url.searchParams.get('next') ?? \`\${PUBLIC_BASE_URL}/\`

						const redirectTo = new URL(next)

						if (!token_hash || !type) {
							error(400, 'Bad Request');
						}

						const { error: authError } = await supabase.auth.verifyOtp({ type, token_hash })
						if (authError) {
							error(401, 'Unauthorized');
						}
							
						redirect(303, redirectTo)
					}
					`;
			}
		},
		// Admin client helper
		{
			name: ({ kit, typescript }) =>
				`${kit?.libDirectory}/server/supabase-admin.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ options }) => options.admin,
			content: ({ options, typescript }) => {
				const isTs = typescript;
				const { cli: isCli, helpers: isHelpers } = options;

				return dedent`
					import { PUBLIC_SUPABASE_URL } from '$env/static/public'
					import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
					${isTs && isCli && isHelpers ? `import type { Database } from '$lib/supabase-types'` : ''}
					import { createClient } from '@supabase/supabase-js'

					export const supabaseAdmin = createClient${isTs && isCli && isHelpers ? '<Database>' : ''}(
						PUBLIC_SUPABASE_URL,
						SUPABASE_SERVICE_ROLE_KEY,
						{
							auth: {
								autoRefreshToken: false,
								persistSession: false,
							},
						},
					);
					`;
			}
		},
		// Helper scripts
		{
			name: () => 'package.json',
			contentType: 'json',
			condition: ({ options }) => options.helpers,
			content: ({ data, typescript }) => {
				data.scripts ??= {};
				const scripts: Record<string, string> = data.scripts;
				scripts['db:migration'] ??= 'supabase migration new';
				scripts['db:migration:up'] ??= 'supabase migration up --local';
				scripts['db:reset'] ??= 'supabase db reset';
				if (typescript) {
					scripts['db:types'] ??=
						'supabase gen types typescript --local > src/lib/supabase-types.ts';
				}
			}
		},
		// CLI local development configuration
		{
			name: () => './supabase/config.toml',
			contentType: 'text',
			condition: ({ options }) => options.cli,
			content: ({ content, options }) => {
				const isBasic = options.auth.includes('basic');
				const isMagicLink = options.auth.includes('magic-link');

				content = content.replace('"http://127.0.0.1:3000"', '"http://localhost:5173"');
				content = content.replace('"https://127.0.0.1:3000"', '"https://localhost:5173/*"');

				if (isBasic) {
					content = content.replace('enable_confirmations = false', 'enable_confirmations = true');
					content = appendContent(
						content,
						dedent`
							\n# Custom email confirmation template
							[auth.email.template.confirmation]
							subject = "Confirm Your Signup"
							content_path = "./supabase/templates/confirmation.html"

							# Custom password reset request template
							[auth.email.template.recovery]
							subject = "Reset Your Password"
							content_path = "./supabase/templates/recovery.html"
							`
					);
				}
				if (isMagicLink) {
					content = appendContent(
						content,
						dedent`
							\n# Custom magic link template
							[auth.email.template.magic_link]
							subject = "Your Magic Link"
							content_path = "./supabase/templates/magic_link.html"
							`
					);
				}

				return content;
			}
		},
		{
			name: () => './supabase/templates/confirmation.html',
			contentType: 'text',
			condition: ({ options }) => options.cli && options.auth.includes('basic'),
			content: () => {
				return dedent`
					<html>
						<body>
							<h2>Confirm your signup</h2>
							<p>Follow this link to confirm your user:</p>
							<p><a
								href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}"
								>Confirm your email</a
							></p>
						</body>
					</html>
					`;
			}
		},
		{
			name: () => './supabase/templates/magic_link.html',
			contentType: 'text',
			condition: ({ options }) => options.cli && options.auth.includes('magic-link'),
			content: () => {
				return dedent`
					<html>
						<body>
							<h2>Follow this link to login:</h2>
							<p><a
								href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}"
								>Log in</a
							></p>
						</body>
					</html>
					`;
			}
		},
		{
			name: () => './supabase/templates/recovery.html',
			contentType: 'text',
			condition: ({ options }) => options.cli && options.auth.includes('basic'),
			content: () => {
				return dedent`
					<html>
						<body>
							<h2>Reset Password</h2>
							<p>Follow this link to reset your password:</p>
							<p><a
								href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}"
								>Reset Password</a
							></p>
						</body>
					</html>
					`;
			}
		},
		...demos
	],
	nextSteps: ({ options, packageManager, typescript, highlighter }) => {
		const command = packageManager === 'npm' ? 'npx' : packageManager;
		const { auth, cli: isCli, helpers: isHelpers } = options;
		const isBasic = auth.includes('basic');
		const isMagicLink = auth.includes('magic-link');

		const steps = [`Visit the Supabase docs: ${highlighter.website('https://supabase.com/docs')}`];

		if (isCli) {
			steps.push(
				`Start local Supabase services: ${highlighter.command(`${command} supabase start`)}`
			);
			steps.push(dedent`
				Changes to local Supabase config require a restart of the local services: ${highlighter.command(`${command} supabase stop`)} and ${highlighter.command(`${command} supabase start`)}`);
		}

		if (isHelpers) {
			steps.push(dedent`
				Check out ${highlighter.path('package.json')} for the helper scripts. Remember to generate your database types`);
		}

		if (isBasic || isMagicLink) {
			steps.push(dedent`
				Update authGuard in ${highlighter.path(`./src/hooks.server.${typescript ? 'ts' : 'js'}`)} with your protected routes`);
		}

		if (isBasic || isMagicLink) {
			steps.push(`Update your hosted project's email templates`);

			if (isCli) {
				steps.push(
					`Local email templates are located in ${highlighter.path('./supabase/templates')}`
				);
			}
		}

		return steps;
	}
});
