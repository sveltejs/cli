import { colors, dedent, defineAdder, defineAdderOptions, log, Walker } from '@sveltejs/cli-core';
import { common, exports, imports, variables, object, functions } from '@sveltejs/cli-core/js';
// eslint-disable-next-line no-duplicate-imports
import type { AstTypes } from '@sveltejs/cli-core/js';
import { addHooksHandle, addGlobalAppInterface, hasTypeProp, createPrinter } from '../common.ts';
import { parseScript } from '@sveltejs/cli-core/parsers';

const TABLE_TYPE = {
	mysql: 'mysqlTable',
	postgresql: 'pgTable',
	sqlite: 'sqliteTable'
};

type Dialect = 'mysql' | 'postgresql' | 'sqlite';

let drizzleDialect: Dialect;
let schemaPath: string;

export const options = defineAdderOptions({
	demo: {
		type: 'boolean',
		default: false,
		question: `Do you want to include a demo? ${colors.dim('(includes a login/register page)')}`
	}
});

export default defineAdder({
	id: 'lucia',
	name: 'Lucia',
	description: 'An auth library that abstracts away the complexity of handling sessions',
	environments: { svelte: false, kit: true },
	documentation: 'https://lucia-auth.com',
	options,
	packages: [
		{ name: '@oslojs/crypto', version: '^1.0.1', dev: false },
		{ name: '@oslojs/encoding', version: '^1.1.0', dev: false },
		// password hashing for demo
		{
			name: '@node-rs/argon2',
			version: '^1.1.0',
			condition: ({ options }) => options.demo,
			dev: false
		}
	],
	dependsOn: ['drizzle'],
	files: [
		{
			name: ({ typescript }) => `drizzle.config.${typescript ? 'ts' : 'js'}`,
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);
				const isProp = (name: string, node: AstTypes.ObjectProperty) =>
					node.key.type === 'Identifier' && node.key.name === name;

				// prettier-ignore
				Walker.walk(ast as AstTypes.ASTNode, {}, {
					ObjectProperty(node) {
						if (isProp('dialect', node) && node.value.type === 'StringLiteral') {
							drizzleDialect = node.value.value as Dialect;
						}
						if (isProp('schema', node) && node.value.type === 'StringLiteral') {
							schemaPath = node.value.value;
						}
					}
				})

				if (!drizzleDialect) {
					throw new Error('Failed to detect DB dialect in your `drizzle.config.[js|ts]` file');
				}
				if (!schemaPath) {
					throw new Error('Failed to find schema path in your `drizzle.config.[js|ts]` file');
				}
				return generateCode();
			}
		},
		{
			name: () => schemaPath,
			content: ({ content, options }) => {
				const { ast, generateCode } = parseScript(content);
				const createTable = (name: string) => functions.call(TABLE_TYPE[drizzleDialect], [name]);

				const userDecl = variables.declaration(ast, 'const', 'user', createTable('user'));
				const sessionDecl = variables.declaration(ast, 'const', 'session', createTable('session'));

				const user = exports.namedExport(ast, 'user', userDecl);
				const session = exports.namedExport(ast, 'session', sessionDecl);

				const userTable = getCallExpression(user);
				const sessionTable = getCallExpression(session);

				if (!userTable || !sessionTable) {
					throw new Error('failed to find call expression of `user` or `session`');
				}

				if (userTable.arguments.length === 1) {
					userTable.arguments.push(object.createEmpty());
				}
				if (sessionTable.arguments.length === 1) {
					sessionTable.arguments.push(object.createEmpty());
				}

				const userAttributes = userTable.arguments[1];
				const sessionAttributes = sessionTable.arguments[1];
				if (
					userAttributes?.type !== 'ObjectExpression' ||
					sessionAttributes?.type !== 'ObjectExpression'
				) {
					throw new Error('unexpected shape of `user` or `session` table definition');
				}

				if (drizzleDialect === 'sqlite') {
					imports.addNamed(ast, 'drizzle-orm/sqlite-core', {
						sqliteTable: 'sqliteTable',
						text: 'text',
						integer: 'integer'
					});
					object.overrideProperties(userAttributes, {
						id: common.expressionFromString(`text('id').primaryKey()`)
					});
					if (options.demo) {
						object.overrideProperties(userAttributes, {
							username: common.expressionFromString(`text('username').notNull().unique()`),
							passwordHash: common.expressionFromString(`text('password_hash').notNull()`)
						});
					}
					object.overrideProperties(sessionAttributes, {
						id: common.expressionFromString(`text('id').primaryKey()`),
						userId: common.expressionFromString(
							`text('user_id').notNull().references(() => user.id)`
						),
						expiresAt: common.expressionFromString(
							`integer('expires_at', { mode: 'timestamp' }).notNull()`
						)
					});
				}
				if (drizzleDialect === 'mysql') {
					imports.addNamed(ast, 'drizzle-orm/mysql-core', {
						mysqlTable: 'mysqlTable',
						varchar: 'varchar',
						datetime: 'datetime'
					});
					object.overrideProperties(userAttributes, {
						id: common.expressionFromString(`varchar('id', { length: 255 }).primaryKey()`)
					});
					if (options.demo) {
						object.overrideProperties(userAttributes, {
							username: common.expressionFromString(
								`varchar('username', { length: 32 }).notNull().unique()`
							),
							passwordHash: common.expressionFromString(
								`varchar('password_hash', { length: 255 }).notNull()`
							)
						});
					}
					object.overrideProperties(sessionAttributes, {
						id: common.expressionFromString(`varchar('id', { length: 255 }).primaryKey()`),
						userId: common.expressionFromString(
							`varchar('user_id', { length: 255 }).notNull().references(() => user.id)`
						),
						expiresAt: common.expressionFromString(`datetime('expires_at').notNull()`)
					});
				}
				if (drizzleDialect === 'postgresql') {
					imports.addNamed(ast, 'drizzle-orm/pg-core', {
						pgTable: 'pgTable',
						text: 'text',
						timestamp: 'timestamp'
					});
					object.overrideProperties(userAttributes, {
						id: common.expressionFromString(`text('id').primaryKey()`)
					});
					if (options.demo) {
						object.overrideProperties(userAttributes, {
							username: common.expressionFromString(`text('username').notNull().unique()`),
							passwordHash: common.expressionFromString(`text('password_hash').notNull()`)
						});
					}
					object.overrideProperties(sessionAttributes, {
						id: common.expressionFromString(`text('id').primaryKey()`),
						userId: common.expressionFromString(
							`text('user_id').notNull().references(() => user.id)`
						),
						expiresAt: common.expressionFromString(
							`timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()`
						)
					});
				}
				let code = generateCode();
				if (!code.includes('export type Session =')) {
					code += '\n\nexport type Session = typeof session.$inferSelect;';
				}
				if (!code.includes('export type User =')) {
					code += '\n\nexport type User = typeof user.$inferSelect;';
				}
				return code;
			}
		},
		{
			name: ({ kit, typescript }) => `${kit?.libDirectory}/server/auth.${typescript ? 'ts' : 'js'}`,
			content: ({ content, typescript, kit }) => {
				if (content) {
					const filePath = `${kit!.libDirectory}/server/auth.${typescript ? 'ts' : 'js'}`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}
				const [ts] = createPrinter(typescript);
				return dedent`
					import { eq } from 'drizzle-orm';
					import { sha256 } from '@oslojs/crypto/sha2';
					import { generateRandomString } from '@oslojs/crypto/random';
					import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
					import { db } from '$lib/server/db';
					import * as table from '$lib/server/db/schema';

					const DAY_IN_MS = 1000 * 60 * 60 * 24;

					export const sessionCookieName = 'auth-session';

					function generateSessionToken()${ts(': string')} {
						const bytes = crypto.getRandomValues(new Uint8Array(20));
						const token = encodeBase32LowerCaseNoPadding(bytes);
						return token;
					}

					export function generateId(length${ts(': number')})${ts(': string')} {
						const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
						return generateRandomString({ read: (bytes) => crypto.getRandomValues(bytes) }, alphabet, length);
					}

					export async function createSession(userId${ts(': string')})${ts(': Promise<table.Session>')} {
						const token = generateSessionToken();
						const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
						const session${ts(': table.Session')} = {
							id: sessionId,
							userId,
							expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
						};
						await db.insert(table.session).values(session);
						return session;
					}

					${ts('export type SessionValidationResult = Awaited<ReturnType<typeof validateSession>>;\n')}
					export async function validateSession(sessionId${ts(': string')}) {
						const [result] = await db
							.select({
								// Adjust user table here to tweak returned data
								user: { id: table.user.id, username: table.user.username },
								session: table.session
							})
							.from(table.session)
							.innerJoin(table.user, eq(table.session.userId, table.user.id))
							.where(eq(table.session.id, sessionId));

						if (!result) {
							return { session: null, user: null };
						}
						const { session, user } = result;

						const sessionExpired = Date.now() >= session.expiresAt.getTime();
						if (sessionExpired) {
							await db.delete(table.session).where(eq(table.session.id, session.id));
							return { session: null, user: null };
						}

						const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
						if (renewSession) {
							session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
							await db
								.update(table.session)
								.set({ expiresAt: session.expiresAt })
								.where(eq(table.session.id, session.id));
						}

						return { session, user };
					}

					export async function invalidateSession(sessionId${ts(': string')})${ts(': Promise<void>')} {
						await db.delete(table.session).where(eq(table.session.id, sessionId));
					}
				`;
			}
		},
		{
			name: () => 'src/app.d.ts',
			condition: ({ typescript }) => typescript,
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);

				const locals = addGlobalAppInterface(ast, 'Locals');
				if (!locals) {
					throw new Error('Failed detecting `locals` interface in `src/app.d.ts`');
				}

				const user = locals.body.body.find((prop) => hasTypeProp('user', prop));
				const session = locals.body.body.find((prop) => hasTypeProp('session', prop));

				if (!user) {
					locals.body.body.push(createLuciaType('user'));
				}
				if (!session) {
					locals.body.body.push(createLuciaType('session'));
				}
				return generateCode();
			}
		},
		{
			name: ({ typescript }) => `src/hooks.server.${typescript ? 'ts' : 'js'}`,
			content: ({ content, typescript }) => {
				const { ast, generateCode } = parseScript(content);
				imports.addNamespace(ast, '$lib/server/auth.js', 'auth');
				imports.addNamed(ast, '$app/environment', { dev: 'dev' });
				addHooksHandle(ast, typescript, 'auth', getAuthHandleContent());
				return generateCode();
			}
		},
		// DEMO
		// login/register
		{
			name: ({ kit, typescript }) =>
				`${kit!.routesDirectory}/demo/login/+page.server.${typescript ? 'ts' : 'js'}`,
			condition: ({ options }) => options.demo,
			content({ content, typescript, kit }) {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/login/+page.server.${typescript ? 'ts' : 'js'}`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const [ts] = createPrinter(typescript);
				return dedent`
					import { dev } from '$app/environment';
					import { fail, redirect } from '@sveltejs/kit';
					import { hash, verify } from '@node-rs/argon2';
					import { eq } from 'drizzle-orm';
					import { db } from '$lib/server/db';
					import * as auth from '$lib/server/auth';
					import * as table from '$lib/server/db/schema';
					${ts(`import type { Actions, PageServerLoad } from './$types';`)}

					export const load${ts(': PageServerLoad')} = async (event) => {
						if (event.locals.user) {
							return redirect(302, '/demo');
						}
						return {};
					};

					export const actions${ts(': Actions')} = {
						login: async (event) => {
							const formData = await event.request.formData();
							const username = formData.get('username');
							const password = formData.get('password');

							if (!validateUsername(username)) {
								return fail(400, { message: 'Invalid username' });
							}
							if (!validatePassword(password)) {
								return fail(400, { message: 'Invalid password' });
							}

							const results = await db
								.select()
								.from(table.user)
								.where(eq(table.user.username, username));

							const existingUser = results.at(0);
							if (!existingUser) {
								return fail(400, { message: 'Incorrect username or password' });
							}

							const validPassword = await verify(existingUser.passwordHash, password, {
								memoryCost: 19456,
								timeCost: 2,
								outputLen: 32,
								parallelism: 1,
							});
							if (!validPassword) {
								return fail(400, { message: 'Incorrect username or password' });
							}

							const session = await auth.createSession(existingUser.id);
							event.cookies.set(auth.sessionCookieName, session.id, {
								path: '/',
								sameSite: 'lax',
								httpOnly: true,
								expires: session.expiresAt,
								secure: !dev
							});

							return redirect(302, '/demo');
						},
						register: async (event) => {
							const formData = await event.request.formData();
							const username = formData.get('username');
							const password = formData.get('password');

							if (!validateUsername(username)) {
								return fail(400, { message: 'Invalid username' });
							}
							if (!validatePassword(password)) {
								return fail(400, { message: 'Invalid password' });
							}

							const userId = auth.generateId(15);
							const passwordHash = await hash(password, {
								// recommended minimum parameters
								memoryCost: 19456,
								timeCost: 2,
								outputLen: 32,
								parallelism: 1,
							});

							try {
								await db.insert(table.user).values({ id: userId, username, passwordHash });

								const session = await auth.createSession(userId);
								event.cookies.set(auth.sessionCookieName, session.id, {
									path: '/',
									sameSite: 'lax',
									httpOnly: true,
									expires: session.expiresAt,
									secure: !dev
								});
							} catch (e) {
								return fail(500, { message: 'An error has occurred' });
							}
							return redirect(302, '/demo');
						},
					};

					function validateUsername(username${ts(': unknown')})${ts(': username is string')} {
						return (
							typeof username === 'string' &&
							username.length >= 3 &&
							username.length <= 31 &&
							/^[a-z0-9_-]+$/.test(username)
						);
					}

					function validatePassword(password${ts(': unknown')})${ts(': password is string')} {
						return (
							typeof password === 'string' &&
							password.length >= 6 &&
							password.length <= 255
						);
					}
				`;
			}
		},
		{
			name: ({ kit }) => `${kit!.routesDirectory}/demo/login/+page.svelte`,
			condition: ({ options }) => options.demo,
			content({ content, typescript, kit }) {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/login/+page.svelte`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const ts = (str: string) => (typescript ? str : '');
				return dedent`
					<script ${ts(`lang='ts'`)}>
						import { enhance } from '$app/forms';
						${ts(`import type { ActionData } from './$types';`)}

						export let form${ts(': ActionData')};
					</script>

					<h1>Login/Register</h1>
					<form method='post' action='?/login' use:enhance>
						<label>
							Username
							<input name='username' />
						</label>
						<label>
							Password
							<input type='password' name='password' />
						</label>
						<button>Login</button>
						<button formaction='?/register'>Register</button>
					</form>
					<p style='color: red'>{form?.message ?? ''}</p>
				`;
			}
		},
		// logout
		{
			name: ({ kit, typescript }) =>
				`${kit!.routesDirectory}/demo/+page.server.${typescript ? 'ts' : 'js'}`,
			condition: ({ options }) => options.demo,
			content({ content, typescript, kit }) {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/+page.server.${typescript ? 'ts' : 'js'}`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const ts = (str: string) => (typescript ? str : '');
				return dedent`
					import * as auth from '$lib/server/auth';
					import { fail, redirect } from '@sveltejs/kit';
					${ts(`import type { Actions, PageServerLoad } from './$types';`)}
					
					export const load${ts(': PageServerLoad')} = async (event) => {
						if (!event.locals.user) {
							return redirect(302, '/demo/login');
						}
						return { user: event.locals.user };
					};

					export const actions${ts(': Actions')} = {
						logout: async (event) => {
							if (!event.locals.session) {
								return fail(401);
							}
							await auth.invalidateSession(event.locals.session.id);
							event.cookies.delete(auth.sessionCookieName, { path: '/' });

							return redirect(302, '/demo/login');
						},
					};
				`;
			}
		},
		{
			name: ({ kit }) => `${kit!.routesDirectory}/demo/+page.svelte`,
			condition: ({ options }) => options.demo,
			content({ content, typescript, kit }) {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/+page.svelte`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const ts = (str: string) => (typescript ? str : '');
				return dedent`
					<script ${ts(`lang='ts'`)}>
						import { enhance } from '$app/forms';
						${ts(`import type { PageServerData } from './$types';`)}

						export let data${ts(': PageServerData')};
					</script>

					<h1>Hi, {data.user.username}!</h1>
					<p>Your user ID is {data.user.id}.</p>
					<form method='post' action='?/logout' use:enhance>
						<button>Sign out</button>
					</form>
				`;
			}
		}
	],
	nextSteps: ({ highlighter, options }) => {
		const steps = [`Run ${highlighter.command('npm run db:push')} to update your database`];
		if (options.demo) {
			steps.push(`Visit ${highlighter.route('/demo')} route to view the demo`);
		}

		return steps;
	}
});

