import { common, exports, functions, imports, object, variables } from '@sveltejs/cli-core/js';
import { defineAddon, defineAddonOptions, dedent, type OptionValues } from '@sveltejs/cli-core';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

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
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, typescript, options, kit }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.dependency('drizzle-orm', '^0.40.0');
		sv.devDependency('drizzle-kit', '^0.30.2');

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

			imports.addNamed(ast, 'drizzle-kit', { defineConfig: 'defineConfig' });

			const envCheckStatement = common.statementFromString(
				"if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
			);
			common.addStatement(ast, envCheckStatement);

			const fallback = common.expressionFromString('defineConfig({})');
			const { value: exportDefault } = exports.defaultExport(ast, fallback);
			if (exportDefault.type !== 'CallExpression') return content;

			const objExpression = exportDefault.arguments?.[0];
			if (!objExpression || objExpression.type !== 'ObjectExpression') return content;

			const authToken =
				options.sqlite === 'turso'
					? common.expressionFromString('process.env.DATABASE_AUTH_TOKEN')
					: undefined;

			object.properties(objExpression, {
				schema: common.createLiteral(`./src/lib/server/db/schema.${typescript ? 'ts' : 'js'}`),
				dbCredentials: object.create({
					url: common.expressionFromString('process.env.DATABASE_URL'),
					authToken
				}),
				verbose: { type: 'Literal', value: true },
				strict: { type: 'Literal', value: true }
			});

			const dialect = options.sqlite === 'turso' ? 'turso' : options.database;
			object.overrideProperties(objExpression, {
				dialect: common.createLiteral(dialect)
			});

			// The `driver` property is only required for _some_ sqlite DBs.
			// We'll need to remove it if it's anything but sqlite
			if (options.database !== 'sqlite') object.removeProperty(objExpression, 'driver');

			return generateCode();
		});

		sv.file(`${kit?.libDirectory}/server/db/schema.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			let userSchemaExpression;
			if (options.database === 'sqlite') {
				imports.addNamed(ast, 'drizzle-orm/sqlite-core', {
					sqliteTable: 'sqliteTable',
					text: 'text',
					integer: 'integer'
				});

				userSchemaExpression = common.expressionFromString(`sqliteTable('user', {
					id: integer('id').primaryKey(),
					age: integer('age')
				})`);
			}
			if (options.database === 'mysql') {
				imports.addNamed(ast, 'drizzle-orm/mysql-core', {
					mysqlTable: 'mysqlTable',
					serial: 'serial',
					text: 'text',
					int: 'int'
				});

				userSchemaExpression = common.expressionFromString(`mysqlTable('user', {
					id: serial('id').primaryKey(),
					age: int('age'),
				})`);
			}
			if (options.database === 'postgresql') {
				imports.addNamed(ast, 'drizzle-orm/pg-core', {
					pgTable: 'pgTable',
					serial: 'serial',
					text: 'text',
					integer: 'integer'
				});

				userSchemaExpression = common.expressionFromString(`pgTable('user', {
					id: serial('id').primaryKey(),
					age: integer('age'),
				})`);
			}

			if (!userSchemaExpression) throw new Error('unreachable state...');
			const userIdentifier = variables.declaration(ast, 'const', 'user', userSchemaExpression);
			exports.namedExport(ast, 'user', userIdentifier);

			return generateCode();
		});

		sv.file(`${kit?.libDirectory}/server/db/index.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, '$env/dynamic/private', { env: 'env' });
			imports.addNamespace(ast, './schema', 'schema');

			// env var checks
			const dbURLCheck = common.statementFromString(
				"if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');"
			);
			common.addStatement(ast, dbURLCheck);

			let clientExpression;
			// SQLite
			if (options.sqlite === 'better-sqlite3') {
				imports.addDefault(ast, 'better-sqlite3', 'Database');
				imports.addNamed(ast, 'drizzle-orm/better-sqlite3', { drizzle: 'drizzle' });

				clientExpression = common.expressionFromString('new Database(env.DATABASE_URL)');
			}
			if (options.sqlite === 'libsql' || options.sqlite === 'turso') {
				imports.addNamed(ast, '@libsql/client', { createClient: 'createClient' });
				imports.addNamed(ast, 'drizzle-orm/libsql', { drizzle: 'drizzle' });

				if (options.sqlite === 'turso') {
					imports.addNamed(ast, '$app/environment', { dev: 'dev' });
					// auth token check in prod
					const authTokenCheck = common.statementFromString(
						"if (!dev && !env.DATABASE_AUTH_TOKEN) throw new Error('DATABASE_AUTH_TOKEN is not set');"
					);
					common.addStatement(ast, authTokenCheck);

					clientExpression = common.expressionFromString(
						'createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })'
					);
				} else {
					clientExpression = common.expressionFromString('createClient({ url: env.DATABASE_URL })');
				}
			}
			// MySQL
			if (options.mysql === 'mysql2' || options.mysql === 'planetscale') {
				imports.addDefault(ast, 'mysql2/promise', 'mysql');
				imports.addNamed(ast, 'drizzle-orm/mysql2', { drizzle: 'drizzle' });

				clientExpression = common.expressionFromString('mysql.createPool(env.DATABASE_URL)');
			}
			// PostgreSQL
			if (options.postgresql === 'neon') {
				imports.addNamed(ast, '@neondatabase/serverless', { neon: 'neon' });
				imports.addNamed(ast, 'drizzle-orm/neon-http', { drizzle: 'drizzle' });

				clientExpression = common.expressionFromString('neon(env.DATABASE_URL)');
			}
			if (options.postgresql === 'postgres.js') {
				imports.addDefault(ast, 'postgres', 'postgres');
				imports.addNamed(ast, 'drizzle-orm/postgres-js', { drizzle: 'drizzle' });

				clientExpression = common.expressionFromString('postgres(env.DATABASE_URL)');
			}

			if (!clientExpression) throw new Error('unreachable state...');
			const clientIdentifier = variables.declaration(ast, 'const', 'client', clientExpression);
			common.addStatement(ast, clientIdentifier);

			// create drizzle function call
			const drizzleCall = functions.callByIdentifier('drizzle', ['client']);

			// add schema to support `db.query`
			const paramObject = object.create({
				schema: variables.identifier('schema')
			});
			if (options.database === 'mysql') {
				const mode = options.mysql === 'planetscale' ? 'planetscale' : 'default';
				object.property(paramObject, 'mode', common.createLiteral(mode));
			}
			drizzleCall.arguments.push(paramObject);

			// create `db` export
			const db = variables.declaration(ast, 'const', 'db', drizzleCall);
			exports.namedExport(ast, 'db', db);

			return generateCode();
		});
	},
	nextSteps: ({ options, highlighter, packageManager }) => {
		const steps = [
			`You will need to set ${highlighter.env('DATABASE_URL')} in your production environment`
		];
		if (options.docker) {
			steps.push(
				`Run ${highlighter.command(`${packageManager} run db:start`)} to start the docker container`
			);
		} else {
			steps.push(
				`Check ${highlighter.env('DATABASE_URL')} in ${highlighter.path('.env')} and adjust it to your needs`
			);
		}
		steps.push(
			`Run ${highlighter.command(`${packageManager} run db:push`)} to update your database schema`
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
