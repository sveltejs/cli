import fs from 'node:fs';
import path from 'node:path';
import { common, exports, functions, imports, object, variables } from '@sveltejs/cli-core/js';
import { defineAddon, defineAddonOptions, dedent, type OptionValues } from '@sveltejs/cli-core';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';
import { resolveCommand } from 'package-manager-detector/commands';
import { getNodeTypesVersion } from '../common.ts';

const PORTS = {
	mysql: '3306',
	postgresql: '5432',
	sqlite: ''
} as const;

const options = defineAddonOptions({
	database: {
		question: 'Which database would you like to use?',
		type: 'select',
		default: 'sqlite',
		options: [
			{ value: 'postgresql', label: 'PostgreSQL' },
			{ value: 'mysql', label: 'MySQL' },
			{ value: 'sqlite', label: 'SQLite' }
		]
	},
	postgresql: {
		question: 'Which PostgreSQL client would you like to use?',
		type: 'select',
		group: 'client',
		default: 'postgres.js',
		options: [
			{ value: 'postgres.js', label: 'Postgres.JS', hint: 'recommended for most users' },
			{ value: 'neon', label: 'Neon', hint: 'popular hosted platform' }
		],
		condition: ({ database }) => database === 'postgresql'
	},
	mysql: {
		question: 'Which MySQL client would you like to use?',
		type: 'select',
		group: 'client',
		default: 'mysql2',
		options: [
			{ value: 'mysql2', hint: 'recommended for most users' },
			{ value: 'planetscale', label: 'PlanetScale', hint: 'popular hosted platform' }
		],
		condition: ({ database }) => database === 'mysql'
	},
	sqlite: {
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
	},
	docker: {
		question: 'Do you want to run the database locally with docker-compose?',
		default: false,
		type: 'boolean',
		condition: ({ database, mysql, postgresql }) =>
			(database === 'mysql' && mysql === 'mysql2') ||
			(database === 'postgresql' && postgresql === 'postgres.js')
	}
});