function createLuciaType(name: string): AstTypes.TSInterfaceBody['body'][number] {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSIndexedAccessType',
				objectType: {
					type: 'TSImportType',
					argument: { type: 'StringLiteral', value: '$lib/server/auth' },
					qualifier: {
						type: 'Identifier',
						name: 'SessionValidationResult'
					}
				},
				indexType: {
					type: 'TSLiteralType',
					literal: {
						type: 'StringLiteral',
						value: name
					}
				}
			}
		}
	};
}

function getAuthHandleContent() {
	return `
		async ({ event, resolve }) => {
			const sessionId = event.cookies.get(auth.sessionCookieName);
			if (!sessionId) {
				event.locals.user = null;
				event.locals.session = null;
				return resolve(event);
			}

			const { session, user } = await auth.validateSession(sessionId);
			if (session) {
				event.cookies.set(auth.sessionCookieName, session.id, {
					path: '/',
					sameSite: 'lax',
					httpOnly: true,
					expires: session.expiresAt,
					secure: !dev
				});
			} else {
				event.cookies.delete(auth.sessionCookieName, { path: '/' });
			}

			event.locals.user = user;
			event.locals.session = session;

			return resolve(event);
		};`;
}

function getCallExpression(ast: AstTypes.ASTNode): AstTypes.CallExpression | undefined {
	let callExpression;

	// prettier-ignore
	Walker.walk(ast, {}, {
		CallExpression(node) {
			callExpression ??= node;
		},
	});

	return callExpression;
}
