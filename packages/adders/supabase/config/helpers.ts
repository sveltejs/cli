import type { AstTypes, TextFileEditor } from '@svelte-cli/core';
import { options as availableOptions } from './options.ts';

export function generateEnvFileContent({
	content,
	options
}: TextFileEditor<typeof availableOptions>) {
	const isCli = options.cli;

	content = addEnvVar(content, 'PUBLIC_BASE_URL', '"http://localhost:5173"');
	content = addEnvVar(
		content,
		'PUBLIC_SUPABASE_URL',
		// Local development env always has the same credentials, prepopulate the local dev env file
		isCli ? '"http://127.0.0.1:54321"' : '"<your_supabase_project_url>"'
	);
	content = addEnvVar(
		content,
		'PUBLIC_SUPABASE_ANON_KEY',
		// Local development env always has the same credentials, prepopulate the local dev env file
		isCli
			? '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"'
			: '"<your_supabase_anon_key>"'
	);

	content = options.admin
		? addEnvVar(
				content,
				'SUPABASE_SERVICE_ROLE_KEY',
				// Local development env always has the same credentials, prepopulate the local dev env file
				isCli
					? '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"'
					: '"<your_supabase_service_role_key>"'
			)
		: content;

	return content;
}

export function addEnvVar(content: string, key: string, value: string) {
	if (!content.includes(key + '=')) {
		content = appendContent(content, `${key}=${value}`);
	}
	return content;
}

export function appendContent(existing: string, content: string) {
	const withNewLine = !existing.length || existing.endsWith('\n') ? existing : existing + '\n';
	return withNewLine + content + '\n';
}

export function createSupabaseType(
	name: string,
	typescript: boolean
): AstTypes.TSInterfaceBody['body'][number] {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSTypeReference',
				typeName: {
					type: 'Identifier',
					name: 'SupabaseClient'
				},
				typeParameters: typescript
					? {
							type: 'TSTypeParameterInstantiation',
							params: [
								{
									type: 'TSTypeReference',
									typeName: {
										type: 'Identifier',
										name: 'Database'
									}
								}
							]
						}
					: undefined
			}
		}
	};
}

export function createSafeGetSessionType(name: string): AstTypes.TSInterfaceBody['body'][number] {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSFunctionType',
				typeAnnotation: {
					type: 'TSTypeAnnotation',
					typeAnnotation: {
						type: 'TSTypeReference',
						typeName: {
							type: 'Identifier',
							name: 'Promise'
						},
						typeParameters: {
							type: 'TSTypeParameterInstantiation',
							params: [
								{
									type: 'TSTypeLiteral',
									members: [createSessionType('session'), createUserType('user')]
								}
							]
						}
					}
				},
				parameters: []
			}
		}
	};
}

export function createSessionType(name: string): AstTypes.TSPropertySignature {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSUnionType',
				types: [
					{
						type: 'TSTypeReference',
						typeName: {
							type: 'Identifier',
							name: 'Session'
						}
					},
					{
						type: 'TSNullKeyword'
					}
				]
			}
		}
	};
}

export function createUserType(name: string): AstTypes.TSPropertySignature {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSUnionType',
				types: [
					{
						type: 'TSTypeReference',
						typeName: {
							type: 'Identifier',
							name: 'User'
						}
					},
					{
						type: 'TSNullKeyword'
					}
				]
			}
		}
	};
}

export function getSupabaseHandleContent() {
	return `
		async ({ event, resolve }) => {
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
		});
	};`;
}

export function getAuthGuardHandleContent(isDemo: boolean) {
	return `
		async ({ event, resolve }) => {
			const { session, user } = await event.locals.safeGetSession()
			event.locals.session = session
			event.locals.user = user
			${
				isDemo
					? `
			if (!event.locals.session && event.url.pathname.startsWith('/private')) {
				redirect(303, '/auth')
			}

			if (event.locals.session && event.url.pathname === '/auth') {
				redirect(303, '/private')
			}
			`
					: `
			// Add authentication guards here
			`
			}
			return resolve(event);
		}`;
}