export default defineAddon({
	id: 'drizzle',
	shortDescription: 'database orm',
	homepage: 'https://orm.drizzle.team',
	options,
	setup: ({ kit, unsupported, cwd, typescript }) => {
		const ext = typescript ? 'ts' : 'js';
		if (!kit) {
			return unsupported('Requires SvelteKit');
		}

		const baseDBPath = path.resolve(kit.libDirectory, 'server', 'db');
		const paths = {
			'drizzle config': path.relative(cwd, path.resolve(cwd, `drizzle.config.${ext}`)),
			'database schema': path.relative(cwd, path.resolve(baseDBPath, `schema.${ext}`)),
			database: path.relative(cwd, path.resolve(baseDBPath, `index.${ext}`))
		};

		for (const [fileType, filePath] of Object.entries(paths)) {
			if (fs.existsSync(filePath)) {
				unsupported(`Preexisting ${fileType} file at '${filePath}'`);
			}
		}
	},
	run: ({ sv, typescript, options, kit, dependencyVersion }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.dependency('drizzle-orm', '^0.40.0');
		sv.devDependency('drizzle-kit', '^0.30.2');
		sv.devDependency('@types/node', getNodeTypesVersion());

		// MySQL
		if (options.mysql === 'mysql2') sv.dependency('mysql2', '^3.12.0');
		if (options.mysql === 'planetscale') sv.dependency('@planetscale/database', '^1.19.0');

		// PostgreSQL
		if (options.postgresql === 'neon') sv.dependency('@neondatabase/serverless', '^0.10.4');
		if (options.postgresql === 'postgres.js') sv.dependency('postgres', '^3.4.5');

		// SQLite
		if (options.sqlite === 'better-sqlite3') {
			sv.dependency('better-sqlite3', '^11.8.0');
			sv.devDependency('@types/better-sqlite3', '^7.6.12');
			sv.pnpmBuildDependendency('better-sqlite3');
		}

		if (options.sqlite === 'libsql' || options.sqlite === 'turso')
			sv.dependency('@libsql/client', '^0.14.0');

		sv.file('.env', (content) => generateEnvFileContent(content, options));
		sv.file('.env.example', (content) => generateEnvFileContent(content, options));

		if (options.docker && (options.mysql === 'mysql2' || options.postgresql === 'postgres.js')) {
			sv.file('docker-compose.yml', (content) => {
				// if the file already exists, don't modify it
				// (in the future, we could add some tooling for modifying yaml)
				if (content.length > 0) return content;

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
                      - pgdata:/var/lib/postgresql/data
                volumes:
                  pgdata:
                `;
				}

				content = dedent`
                services:
                  db:
                    image: ${imageName}
                    restart: always
                    ports:
                      - ${port}:${port}
                    environment: ${dbSpecificContent}
                `;

				return content;
			});
		}

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			if (options.docker) scripts['db:start'] ??= 'docker compose up';
			scripts['db:push'] ??= 'drizzle-kit push';
			scripts['db:migrate'] ??= 'drizzle-kit migrate';
			scripts['db:studio'] ??= 'drizzle-kit studio';
			return generateCode();
		});

		const hasPrettier = Boolean(dependencyVersion('prettier'));
		if (hasPrettier) {
			sv.file('.prettierignore', (content) => {
				if (!content.includes(`/drizzle/`)) {
					return content.trimEnd() + '\n/drizzle/';
				}
				return content;
			});
		}

		if (options.database === 'sqlite') {
			sv.file('.gitignore', (content) => {
				// Adds the db file to the gitignore if an ignore is present
				if (content.length === 0) return content;

				if (!content.includes('\n*.db')) {
					content = content.trimEnd() + '\n\n# SQLite\n*.db';
				}
				return content;
			});
		}

		sv.file(`drizzle.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, { from: 'drizzle-kit', imports: { defineConfig: 'defineConfig' } });

			ast.body.push(
				common.parseStatement(
					"if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
				)
			);

			exports.createDefault(ast, {
				fallback: common.parseExpression(`
					defineConfig({
						schema: "./src/lib/server/db/schema.${typescript ? 'ts' : 'js'}",
						dialect: "${options.sqlite === 'turso' ? 'turso' : options.database}",
						dbCredentials: {
							${options.sqlite === 'turso' ? 'authToken: process.env.DATABASE_AUTH_TOKEN,' : ''}
							url: process.env.DATABASE_URL
						},
						verbose: true,
						strict: true
					})`)
			});

			return generateCode();
		});

		sv.file(`${kit?.libDirectory}/server/db/schema.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			let userSchemaExpression;
			if (options.database === 'sqlite') {
				imports.addNamed(ast, {
					from: 'drizzle-orm/sqlite-core',
					imports: {
						sqliteTable: 'sqliteTable',
						integer: 'integer'
					}
				});

				userSchemaExpression = common.parseExpression(`sqliteTable('user', {
					id: integer('id').primaryKey(),
					age: integer('age')
				})`);
			}
			if (options.database === 'mysql') {
				imports.addNamed(ast, {
					from: 'drizzle-orm/mysql-core',
					imports: {
						mysqlTable: 'mysqlTable',
						serial: 'serial',
						int: 'int'
					}
				});

				userSchemaExpression = common.parseExpression(`mysqlTable('user', {
					id: serial('id').primaryKey(),
					age: int('age'),
				})`);
			}
			if (options.database === 'postgresql') {
				imports.addNamed(ast, {
					from: 'drizzle-orm/pg-core',
					imports: {
						pgTable: 'pgTable',
						serial: 'serial',
						integer: 'integer'
					}
				});

				userSchemaExpression = common.parseExpression(`pgTable('user', {
					id: serial('id').primaryKey(),
					age: integer('age'),
				})`);
			}

			if (!userSchemaExpression) throw new Error('unreachable state...');
			const userIdentifier = variables.declaration(ast, {
				kind: 'const',
				name: 'user',
				value: userSchemaExpression
			});
			exports.createNamed(ast, {
				name: 'user',
				fallback: userIdentifier
			});

			return generateCode();
		});

		sv.file(`${kit?.libDirectory}/server/db/index.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, {
				from: '$env/dynamic/private',
				imports: { env: 'env' }
			});
			imports.addNamespace(ast, { from: './schema', as: 'schema' });

			// env var checks
			const dbURLCheck = common.parseStatement(
				"if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
			);
			ast.body.push(dbURLCheck);

			let clientExpression;
			// SQLite
			if (options.sqlite === 'better-sqlite3') {
				imports.addDefault(ast, { from: 'better-sqlite3', as: 'Database' });
				imports.addNamed(ast, {
					from: 'drizzle-orm/better-sqlite3',
					imports: { drizzle: 'drizzle' }
				});

				clientExpression = common.parseExpression('new Database(env.DATABASE_URL)');
			}
			if (options.sqlite === 'libsql' || options.sqlite === 'turso') {
				imports.addNamed(ast, {
					from: '@libsql/client',
					imports: { createClient: 'createClient' }
				});
				imports.addNamed(ast, {
					from: 'drizzle-orm/libsql',
					imports: { drizzle: 'drizzle' }
				});

				if (options.sqlite === 'turso') {
					imports.addNamed(ast, {
						from: '$app/environment',
						imports: { dev: 'dev' }
					});
					// auth token check in prod
					const authTokenCheck = common.parseStatement(
						"if (!dev && !env.DATABASE_AUTH_TOKEN) throw new Error('DATABASE_AUTH_TOKEN is not set');"
					);
					ast.body.push(authTokenCheck);

					clientExpression = common.parseExpression(
						'createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })'
					);
				} else {
					clientExpression = common.parseExpression('createClient({ url: env.DATABASE_URL })');
				}
			}
			// MySQL
			if (options.mysql === 'mysql2' || options.mysql === 'planetscale') {
				imports.addDefault(ast, { from: 'mysql2/promise', as: 'mysql' });
				imports.addNamed(ast, {
					from: 'drizzle-orm/mysql2',
					imports: { drizzle: 'drizzle' }
				});

				clientExpression = common.parseExpression('mysql.createPool(env.DATABASE_URL)');
			}
			// PostgreSQL
			if (options.postgresql === 'neon') {
				imports.addNamed(ast, {
					from: '@neondatabase/serverless',
					imports: { neon: 'neon' }
				});
				imports.addNamed(ast, {
					from: 'drizzle-orm/neon-http',
					imports: { drizzle: 'drizzle' }
				});

				clientExpression = common.parseExpression('neon(env.DATABASE_URL)');
			}
			if (options.postgresql === 'postgres.js') {
				imports.addDefault(ast, { from: 'postgres', as: 'postgres' });
				imports.addNamed(ast, {
					from: 'drizzle-orm/postgres-js',
					imports: { drizzle: 'drizzle' }
				});

				clientExpression = common.parseExpression('postgres(env.DATABASE_URL)');
			}

			if (!clientExpression) throw new Error('unreachable state...');
			ast.body.push(
				variables.declaration(ast, {
					kind: 'const',
					name: 'client',
					value: clientExpression
				})
			);

			// create drizzle function call
			const drizzleCall = functions.createCall({
				name: 'drizzle',
				args: ['client'],
				useIdentifiers: true
			});

			// add schema to support `db.query`
			const paramObject = object.create({
				schema: variables.createIdentifier('schema')
			});
			if (options.database === 'mysql') {
				const mode = options.mysql === 'planetscale' ? 'planetscale' : 'default';
				object.property(paramObject, {
					name: 'mode',
					fallback: common.createLiteral(mode)
				});
			}
			drizzleCall.arguments.push(paramObject);

			// create `db` export
			const db = variables.declaration(ast, {
				kind: 'const',
				name: 'db',
				value: drizzleCall
			});
			exports.createNamed(ast, {
				name: 'db',
				fallback: db
			});

			return generateCode();
		});
	},
	nextSteps: ({ options, highlighter, packageManager }) => {
		const steps = [
			`You will need to set ${highlighter.env('DATABASE_URL')} in your production environment`
		];
		if (options.docker) {
			const { command, args } = resolveCommand(packageManager, 'run', ['db:start'])!;
			steps.push(
				`Run ${highlighter.command(`${command} ${args.join(' ')}`)} to start the docker container`
			);
		} else {
			steps.push(
				`Check ${highlighter.env('DATABASE_URL')} in ${highlighter.path('.env')} and adjust it to your needs`
			);
		}
		const { command, args } = resolveCommand(packageManager, 'run', ['db:push'])!;
		steps.push(
			`Run ${highlighter.command(`${command} ${args.join(' ')}`)} to update your database schema`
		);

		return steps;
	}
});

