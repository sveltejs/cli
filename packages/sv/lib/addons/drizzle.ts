import fs from 'node:fs';
import path from 'node:path';

import {
	type OptionValues,
	dedent,
	defineAddon,
	defineAddonOptions,
	getNodeTypesVersion,
	js,
	parse,
	resolveCommand,
	color,
	json
} from '../core.ts';

type Database = 'mysql' | 'postgresql' | 'sqlite';
const PORTS: Record<Database, string> = {
	mysql: '3306',
	postgresql: '5432',
	sqlite: ''
};

const options = defineAddonOptions()
	.add('database', {
		question: 'Which database would you like to use?',
		type: 'select',
		default: 'sqlite',
		options: [
			{ value: 'postgresql', label: 'PostgreSQL' },
			{ value: 'mysql', label: 'MySQL' },
			{ value: 'sqlite', label: 'SQLite' }
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
	setup: ({ kit, unsupported, runsAfter }) => {
		runsAfter('prettier');

		if (!kit) return unsupported('Requires SvelteKit');
	},
	run: ({ sv, language, options, kit, dependencyVersion, cwd, cancel, files }) => {
		if (!kit) throw new Error('SvelteKit is required');

		const typescript = language === 'ts';
		const baseDBPath = path.resolve(cwd, kit.libDirectory, 'server', 'db');
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
		if (options.mysql === 'mysql2') sv.dependency('mysql2', '^3.16.1');
		if (options.mysql === 'planetscale') sv.dependency('@planetscale/database', '^1.19.0');

		// PostgreSQL
		if (options.postgresql === 'neon') sv.dependency('@neondatabase/serverless', '^1.0.2');
		if (options.postgresql === 'postgres.js') sv.dependency('postgres', '^3.4.8');

		// SQLite
		if (options.sqlite === 'better-sqlite3') {
			sv.dependency('better-sqlite3', '^12.6.2');
			sv.devDependency('@types/better-sqlite3', '^7.6.13');
			sv.pnpmBuildDependency('better-sqlite3');
		}

		if (options.sqlite === 'libsql' || options.sqlite === 'turso')
			sv.devDependency('@libsql/client', '^0.17.0');

		sv.file('.env', (content) => generateEnvFileContent(content, options));
		sv.file('.env.example', (content) => generateEnvFileContent(content, options));

		if (options.docker && (options.mysql === 'mysql2' || options.postgresql === 'postgres.js')) {
			const composeFileOptions = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yaml'];
			let composeFile = '';
			for (const option of composeFileOptions) {
				composeFile = option;
				if (fs.existsSync(path.resolve(cwd, option))) break;
			}
			if (composeFile === '') throw new Error('unreachable state...');

			sv.file(composeFile, (content) => {
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
                      - pgdata:/var/lib/postgresql
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

		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);

			if (options.docker) json.packageScriptsUpsert(data, 'db:start', 'docker compose up');
			json.packageScriptsUpsert(data, 'db:push', 'drizzle-kit push');
			json.packageScriptsUpsert(data, 'db:generate', 'drizzle-kit generate');
			json.packageScriptsUpsert(data, 'db:migrate', 'drizzle-kit migrate');
			json.packageScriptsUpsert(data, 'db:studio', 'drizzle-kit studio');

			return generateCode();
		});

		const hasPrettier = Boolean(dependencyVersion('prettier'));
		if (hasPrettier) {
			sv.file(files.prettierignore, (content) => {
				if (!content.includes(`/drizzle/`)) {
					return content.trimEnd() + '\n/drizzle/';
				}
				return content;
			});
		}

		if (options.database === 'sqlite') {
			sv.file(files.gitignore, (content) => {
				// Adds the db file to the gitignore if an ignore is present
				if (content.length === 0) return content;

				if (!content.includes('\n*.db')) {
					content = content.trimEnd() + '\n\n# SQLite\n*.db';
				}
				return content;
			});
		}

		sv.file(paths['drizzle config'], (content) => {
			const { ast, generateCode } = parse.script(content);

			js.imports.addNamed(ast, { from: 'drizzle-kit', imports: { defineConfig: 'defineConfig' } });

			ast.body.push(
				js.common.parseStatement(
					"if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
				)
			);

			js.exports.createDefault(ast, {
				fallback: js.common.parseExpression(`
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

		sv.file(paths['database schema'], (content) => {
			const { ast, generateCode } = parse.script(content);

			let userSchemaExpression;
			if (options.database === 'sqlite') {
				js.imports.addNamed(ast, {
					from: 'drizzle-orm/sqlite-core',
					imports: ['integer', 'sqliteTable', 'text']
				});

				userSchemaExpression = js.common.parseExpression(`sqliteTable('user', {
					id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
					age: integer('age')
				})`);
			}
			if (options.database === 'mysql') {
				js.imports.addNamed(ast, {
					from: 'drizzle-orm/mysql-core',
					imports: ['mysqlTable', 'serial', 'int']
				});

				userSchemaExpression = js.common.parseExpression(`mysqlTable('user', {
					id: serial('id').primaryKey(),
					age: int('age'),
				})`);
			}
			if (options.database === 'postgresql') {
				js.imports.addNamed(ast, {
					from: 'drizzle-orm/pg-core',
					imports: ['pgTable', 'serial', 'integer']
				});

				userSchemaExpression = js.common.parseExpression(`pgTable('user', {
					id: serial('id').primaryKey(),
					age: integer('age'),
				})`);
			}

			if (!userSchemaExpression) throw new Error('unreachable state...');
			const userIdentifier = js.variables.declaration(ast, {
				kind: 'const',
				name: 'user',
				value: userSchemaExpression
			});
			js.exports.createNamed(ast, {
				name: 'user',
				fallback: userIdentifier
			});

			return generateCode();
		});

		sv.file(paths['database'], (content) => {
			const { ast, generateCode } = parse.script(content);

			js.imports.addNamed(ast, {
				from: '$env/dynamic/private',
				imports: ['env']
			});
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
					js.imports.addNamed(ast, {
						from: '$app/environment',
						imports: ['dev']
					});
					// auth token check in prod
					const authTokenCheck = js.common.parseStatement(
						"if (!dev && !env.DATABASE_AUTH_TOKEN) throw new Error('DATABASE_AUTH_TOKEN is not set');"
					);
					ast.body.push(authTokenCheck);

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

			return generateCode();
		});
	},
	nextSteps: ({ options, packageManager }) => {
		const steps: string[] = [];
		if (options.docker) {
			const { command, args } = resolveCommand(packageManager, 'run', ['db:start'])!;
			steps.push(
				`Run ${color.command(`${command} ${args.join(' ')}`)} to start the docker container`
			);
		} else {
			steps.push(
				`Check ${color.env('DATABASE_URL')} in ${color.path('.env')} and adjust it to your needs`
			);
		}
		steps.push(`Set ${color.env('DATABASE_URL')} in your production environment`);
		const { command, args } = resolveCommand(packageManager, 'run', ['db:push'])!;
		steps.push(
			`Run ${color.command(`${command} ${args.join(' ')}`)} to update your database schema`
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
