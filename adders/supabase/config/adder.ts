import { defineAdderConfig, dedent, type TextFileEditorArgs } from '@svelte-add/core';
import { options as availableOptions } from './options';

export const adder = defineAdderConfig({
	metadata: {
		id: 'supabase',
		name: 'Supabase',
		description: `Supabase is an open source Firebase alternative.
Start your project with a Postgres database, Authentication, instant APIs, Edge Functions, Realtime subscriptions, Storage, and Vector embeddings.`,
		environments: { svelte: false, kit: true },
		website: {
			logo: './supabase.svg',
			keywords: ['supabase', 'database', 'postgres', 'auth'],
			documentation: 'https://supabase.com/docs',
		},
	},
	options: availableOptions,
	integrationType: 'inline',
	packages: [
		{ name: '@supabase/supabase-js', version: '^2.45.3', dev: false },
		{ name: '@supabase/ssr', version: '^0.5.1', dev: false },
		// Local development CLI
		{
			name: 'supabase',
			version: '^1.191.3',
			dev: true,
			condition: ({ options }) => options.cli,
		},
	],
	files: [
		{
			name: () => `.env`,
			contentType: 'text',
			content: generateEnvFileContent,
		},
		{
			name: () => `.env.example`,
			contentType: 'text',
			content: generateEnvFileContent,
		},
		{
			name: ({ typescript }) => `./src/hooks.server.${typescript.installed ? 'ts' : 'js'}`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					import { createServerClient } from '@supabase/ssr'
					import {${typescript.installed ? ' type Handle,' : ''} redirect } from '@sveltejs/kit'
					import { sequence } from '@sveltejs/kit/hooks'

					import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

					const supabase${typescript.installed ? ': Handle' : ''} = async ({ event, resolve }) => {
						event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
							cookies: {
								getAll: () => event.cookies.getAll(),
								setAll: (cookiesToSet) => {
									cookiesToSet.forEach(({ name, value, options }) => {
										event.cookies.set(name, value, { ...options, path: '/' })
									})
								},
							},
						})

						event.locals.safeGetSession = async () => {
							const {
								data: { session },
							} = await event.locals.supabase.auth.getSession()
							if (!session) {
								return { session: null, user: null }
							}

							const {
								data: { user },
								error,
							} = await event.locals.supabase.auth.getUser()
							if (error) {
								return { session: null, user: null }
							}

							return { session, user }
						}

						return resolve(event, {
							filterSerializedResponseHeaders(name) {
								return name === 'content-range' || name === 'x-supabase-api-version'
							},
						})
					}

					const authGuard${typescript.installed ? ': Handle' : ''} = async ({ event, resolve }) => {
						const { session, user } = await event.locals.safeGetSession()
						event.locals.session = session
						event.locals.user = user

						if (!event.locals.session && event.url.pathname.startsWith('/private')) {
							redirect(303, '/auth')
						}

						if (event.locals.session && event.url.pathname === '/auth') {
							redirect(303, '/private')
						}

						return resolve(event)
					}

					export const handle${typescript.installed ? ': Handle' : ''} = sequence(supabase, authGuard)
					`;
			},
		},
		{
			name: () => './src/app.d.ts',
			contentType: 'text',
			condition: ({ typescript }) => typescript.installed,
			content: () => {
				return dedent`
					import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

					declare global {
						namespace App {
							// interface Error {}
							interface Locals {
								supabase: SupabaseClient
								safeGetSession: () => Promise<{ session: Session | null; user: User | null }>
								session: Session | null
								user: User | null
							}
							interface PageData {
								session: Session | null
							}
						// interface PageState {}
						// interface Platform {}
						}
					}

					export {}
					`;
			},
		},
		{
			name: ({ kit, typescript }) =>
				`${kit.routesDirectory}/+layout.${typescript.installed ? 'ts' : 'js'}`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr'
					import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
					${typescript.installed ? `import type { LayoutLoad } from './$types'\n` : ''}
					export const load${typescript.installed ? ': LayoutLoad' : ''} = async ({ data, depends, fetch }) => {
						depends('supabase:auth')

						const supabase = isBrowser()
							? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
									global: { fetch },
								})
							: createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
									global: { fetch },
								cookies: {
									getAll() {
										return data.cookies
									},
								},
							})

						const {
							data: { session },
						} = await supabase.auth.getSession()

						const {
							data: { user },
						} = await supabase.auth.getUser()

						return { session, supabase, user }
					}
					`;
			},
		},
		{
			name: ({ kit, typescript }) =>
				`${kit.routesDirectory}/+layout.server.${typescript.installed ? 'ts' : 'js'}`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					${typescript.installed ? `import type { LayoutServerLoad } from './$types'\n` : ''}
					export const load${typescript.installed ? ': LayoutServerLoad' : ''} = async ({ locals: { session }, cookies }) => {
						return {
							session,
							cookies: cookies.getAll(),
						}
					}
					`;
			},
		},
		{
			name: ({ kit }) => `${kit.routesDirectory}/+layout.svelte`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					<script${typescript.installed ? ' lang="ts"' : ''}>
						import { invalidate } from '$app/navigation';
						import { onMount } from 'svelte';

						export let data;
						$: ({ session, supabase } = data);

						onMount(() => {
							const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
								if (newSession?.expires_at !== session?.expires_at) {
									invalidate('supabase:auth');
								}
							});

							return () => data.subscription.unsubscribe();
						});
					</script>

					<slot />
					`;
			},
		},
		{
			name: ({ kit, typescript }) =>
				`${kit.routesDirectory}/auth/+page.server.${typescript.installed ? 'ts' : 'js'}`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					import { redirect } from '@sveltejs/kit'
					${typescript.installed ? `import type { Actions } from './$types'` : ''}
					export const actions${typescript.installed ? `: Actions` : ''} = {
						signup: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${typescript.installed ? ' as string' : ''}
							const password = formData.get('password')${typescript.installed ? ' as string' : ''}

							const { error } = await supabase.auth.signUp({ email, password })
							if (error) {
								console.error(error)
								redirect(303, '/auth/error')
							} else {
								redirect(303, '/')
							}
						},
						login: async ({ request, locals: { supabase } }) => {
							const formData = await request.formData()
							const email = formData.get('email')${typescript.installed ? ' as string' : ''}
							const password = formData.get('password')${typescript.installed ? ' as string' : ''}

							const { error } = await supabase.auth.signInWithPassword({ email, password })
							if (error) {
								console.error(error)
								redirect(303, '/auth/error')
							} else {
								redirect(303, '/private')
							}
						},
					}
					`;
			},
		},
		{
			name: ({ kit }) => `${kit.routesDirectory}/auth/+page.svelte`,
			contentType: 'text',
			content: () => {
				return dedent`
					<form method="POST" action="?/login">
						<label>
							Email
							<input name="email" type="email" />
						</label>
						<label>
							Password
							<input name="password" type="password" />
						</label>
						<button>Login</button>
						<button formaction="?/signup">Sign up</button>
					</form>
					`;
			},
		},
		{
			name: ({ kit }) => `${kit.routesDirectory}/auth/error/+page.svelte`,
			contentType: 'text',
			content: () => {
				return '<p>Login error</p>';
			},
		},
		{
			name: ({ kit, typescript }) =>
				`${kit.routesDirectory}/auth/confirm/+server.${typescript.installed ? 'ts' : 'js'}`,
			contentType: 'text',
			content: ({ typescript }) => {
				return dedent`
					import { redirect } from '@sveltejs/kit'
					${
						typescript.installed
							? dedent`import type { EmailOtpType } from '@supabase/supabase-js'
							         import type { RequestHandler } from './$types'
									 `
							: ''
					}
					export const GET${typescript.installed ? ': RequestHandler' : ''} = async ({ url, locals: { supabase } }) => {
						const token_hash = url.searchParams.get('token_hash')
						const type = url.searchParams.get('type')${typescript.installed ? ' as EmailOtpType | null' : ''}
						const next = url.searchParams.get('next') ?? '/'

						const redirectTo = new URL(url)
						redirectTo.pathname = next
						redirectTo.searchParams.delete('token_hash')
						redirectTo.searchParams.delete('type')

						if (token_hash && type) {
							const { error } = await supabase.auth.verifyOtp({ type, token_hash })
							if (!error) {
								redirectTo.searchParams.delete('next')
								redirect(303, redirectTo)
							}
						}

						redirectTo.pathname = '/auth/error'
						redirect(303, redirectTo)
					}
					`;
			},
		},
	],
	nextSteps: ({ options }) => {
		const steps = ['Visit the Supabase docs: https://supabase.com/docs'];

		if (options.cli) {
			steps.push('Read the Supabase CLI Docs: https://supabase.com/docs/reference/cli');
		}

		return steps;
	},
});

function generateEnvFileContent({ content, options }: TextFileEditorArgs<typeof availableOptions>) {
	if (options.cli) {
		// Local development CLI always has the same credentials
		content = addEnvVar(content, 'PUBLIC_SUPABASE_URL', '"http://127.0.0.1:54321"');
		content = addEnvVar(
			content,
			'PUBLIC_SUPABASE_ANON_KEY',
			'"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"',
		);
	} else {
		content = addEnvVar(content, 'PUBLIC_SUPABASE_URL', '"<your_supabase_project_url>"');
		content = addEnvVar(content, 'PUBLIC_SUPABASE_ANON_KEY', '"<your_supabase_anon_key>"');
	}
	return content;
}

function addEnvVar(content: string, key: string, value: string) {
	if (!content.includes(key + '=')) {
		content = appendEnvContent(content, `${key}=${value}`);
	}
	return content;
}

function appendEnvContent(existing: string, content: string) {
	const withNewLine = !existing.length || existing.endsWith('\n') ? existing : existing + '\n';
	return withNewLine + content + '\n';
}
