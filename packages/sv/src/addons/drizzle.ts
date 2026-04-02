import {
	color,
	dedent,
	type TransformFn,
	transforms,
	resolveCommandArray,
	fileExists,
	createPrinter
} from '@sveltejs/sv-utils';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineAddon, defineAddonOptions } from '../core/config.ts';
import type { OptionValues } from '../core/options.ts';
import { getNodeTypesVersion } from './common.ts';

type Database = 'mysql' | 'postgresql' | 'sqlite' | 'd1';
const PORTS: Record<Database, string> = {
	mysql: '3306',
	postgresql: '5432',
	sqlite: '',
	d1: ''
};

const options = defineAddonOptions()
	.add('database', {
		question: 'Which database would you like to use?',
		type: 'select',
		default: 'sqlite',
		options: [
			{ value: 'postgresql', label: 'PostgreSQL' },
			{ value: 'mysql', label: 'MySQL' },
			{ value: 'sqlite', label: 'SQLite' },
			{ value: 'd1', label: 'Cloudflare D1' }
		]
	})
	.add('postgresql', {
		question: 'Which PostgreSQL client would you like to use?',
		type: 'select',
		group: 'client',
		default: 'postgres.js',
		options: [
			{ value: 'postgres.js', label: 'Postgres.JS', hint: 'recommended for most users' },
			{ value: 'neon', label: 'Neon', hint: 'popular hosted platform' }
		],
		condition: ({ database }) => database === 'postgresql'
	})
	.add('mysql', {
		question: 'Which MySQL client would you like to use?',
		type: 'select',
		group: 'client',
		default: 'mysql2',
		options: [
			{ value: 'mysql2', hint: 'recommended for most users' },
			{ value: 'planetscale', label: 'PlanetScale', hint: 'popular hosted platform' }
		],
		condition: ({ database }) => database === 'mysql'
	})
	.add('sqlite', {
		question: 'Which SQLite client would you like to use?',
		type: 'select',
		group: 'client',
		default: 'libsql',
		options: [
			{ value: 'better-sqlite3', hint: 'for traditional Node environments' },
			{ value: 'libsql', label: 'libSQL', hint: 'for serverless environments' },
			{ value: 'turso', label: 'Turso', hint: 'popular hosted platform' }
		],
		condition: ({ database }) => database === 'sqlite'
	})
	.add('docker', {
		question: 'Do you want to run the database locally with docker-compose?',
		default: false,
		type: 'boolean',
		condition: ({ database, mysql, postgresql }) =>
			(database === 'mysql' && mysql === 'mysql2') ||
			(database === 'postgresql' && postgresql === 'postgres.js')
	})
	.build();

