import MagicString from 'magic-string';
import {
	colors,
	dedent,
	defineAddon,
	defineAddonOptions,
	log,
	utils,
	Walker
} from '@sveltejs/cli-core';
import * as js from '@sveltejs/cli-core/js';
import type { AstTypes } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';
import { addToDemoPage } from '../common.ts';

const TABLE_TYPE = {
	mysql: 'mysqlTable',
	postgresql: 'pgTable',
	sqlite: 'sqliteTable'
};

type Dialect = 'mysql' | 'postgresql' | 'sqlite';

let drizzleDialect: Dialect;
let schemaPath: string;

const options = defineAddonOptions({
	demo: {
		type: 'boolean',
		default: true,
		question: `Do you want to include a demo? ${colors.dim('(includes a login/register page)')}`
	}
});

export default defineAddon({
	id: 'lucia',
	shortDescription: 'auth guide',
	homepage: 'https://lucia-auth.com',
	options,
	setup: ({ kit, dependencyVersion, unsupported, dependsOn }) => {
		if (!kit) unsupported('Requires SvelteKit');
		if (!dependencyVersion('drizzle-orm')) dependsOn('drizzle');
	},
	run: ({ sv, typescript, options, kit, dependencyVersion }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.dependency('@oslojs/crypto', '^1.0.1');
		sv.dependency('@oslojs/encoding', '^1.1.0');

		if (options.demo) {
			// password hashing for demo
			sv.dependency('@node-rs/argon2', '^1.1.0');
		}

		sv.file(`drizzle.config.${ext}`, (content) => {
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
		});

		sv.file(schemaPath, (content) => {
			const { ast, generateCode } = parseScript(content);
			const createTable = (name: string) => js.functions.call(TABLE_TYPE[drizzleDialect], [name]);

			const userDecl = js.variables.declaration(ast, 'const', 'user', createTable('user'));
			const sessionDecl = js.variables.declaration(ast, 'const', 'session', createTable('session'));

			const user = js.exports.namedExport(ast, 'user', userDecl);
			const session = js.exports.namedExport(ast, 'session', sessionDecl);

			const userTable = getCallExpression(user);
			const sessionTable = getCallExpression(session);

			if (!userTable || !sessionTable) {
				throw new Error('failed to find call expression of `user` or `session`');
			}

			if (userTable.arguments.length === 1) {
				userTable.arguments.push(js.object.createEmpty());
			}
			if (sessionTable.arguments.length === 1) {
				sessionTable.arguments.push(js.object.createEmpty());
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
				js.imports.addNamed(ast, 'drizzle-orm/sqlite-core', {
					sqliteTable: 'sqliteTable',
					text: 'text',
					integer: 'integer'
				});
				js.object.overrideProperties(userAttributes, {
					id: js.common.expressionFromString("text('id').primaryKey()")
				});
				if (options.demo) {
					js.object.overrideProperties(userAttributes, {
						username: js.common.expressionFromString("text('username').notNull().unique()"),
						passwordHash: js.common.expressionFromString("text('password_hash').notNull()")
					});
				}
				js.object.overrideProperties(sessionAttributes, {
					id: js.common.expressionFromString("text('id').primaryKey()"),
					userId: js.common.expressionFromString(
						"text('user_id').notNull().references(() => user.id)"
					),
					expiresAt: js.common.expressionFromString(
						"integer('expires_at', { mode: 'timestamp' }).notNull()"
					)
				});
			}
			if (drizzleDialect === 'mysql') {
				js.imports.addNamed(ast, 'drizzle-orm/mysql-core', {
					mysqlTable: 'mysqlTable',
					varchar: 'varchar',
					datetime: 'datetime'
				});
				js.object.overrideProperties(userAttributes, {
					id: js.common.expressionFromString("varchar('id', { length: 255 }).primaryKey()")
				});
				if (options.demo) {
					js.object.overrideProperties(userAttributes, {
						username: js.common.expressionFromString(
							"varchar('username', { length: 32 }).notNull().unique()"
						),
						passwordHash: js.common.expressionFromString(
							"varchar('password_hash', { length: 255 }).notNull()"
						)
					});
				}
				js.object.overrideProperties(sessionAttributes, {
					id: js.common.expressionFromString("varchar('id', { length: 255 }).primaryKey()"),
					userId: js.common.expressionFromString(
						"varchar('user_id', { length: 255 }).notNull().references(() => user.id)"
					),
					expiresAt: js.common.expressionFromString("datetime('expires_at').notNull()")
				});
			}
			if (drizzleDialect === 'postgresql') {
				js.imports.addNamed(ast, 'drizzle-orm/pg-core', {
					pgTable: 'pgTable',
					text: 'text',
					timestamp: 'timestamp'
				});
				js.object.overrideProperties(userAttributes, {
					id: js.common.expressionFromString("text('id').primaryKey()")
				});
				if (options.demo) {
					js.object.overrideProperties(userAttributes, {
						username: js.common.expressionFromString("text('username').notNull().unique()"),
						passwordHash: js.common.expressionFromString("text('password_hash').notNull()")
					});
				}
				js.object.overrideProperties(sessionAttributes, {
					id: js.common.expressionFromString("text('id').primaryKey()"),
					userId: js.common.expressionFromString(
						"text('user_id').notNull().references(() => user.id)"
					),
					expiresAt: js.common.expressionFromString(
						"timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()"
					)
				});
			}

			let code = generateCode();
			if (typescript) {
				if (!code.includes('export type Session =')) {
					code += '\n\nexport type Session = typeof session.$inferSelect;';
				}
				if (!code.includes('export type User =')) {
					code += '\n\nexport type User = typeof user.$inferSelect;';
				}
			}
			return code;
		});

		sv.file(`${kit?.libDirectory}/server/auth.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			js.imports.addNamespace(ast, '$lib/server/db/schema', 'table');
			js.imports.addNamed(ast, '$lib/server/db', { db: 'db' });
			js.imports.addNamed(ast, '@oslojs/encoding', {
				encodeBase64url: 'encodeBase64url',
				encodeHexLowerCase: 'encodeHexLowerCase'
			});
			js.imports.addNamed(ast, '@oslojs/crypto/sha2', { sha256: 'sha256' });
			js.imports.addNamed(ast, 'drizzle-orm', { eq: 'eq' });
			if (typescript) {
				js.imports.addNamed(ast, '@sveltejs/kit', { RequestEvent: 'RequestEvent' }, true);
			}

			const ms = new MagicString(generateCode().trim());
			const [ts] = utils.createPrinter(typescript);

			if (!ms.original.includes('const DAY_IN_MS')) {
				ms.append('\n\nconst DAY_IN_MS = 1000 * 60 * 60 * 24;');
			}
			if (!ms.original.includes('export const sessionCookieName')) {
				ms.append("\n\nexport const sessionCookieName = 'auth-session';");
			}
			if (!ms.original.includes('export function generateSessionToken')) {
				const generateSessionToken = dedent`					
					export function generateSessionToken() {
						const bytes = crypto.getRandomValues(new Uint8Array(18));
						const token = encodeBase64url(bytes);
						return token;
					}`;
				ms.append(`\n\n${generateSessionToken}`);
			}
			if (!ms.original.includes('async function createSession')) {
				const createSession = dedent`
					${ts('', '/**')}
					${ts('', ' * @param {string} token')}
					${ts('', ' * @param {string} userId')}
					${ts('', ' */')}
					export async function createSession(token${ts(': string')}, userId${ts(': string')}) {
						const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
						const session${ts(': table.Session')} = {
							id: sessionId,
							userId,
							expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
						};
						await db.insert(table.session).values(session);
						return session;
					}`;
				ms.append(`\n\n${createSession}`);
			}
			if (!ms.original.includes('async function validateSessionToken')) {
				const validateSessionToken = dedent`					
					${ts('', '/** @param {string} token */')}
					export async function validateSessionToken(token${ts(': string')}) {
						const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
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
					}`;
				ms.append(`\n\n${validateSessionToken}`);
			}
			if (typescript && !ms.original.includes('export type SessionValidationResult')) {
				const sessionType =
					'export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;';
				ms.append(`\n\n${sessionType}`);
			}
			if (!ms.original.includes('async function invalidateSession')) {
				const invalidateSession = dedent`					
					${ts('', '/** @param {string} sessionId */')}
					export async function invalidateSession(sessionId${ts(': string')}) {
						await db.delete(table.session).where(eq(table.session.id, sessionId));
					}`;
				ms.append(`\n\n${invalidateSession}`);
			}
			if (!ms.original.includes('export function setSessionTokenCookie')) {
				const setSessionTokenCookie = dedent`					
					${ts('', '/**')}
					${ts('', ' * @param {import("@sveltejs/kit").RequestEvent} event')}
					${ts('', ' * @param {string} token')}
					${ts('', ' * @param {Date} expiresAt')}
					${ts('', ' */')}
					export function setSessionTokenCookie(event${ts(': RequestEvent')}, token${ts(': string')}, expiresAt${ts(': Date')}) {
						event.cookies.set(sessionCookieName, token, {
							expires: expiresAt,
							path: '/'
						});
					}`;
				ms.append(`\n\n${setSessionTokenCookie}`);
			}
			if (!ms.original.includes('export function deleteSessionTokenCookie')) {
				const deleteSessionTokenCookie = dedent`					
					${ts('', '/** @param {import("@sveltejs/kit").RequestEvent} event */')}
					export function deleteSessionTokenCookie(event${ts(': RequestEvent')}) {
						event.cookies.delete(sessionCookieName, {
							path: '/'
						});
					}`;
				ms.append(`\n\n${deleteSessionTokenCookie}`);
			}

			return ms.toString();
		});

		if (typescript) {
			sv.file('src/app.d.ts', (content) => {
				const { ast, generateCode } = parseScript(content);

				const locals = js.kit.addGlobalAppInterface(ast, 'Locals');
				if (!locals) {
					throw new Error('Failed detecting `locals` interface in `src/app.d.ts`');
				}

				const user = locals.body.body.find((prop) => js.common.hasTypeProp('user', prop));
				const session = locals.body.body.find((prop) => js.common.hasTypeProp('session', prop));

				if (!user) {
					locals.body.body.push(createLuciaType('user'));
				}
				if (!session) {
					locals.body.body.push(createLuciaType('session'));
				}
				return generateCode();
			});
		}

		sv.file(`src/hooks.server.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);
			js.imports.addNamespace(ast, '$lib/server/auth.js', 'auth');
			js.kit.addHooksHandle(ast, typescript, 'handleAuth', getAuthHandleContent());
			return generateCode();
		});

		if (options.demo) {
			sv.file(`${kit?.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, 'lucia');
			});

			sv.file(`${kit!.routesDirectory}/demo/lucia/login/+page.server.${ext}`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/lucia/login/+page.server.${typescript ? 'ts' : 'js'}`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const [ts] = utils.createPrinter(typescript);
				return dedent`
					import { hash, verify } from '@node-rs/argon2';
					import { encodeBase32LowerCase } from '@oslojs/encoding';
					import { fail, redirect } from '@sveltejs/kit';
					import { eq } from 'drizzle-orm';
					import * as auth from '$lib/server/auth';
					import { db } from '$lib/server/db';
					import * as table from '$lib/server/db/schema';
					${ts("import type { Actions, PageServerLoad } from './$types';\n")}
					export const load${ts(': PageServerLoad')} = async (event) => {
						if (event.locals.user) {
							return redirect(302, '/demo/lucia');
						}
						return {};
					};

					export const actions${ts(': Actions')} = {
						login: async (event) => {
							const formData = await event.request.formData();
							const username = formData.get('username');
							const password = formData.get('password');

							if (!validateUsername(username)) {
								return fail(400, { message: 'Invalid username (min 3, max 31 characters, alphanumeric only)' });
							}
							if (!validatePassword(password)) {
								return fail(400, { message: 'Invalid password (min 6, max 255 characters)' });
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

							const sessionToken = auth.generateSessionToken();
							const session = await auth.createSession(sessionToken, existingUser.id);
							auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

							return redirect(302, '/demo/lucia');
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

							const userId = generateUserId();
							const passwordHash = await hash(password, {
								// recommended minimum parameters
								memoryCost: 19456,
								timeCost: 2,
								outputLen: 32,
								parallelism: 1,
							});

							try {
								await db.insert(table.user).values({ id: userId, username, passwordHash });

								const sessionToken = auth.generateSessionToken();
								const session = await auth.createSession(sessionToken, userId);
								auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
							} catch (e) {
								return fail(500, { message: 'An error has occurred' });
							}
							return redirect(302, '/demo/lucia');
						},
					};

					function generateUserId() {
						// ID with 120 bits of entropy, or about the same as UUID v4.
						const bytes = crypto.getRandomValues(new Uint8Array(15));
						const id = encodeBase32LowerCase(bytes);
						return id;
					}

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
			});

			sv.file(`${kit!.routesDirectory}/demo/lucia/login/+page.svelte`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/lucia/login/+page.svelte`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const svelte5 = !!dependencyVersion('svelte')?.startsWith('5');
				const [ts, s5] = utils.createPrinter(typescript, svelte5);
				return dedent`
					<script ${ts("lang='ts'")}>
						import { enhance } from '$app/forms';
						${ts("import type { ActionData } from './$types';\n")}
						${s5(`let { form }${ts(': { form: ActionData }')} = $props();`, `export let form${ts(': ActionData')};`)}
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
			});

			sv.file(`${kit!.routesDirectory}/demo/lucia/+page.server.${ext}`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/lucia/+page.server.${typescript ? 'ts' : 'js'}`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const [ts] = utils.createPrinter(typescript);
				return dedent`
					import * as auth from '$lib/server/auth';
					import { fail, redirect } from '@sveltejs/kit';
					${ts("import type { Actions, PageServerLoad } from './$types';\n")}
					export const load${ts(': PageServerLoad')} = async (event) => {
						if (!event.locals.user) {
							return redirect(302, '/demo/lucia/login');
						}
						return { user: event.locals.user };
					};

					export const actions${ts(': Actions')} = {
						logout: async (event) => {
							if (!event.locals.session) {
								return fail(401);
							}
							await auth.invalidateSession(event.locals.session.id);
							auth.deleteSessionTokenCookie(event);

							return redirect(302, '/demo/lucia/login');
						},
					};
				`;
			});

			sv.file(`${kit!.routesDirectory}/demo/lucia/+page.svelte`, (content) => {
				if (content) {
					const filePath = `${kit!.routesDirectory}/demo/lucia/+page.svelte`;
					log.warn(`Existing ${colors.yellow(filePath)} file. Could not update.`);
					return content;
				}

				const svelte5 = !!dependencyVersion('svelte')?.startsWith('5');
				const [ts, s5] = utils.createPrinter(typescript, svelte5);
				return dedent`
					<script ${ts("lang='ts'")}>
						import { enhance } from '$app/forms';
						${ts("import type { PageServerData } from './$types';\n")}
						${s5(`let { data }${ts(': { data: PageServerData }')} = $props();`, `export let data${ts(': PageServerData')};`)}
					</script>

					<h1>Hi, {data.user.username}!</h1>
					<p>Your user ID is {data.user.id}.</p>
					<form method='post' action='?/logout' use:enhance>
						<button>Sign out</button>
					</form>
				`;
			});
		}
	},
	nextSteps: ({ highlighter, options, packageManager }) => {
		const steps = [
			`Run ${highlighter.command(`${packageManager} run db:push`)} to update your database schema`
		];
		if (options.demo) {
			steps.push(`Visit ${highlighter.route('/demo/lucia')} route to view the demo`);
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
			const sessionToken = event.cookies.get(auth.sessionCookieName);
			if (!sessionToken) {
				event.locals.user = null;
				event.locals.session = null;
				return resolve(event);
			}

			const { session, user } = await auth.validateSessionToken(sessionToken);
			if (session) {
				auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			} else {
				auth.deleteSessionTokenCookie(event);
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
