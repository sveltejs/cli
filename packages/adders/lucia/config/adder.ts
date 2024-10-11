import { options } from './options.ts';
import { colors, dedent, defineAdder, log, Walker } from '@svelte-cli/core';
import { common, exports, imports, variables, object, functions } from '@svelte-cli/core/js';
// eslint-disable-next-line no-duplicate-imports
import type { AstTypes } from '@svelte-cli/core/js';
import { addHooksHandle, addGlobalAppInterface, hasTypeProp } from '../../common.ts';
import { parseScript } from '@svelte-cli/core/parsers';

const LUCIA_ADAPTER = {
	mysql: 'DrizzleMySQLAdapter',
	postgresql: 'DrizzlePostgreSQLAdapter',
	sqlite: 'DrizzleSQLiteAdapter'
} as const;

const TABLE_TYPE = {
	mysql: 'mysqlTable',
	postgresql: 'pgTable',
	sqlite: 'sqliteTable'
};

type Dialect = keyof typeof LUCIA_ADAPTER;

let drizzleDialect: Dialect;
let schemaPath: string;

export const adder = defineAdder({
	id: 'lucia',
	name: 'Lucia',
	description: 'An auth library that abstracts away the complexity of handling sessions',
	environments: { svelte: false, kit: true },
	logo: './lucia.webp',
	documentation: 'https://lucia-auth.com',
	options,
	packages: [
		{ name: 'lucia', version: '^3.2.0', dev: false },
		{ name: '@lucia-auth/adapter-drizzle', version: '^1.1.0', dev: false },
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
						expiresAt: common.expressionFromString(`integer('expires_at').notNull()`)
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
				return generateCode();
			}
		},
		{
			name: ({ kit, typescript }) => `${kit?.libDirectory}/server/auth.${typescript ? 'ts' : 'js'}`,
			content: ({ content, typescript, options }) => {
				const { ast, generateCode } = parseScript(content);
				const adapter = LUCIA_ADAPTER[drizzleDialect];

				imports.addNamed(ast, '$lib/server/db/schema.js', { user: 'user', session: 'session' });
				imports.addNamed(ast, '$lib/server/db', { db: 'db' });
				imports.addNamed(ast, 'lucia', { Lucia: 'Lucia' });
				imports.addNamed(ast, '@lucia-auth/adapter-drizzle', { [adapter]: adapter });
				imports.addNamed(ast, '$app/environment', { dev: 'dev' });

				// adapter
				const adapterDecl = common.statementFromString(
					`const adapter = new ${adapter}(db, session, user);`
				);
				common.addStatement(ast, adapterDecl);

				// lucia export
				const luciaInit = common.expressionFromString(`
					new Lucia(adapter, {
						sessionCookie: {
							attributes: {
								secure: !dev
							}
						},
						${options.demo ? 'getUserAttributes: (attributes) => ({ username: attributes.username })' : ''}
					})`);
				const luciaDecl = variables.declaration(ast, 'const', 'lucia', luciaInit);
				exports.namedExport(ast, 'lucia', luciaDecl);

				// module declaration
				if (typescript && !/declare module ["']lucia["']/.test(content)) {
					const moduleDecl = common.statementFromString(`
						declare module 'lucia' {
							interface Register {
								Lucia: typeof lucia;
								// attributes that are already included are omitted
								DatabaseUserAttributes: Omit<typeof user.$inferSelect, 'id'>;
								DatabaseSessionAttributes: Omit<typeof session.$inferSelect, 'id' | 'userId' | 'expiresAt'>;
							}
						}`);
					common.addStatement(ast, moduleDecl);
				}
				return generateCode();
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
				imports.addNamed(ast, '$lib/server/auth.js', { lucia: 'lucia' });
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
			content({ content, typescript }) {
				if (content) {
					log.warn(
						`Existing ${colors.yellow('/demo/login/+page.server.[js|ts]')} file. Could not update.`
					);
					return content;
				}

				const ts = (str: string, opt = '') => (typescript ? str : opt);
				return dedent`
					import { fail, redirect } from '@sveltejs/kit';
					import { hash, verify } from '@node-rs/argon2';
					import { eq } from 'drizzle-orm';
					import { generateId } from 'lucia';
					import { lucia } from '$lib/server/auth';
					import { db } from '$lib/server/db';
					import { user } from '$lib/server/db/schema.js';
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
								return fail(400, {
									message: 'Invalid username',
								});
							}
							if (!validatePassword(password)) {
								return fail(400, {
									message: 'Invalid password',
								});
							}

							const results = await db
								.select()
								.from(user)
								.where(eq(user.username, username));

							const existingUser = results.at(0);
							if (!existingUser) {
								return fail(400, {
									message: 'Incorrect username or password',
								});
							}

							const validPassword = await verify(existingUser.passwordHash, password, {
								memoryCost: 19456,
								timeCost: 2,
								outputLen: 32,
								parallelism: 1,
							});
							if (!validPassword) {
								return fail(400, {
									message: 'Incorrect username or password',
								});
							}

							const session = await lucia.createSession(existingUser.id, {});
							const sessionCookie = lucia.createSessionCookie(session.id);
							event.cookies.set(sessionCookie.name, sessionCookie.value, {
								path: '/',
								...sessionCookie.attributes,
							});

							return redirect(302, '/demo');
						},
						register: async (event) => {
							const formData = await event.request.formData();
							const username = formData.get('username');
							const password = formData.get('password');

							if (!validateUsername(username)) {
								return fail(400, {
									message: 'Invalid username',
								});
							}
							if (!validatePassword(password)) {
								return fail(400, {
									message: 'Invalid password',
								});
							}

							const passwordHash = await hash(password, {
								// recommended minimum parameters
								memoryCost: 19456,
								timeCost: 2,
								outputLen: 32,
								parallelism: 1,
							});
							const userId = generateId(15);

							try {
								await db.insert(user).values({
									id: userId,
									username,
									passwordHash,
								});

								const session = await lucia.createSession(userId, {});
								const sessionCookie = lucia.createSessionCookie(session.id);
								event.cookies.set(sessionCookie.name, sessionCookie.value, {
									path: '/',
									...sessionCookie.attributes,
								});
							} catch (e) {
								return fail(500, {
									message: 'An error has occurred',
								});
							}
							return redirect(302, '/demo');
						},
					};

					function validateUsername(username${ts(': unknown): username is string', ')')} {
						return (
							typeof username === 'string' &&
							username.length >= 3 &&
							username.length <= 31 &&
							/^[a-z0-9_-]+$/.test(username)
						);
					}

					function validatePassword(password${ts(': unknown): password is string', ')')} {
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
			content({ content, typescript }) {
				if (content) {
					log.warn(`Existing ${colors.yellow('/demo/login/+page.svelte')} file. Could not update.`);
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
			content({ content, typescript }) {
				if (content) {
					log.warn(
						`Existing ${colors.yellow('/demo/+page.server.[js|ts]')} file. Could not update.`
					);
					return content;
				}

				const ts = (str: string) => (typescript ? str : '');
				return dedent`
					import { lucia } from '$lib/server/auth';
					import { fail, redirect } from '@sveltejs/kit';
					${ts(`import type { Actions, PageServerLoad } from './$types';`)}
					
					export const load${ts(': PageServerLoad')} = async (event) => {
						if (!event.locals.user) {
							return redirect(302, '/demo/login');
						}
						return {
							user: event.locals.user,
						};
					};

					export const actions${ts(': Actions')} = {
						logout: async (event) => {
							if (!event.locals.session) {
								return fail(401);
							}
							await lucia.invalidateSession(event.locals.session.id);
							const sessionCookie = lucia.createBlankSessionCookie();
							event.cookies.set(sessionCookie.name, sessionCookie.value, {
								path: '/',
								...sessionCookie.attributes,
							});
							return redirect(302, '/demo/login');
						},
					};
				`;
			}
		},
		{
			name: ({ kit }) => `${kit!.routesDirectory}/demo/+page.svelte`,
			condition: ({ options }) => options.demo,
			content({ content, typescript }) {
				if (content) {
					log.warn(`Existing ${colors.yellow('/demo/+page.svelte')} file. Could not update.`);
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
				type: 'TSUnionType',
				types: [
					{
						type: 'TSImportType',
						argument: { type: 'StringLiteral', value: 'lucia' },
						qualifier: {
							type: 'Identifier',
							// capitalize first letter
							name: `${name[0]!.toUpperCase()}${name.slice(1)}`
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

function getAuthHandleContent() {
	return `
		async ({ event, resolve }) => {
			const sessionId = event.cookies.get(lucia.sessionCookieName);
			if (!sessionId) {
				event.locals.user = null;
				event.locals.session = null;
				return resolve(event);
			}

			const { session, user } = await lucia.validateSession(sessionId);
			if (!session) {
				event.cookies.delete(lucia.sessionCookieName, { path: '/' });
			}

			if (session?.fresh) {
				const sessionCookie = lucia.createSessionCookie(session.id);

				event.cookies.set(sessionCookie.name, sessionCookie.value, {
					path: '/',
					...sessionCookie.attributes,
				});
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