export default defineAddon({
	id: 'drizzle',
	shortDescription: 'database orm',
	homepage: 'https://orm.drizzle.team',
	options,
	setup: ({ isKit, unsupported, runsAfter }) => {
		runsAfter('prettier');
		runsAfter('sveltekitAdapter');

		if (!isKit) return unsupported('Requires SvelteKit');
	},
	run: ({ sv, language, options, directory, dependencyVersion, cwd, cancel, file }) => {
		if (options.database === 'd1' && !dependencyVersion('@sveltejs/adapter-cloudflare')) {
			return cancel('Cloudflare D1 requires @sveltejs/adapter-cloudflare - add the adapter first');
		}

		const [ts] = createPrinter(language === 'ts');
		const baseDBPath = path.resolve(cwd, directory.lib, 'server', 'db');
		const paths = {
			'drizzle config': path.resolve(cwd, `drizzle.config.${language}`),
			'database schema': path.resolve(baseDBPath, `schema.${language}`),
			database: path.resolve(baseDBPath, `index.${language}`)
		};

		for (const [fileType, filePath] of Object.entries(paths)) {
			if (fs.existsSync(filePath)) {
				return cancel(`Preexisting ${fileType} file at '${filePath}'`);
			}
		}
		sv.devDependency('drizzle-orm', '^0.45.1');
		sv.devDependency('drizzle-kit', '^0.31.8');
		sv.devDependency('@types/node', getNodeTypesVersion());

		// MySQL
		if (options.mysql === 'mysql2') sv.devDependency('mysql2', '^3.16.3');
		if (options.mysql === 'planetscale') sv.devDependency('@planetscale/database', '^1.19.0');

		// PostgreSQL
		if (options.postgresql === 'neon') sv.devDependency('@neondatabase/serverless', '^1.0.2');
		if (options.postgresql === 'postgres.js') sv.devDependency('postgres', '^3.4.8');

		// SQLite
		if (options.sqlite === 'better-sqlite3') {
			// not a devDependency due to bundling issues
			sv.dependency('better-sqlite3', '^12.6.2');
			sv.devDependency('@types/better-sqlite3', '^7.6.13');
			sv.pnpmBuildDependency('better-sqlite3');
		}

		if (options.sqlite === 'libsql' || options.sqlite === 'turso')
			sv.devDependency('@libsql/client', '^0.17.0');

		sv.file('.env', generateEnv(options, false));
		sv.file('.env.example', generateEnv(options, true));

		if (options.docker && (options.mysql === 'mysql2' || options.postgresql === 'postgres.js')) {
			const composeFileOptions = [
				// First item has higher priority
				'compose.yaml', // canonical name
				'compose.yml',
				'docker-compose.yaml', // for backward compatibility
				'docker-compose.yml' // for backward compatibility
			];

			const composeFile =
				composeFileOptions.find((option) => fs.existsSync(path.resolve(cwd, option))) ??
				'compose.yaml';

			sv.file(composeFile, (content) => {
				// `transforms.yaml` not implemented. Therefore, abort if file exist.
				if (content.length > 0) return false;

				const imageName = options.database === 'mysql' ? 'mysql' : 'postgres';
				const port = PORTS[options.database];

				const USER = 'root';
				const PASSWORD = 'mysecretpassword';
				const DB_NAME = 'local';

				let dbSpecificContent = '';
				if (options.mysql === 'mysql2') {
					dbSpecificContent = `
                      MYSQL_ROOT_PASSWORD: ${PASSWORD}
                      MYSQL_DATABASE: ${DB_NAME}
                    volumes:
                      - mysqldata:/var/lib/mysql
                volumes:
                  mysqldata:
                `;
				}
				if (options.postgresql === 'postgres.js') {
					dbSpecificContent = `
                      POSTGRES_USER: ${USER}
                      POSTGRES_PASSWORD: ${PASSWORD}
                      POSTGRES_DB: ${DB_NAME}
                    volumes:
                      - pgdata:/var/lib/postgresql
                volumes:
                  pgdata:
                `;
				}

				return dedent`
                services:
                  db:
                    image: ${imageName}
                    restart: always
                    ports:
                      - ${port}:${port}
                    environment: ${dbSpecificContent}
                `;
			});
		}

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				if (options.docker) json.packageScriptsUpsert(data, 'db:start', 'docker compose up');
				json.packageScriptsUpsert(data, 'db:push', 'drizzle-kit push');
				json.packageScriptsUpsert(data, 'db:generate', 'drizzle-kit generate');
				json.packageScriptsUpsert(data, 'db:migrate', 'drizzle-kit migrate');
				json.packageScriptsUpsert(data, 'db:studio', 'drizzle-kit studio');
			})
		);

		const hasPrettier = Boolean(dependencyVersion('prettier'));
		if (hasPrettier) {
			sv.file(
				file.prettierignore,
				transforms.text(({ content, text }) => text.upsert(content, '/drizzle/'))
			);
		}

		if (options.database === 'sqlite') {
			sv.file(
				file.gitignore,
				transforms.text(({ content, text }) => {
					if (content.length === 0) return false;
					return text.upsert(content, '*.db', { comment: 'SQLite' });
				})
			);
		}

		sv.file(
			paths['drizzle config'],
			transforms.script(({ ast, js }) => {
				const d1 = options.database === 'd1';
				const turso = options.sqlite === 'turso';

				js.imports.addNamed(ast, {
					from: 'drizzle-kit',
					imports: { defineConfig: 'defineConfig' }
				});

				if (d1) {
					ast.body.push(
						js.common.parseStatement(
							"if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');"
						),
						js.common.parseStatement(
							"if (!process.env.CLOUDFLARE_DATABASE_ID) throw new Error('CLOUDFLARE_DATABASE_ID is not set');"
						),
						js.common.parseStatement(
							"if (!process.env.CLOUDFLARE_D1_TOKEN) throw new Error('CLOUDFLARE_D1_TOKEN is not set');"
						)
					);
				} else {
					ast.body.push(
						js.common.parseStatement(
							"if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
						)
					);
				}

				const getDialect = (): string => {
					if (d1) return 'sqlite';
					if (turso) return 'turso';
					return options.database;
				};

				const getCredentials = (): string => {
					const creds: string[] = [];
					if (d1) {
						creds.push('accountId: process.env.CLOUDFLARE_ACCOUNT_ID,');
						creds.push('databaseId: process.env.CLOUDFLARE_DATABASE_ID,');
						creds.push('token: process.env.CLOUDFLARE_D1_TOKEN,');
					}
					if (turso) creds.push('authToken: process.env.DATABASE_AUTH_TOKEN,');
					if (!d1) creds.push('url: process.env.DATABASE_URL,');

					return creds.join('\n');
				};

				js.exports.createDefault(ast, {
					fallback: js.common.parseExpression(`
					defineConfig({
						schema: "./${directory.lib}/server/db/schema.${language}",
						dialect: "${getDialect()}",
						${d1 ? "driver: 'd1-http'," : ''}
						dbCredentials: {
							${getCredentials()}
						},
						verbose: true,
						strict: true
					})
				`)
				});
			})
		);

		sv.file(
			paths['database schema'],
			transforms.script(({ ast, js }) => {
				let taskSchemaExpression;
				if (options.database === 'sqlite' || options.database === 'd1') {
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/sqlite-core',
						imports: ['integer', 'sqliteTable', 'text']
					});

					taskSchemaExpression = js.common.parseExpression(`sqliteTable('task', {
				id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
				title: text('title').notNull(),
				priority: integer('priority').notNull().default(1)
			})`);
				}
				if (options.database === 'mysql') {
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/mysql-core',
						imports: ['mysqlTable', 'serial', 'int', 'text']
					});

					taskSchemaExpression = js.common.parseExpression(`mysqlTable('task', {
				id: serial('id').primaryKey(),
				title: text('title').notNull(),
				priority: int('priority').notNull().default(1)
			})`);
				}
				if (options.database === 'postgresql') {
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/pg-core',
						imports: ['pgTable', 'serial', 'integer', 'text']
					});

					taskSchemaExpression = js.common.parseExpression(`pgTable('task', {
				id: serial('id').primaryKey(),
				title: text('title').notNull(),
				priority: integer('priority').notNull().default(1)
			})`);
				}

				if (!taskSchemaExpression) throw new Error('unreachable state...');
				const taskIdentifier = js.variables.declaration(ast, {
					kind: 'const',
					name: 'task',
					value: taskSchemaExpression
				});
				js.exports.createNamed(ast, {
					name: 'task',
					fallback: taskIdentifier
				});
			})
		);

		sv.file(
			paths.database,
			transforms.script(({ ast, js }) => {
				if (options.database === 'd1') {
					js.imports.addNamespace(ast, { from: './schema', as: 'schema' });
					js.imports.addNamed(ast, { from: 'drizzle-orm/d1', imports: ['drizzle'] });

					const getDbFn = js.common.parseStatement(
						`export const getDb = (d1${ts(': D1Database')}) => drizzle(d1, { schema });`
					);

					ast.body.push(getDbFn);

					return;
				}

				js.imports.addNamed(ast, { from: '$env/dynamic/private', imports: ['env'] });
				js.imports.addNamespace(ast, { from: './schema', as: 'schema' });

				// env var checks
				const dbURLCheck = js.common.parseStatement(
					"if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
				);
				ast.body.push(dbURLCheck);

				let clientExpression;
				// SQLite
				if (options.sqlite === 'better-sqlite3') {
					js.imports.addDefault(ast, { from: 'better-sqlite3', as: 'Database' });
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/better-sqlite3',
						imports: ['drizzle']
					});

					clientExpression = js.common.parseExpression('new Database(env.DATABASE_URL)');
				}
				if (options.sqlite === 'libsql' || options.sqlite === 'turso') {
					js.imports.addNamed(ast, {
						from: '@libsql/client',
						imports: ['createClient']
					});
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/libsql',
						imports: ['drizzle']
					});

					if (options.sqlite === 'turso') {
						ast.body.push(
							js.common.parseStatement(
								"if (!env.DATABASE_AUTH_TOKEN) throw new Error('DATABASE_AUTH_TOKEN is not set');"
							)
						);
						clientExpression = js.common.parseExpression(
							'createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })'
						);
					} else {
						clientExpression = js.common.parseExpression('createClient({ url: env.DATABASE_URL })');
					}
				}
				// MySQL
				if (options.mysql === 'mysql2' || options.mysql === 'planetscale') {
					js.imports.addDefault(ast, { from: 'mysql2/promise', as: 'mysql' });
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/mysql2',
						imports: ['drizzle']
					});

					clientExpression = js.common.parseExpression('mysql.createPool(env.DATABASE_URL)');
				}
				// PostgreSQL
				if (options.postgresql === 'neon') {
					js.imports.addNamed(ast, {
						from: '@neondatabase/serverless',
						imports: ['neon']
					});
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/neon-http',
						imports: ['drizzle']
					});

					clientExpression = js.common.parseExpression('neon(env.DATABASE_URL)');
				}
				if (options.postgresql === 'postgres.js') {
					js.imports.addDefault(ast, { from: 'postgres', as: 'postgres' });
					js.imports.addNamed(ast, {
						from: 'drizzle-orm/postgres-js',
						imports: ['drizzle']
					});

					clientExpression = js.common.parseExpression('postgres(env.DATABASE_URL)');
				}

				if (!clientExpression) throw new Error('unreachable state...');
				ast.body.push(
					js.variables.declaration(ast, {
						kind: 'const',
						name: 'client',
						value: clientExpression
					})
				);

				// create drizzle function call
				const drizzleCall = js.functions.createCall({
					name: 'drizzle',
					args: ['client'],
					useIdentifiers: true
				});

				// add schema to support `db.query`
				const paramObject = js.object.create({
					schema: js.variables.createIdentifier('schema')
				});
				if (options.database === 'mysql') {
					const mode = options.mysql === 'planetscale' ? 'planetscale' : 'default';
					js.object.property(paramObject, {
						name: 'mode',
						fallback: js.common.createLiteral(mode)
					});
				}
				drizzleCall.arguments.push(paramObject);

				// create `db` export
				const db = js.variables.declaration(ast, {
					kind: 'const',
					name: 'db',
					value: drizzleCall
				});
				js.exports.createNamed(ast, {
					name: 'db',
					fallback: db
				});
			})
		);
	},

	nextSteps: ({ options, packageManager, cwd }) => {
		const steps: string[] = [];
		if (options.database === 'd1') {
			const ext = fileExists(cwd, 'wrangler.toml') ? 'toml' : 'jsonc';
			steps.push(
				`Add your ${color.env('CLOUDFLARE_ACCOUNT_ID')}, ${color.env('CLOUDFLARE_DATABASE_ID')}, and ${color.env('CLOUDFLARE_D1_TOKEN')} to ${color.path('.env')}`
			);
			steps.push(
				`Run ${color.command(resolveCommandArray(packageManager, 'run', ['wrangler', 'd1', 'create', '<DATABASE_NAME>']))} to generate a D1 database ID for your ${color.path(`wrangler.${ext}`)}`
			);
		}

		if (options.docker) {
			steps.push(
				`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:start']))} to start the docker container`
			);
		} else if (options.database !== 'd1') {
			steps.push(
				`Check ${color.env('DATABASE_URL')} in ${color.path('.env')} and adjust it to your needs`
			);
		}

		steps.push(
			`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:push']))} to update your database schema`
		);

		return steps;
	}
});