function generateEnvFileContent(content: string, opts: OptionValues<typeof options>) {
	const DB_URL_KEY = 'DATABASE_URL';
	if (opts.docker) {
		// we'll prefill with the default docker db credentials
		const protocol = opts.database === 'mysql' ? 'mysql' : 'postgres';
		const port = PORTS[opts.database];
		content = addEnvVar(
			content,
			DB_URL_KEY,
			`"${protocol}://root:mysecretpassword@localhost:${port}/local"`
		);
		return content;
	}
	if (opts.sqlite === 'better-sqlite3' || opts.sqlite === 'libsql') {
		const dbFile = opts.sqlite === 'libsql' ? 'file:local.db' : 'local.db';
		content = addEnvVar(content, DB_URL_KEY, dbFile);
		return content;
	}

	content = addEnvComment(content, 'Replace with your DB credentials!');
	if (opts.sqlite === 'turso') {
		content = addEnvVar(content, DB_URL_KEY, '"libsql://db-name-user.turso.io"');
		content = addEnvVar(content, 'DATABASE_AUTH_TOKEN', '""');
		content = addEnvComment(content, 'A local DB can also be used in dev as well');
		content = addEnvComment(content, `${DB_URL_KEY}="file:local.db"`);
	}
	if (opts.database === 'mysql') {
		content = addEnvVar(content, DB_URL_KEY, '"mysql://user:password@host:port/db-name"');
	}
	if (opts.database === 'postgresql') {
		content = addEnvVar(content, DB_URL_KEY, '"postgres://user:password@host:port/db-name"');
	}
	return content;
}

function addEnvVar(content: string, key: string, value: string) {
	if (!content.includes(key + '=')) {
		content = appendEnvContent(content, `${key}=${value}`);
	}
	return content;
}

function addEnvComment(content: string, comment: string) {
	const commented = `# ${comment}`;
	if (!content.includes(commented)) {
		content = appendEnvContent(content, commented);
	}
	return content;
}

function appendEnvContent(existing: string, content: string) {
	const withNewLine = !existing.length || existing.endsWith('\n') ? existing : existing + '\n';
	return withNewLine + content + '\n';
}