type GenerateEnv = (opts: OptionValues<typeof options>, isExample: boolean) => TransformFn;
const generateEnv: GenerateEnv = (opts, isExample) =>
	transforms.text(({ content, text }) => {
		const DB_URL_KEY = 'DATABASE_URL';

		if (opts.database === 'd1') {
			content = text.upsert(content, 'CLOUDFLARE_ACCOUNT_ID', {
				value: '""',
				comment: ['Cloudflare D1'],
				separator: true
			});
			content = text.upsert(content, 'CLOUDFLARE_DATABASE_ID', { value: '""' });
			content = text.upsert(content, 'CLOUDFLARE_D1_TOKEN', { value: '""' });
			return content;
		}

		// Calculate value and comment based on database options
		let value: string;
		const comment: NonNullable<Parameters<typeof text.upsert>[2]>['comment'] = ['Drizzle'];

		if (opts.docker) {
			const protocol = opts.database === 'mysql' ? 'mysql' : 'postgres';
			const port = PORTS[opts.database];
			value = `"${protocol}://root:mysecretpassword@localhost:${port}/local"`;
		} else if (opts.sqlite === 'better-sqlite3' || opts.sqlite === 'libsql') {
			value = opts.sqlite === 'libsql' ? 'file:local.db' : 'local.db';
		} else if (opts.sqlite === 'turso') {
			if (isExample) {
				value = '"libsql://db-name-user.turso.io"';
				comment.push(
					'Replace with your DB credentials!',
					{ text: 'A local DB can also be used in dev as well', mode: 'append' },
					{ text: `${DB_URL_KEY}="file:local.db"`, mode: 'append' }
				);
			} else {
				value = '"file:local.db"';
				comment.push(
					'Replace with your DB credentials!',
					`${DB_URL_KEY}="libsql://db-name-user.turso.io"`,
					'A local DB can also be used in dev as well'
				);
			}
		} else if (opts.database === 'mysql') {
			value = '"mysql://user:password@host:port/db-name"';
			comment.push('Replace with your DB credentials!');
		} else if (opts.database === 'postgresql') {
			value = '"postgres://user:password@host:port/db-name"';
			comment.push('Replace with your DB credentials!');
		} else {
			value = '';
		}

		content = text.upsert(content, DB_URL_KEY, { value, comment, separator: true });

		// Turso requires an auth token
		if (opts.sqlite === 'turso') {
			content = text.upsert(content, 'DATABASE_AUTH_TOKEN', {
				value: isExample ? `""` : `"${crypto.randomUUID()}"`
			});
		}

		return content;
	});
