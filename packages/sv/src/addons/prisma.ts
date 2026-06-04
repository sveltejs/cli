import {
	color,
	dedent,
	type TransformFn,
	transforms,
	pnpm,
	resolveCommandArray
} from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const PRISMA_VERSION = '^7.8.0';
const PRISMA_CLIENT_VERSION = '^7.8.0';
const PRISMA_PG_ADAPTER_VERSION = '^7.8.0';
const PRISMA_BETTER_SQLITE3_ADAPTER_VERSION = '^7.8.0';
const PG_VERSION = '^8.21.0';
const TYPES_PG_VERSION = '^8.20.0';
const DOTENV_VERSION = '^17.4.2';
const BETTER_SQLITE3_VERSION = '^12.10.0';

type Database = 'postgresql' | 'sqlite';

const options = defineAddonOptions()
	.add('database', {
		question: 'Which database would you like to use?',
		type: 'select',
		default: 'postgresql',
		options: [
			{ value: 'postgresql', label: 'PostgreSQL' },
			{ value: 'sqlite', label: 'SQLite' }
		]
	})
	.build();

export default defineAddon({
	id: 'prisma',
	shortDescription: 'database orm',
	homepage: 'https://www.prisma.io',
	options,
	setup: ({ isKit, unsupported, runsAfter }) => {
		runsAfter('prettier');
		runsAfter('sveltekitAdapter');

		if (!isKit) return unsupported('Requires SvelteKit');
	},
	run: ({ sv, language, cwd, cancel, file, dependencyVersion, packageManager, options }) => {
		const database = options.database as Database;
		const schemaPath = path.resolve(cwd, 'prisma', 'schema.prisma');
		const configPath = path.resolve(cwd, `prisma.config.${language}`);
		const clientPath = path.resolve(cwd, 'src', 'lib', `prisma.${language}`);
		const generatedClientPath = path.resolve(cwd, 'src', 'generated', 'prisma');

		for (const [label, filePath] of Object.entries({
			'Prisma schema': schemaPath,
			'Prisma config': configPath,
			'Prisma client': clientPath,
			'Prisma generated client': generatedClientPath
		})) {
			if (fs.existsSync(filePath)) {
				return cancel(`Preexisting ${label} at '${filePath}'`);
			}
		}

		sv.dependency('prisma', PRISMA_VERSION);
		sv.dependency('@prisma/client', PRISMA_CLIENT_VERSION);

		if (database === 'sqlite') {
			sv.dependency('@prisma/adapter-better-sqlite3', PRISMA_BETTER_SQLITE3_ADAPTER_VERSION);
			sv.dependency('better-sqlite3', BETTER_SQLITE3_VERSION);
			if (packageManager === 'pnpm') {
				sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds('better-sqlite3'));
			}
		} else if (database === 'postgresql') {
			sv.dependency('@prisma/adapter-pg', PRISMA_PG_ADAPTER_VERSION);
			sv.dependency('pg', PG_VERSION);
			sv.devDependency('@types/pg', TYPES_PG_VERSION);
		} else {
			throw new Error(`Unsupported Prisma database: ${database}`);
		}

		sv.dependency('dotenv', DOTENV_VERSION);

		sv.file('.env', generateEnv(database));

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				json.packageScriptsUpsert(data, 'db:migrate', 'prisma migrate dev');
				json.packageScriptsUpsert(data, 'db:generate', 'prisma generate');
				json.packageScriptsUpsert(data, 'db:studio', 'prisma studio');
			})
		);

		const hasPrettier = Boolean(dependencyVersion('prettier'));
		if (hasPrettier) {
			sv.file(
				'.prettierignore',
				transforms.text(({ content, text }) => text.upsert(content, '/src/generated/prisma/'))
			);
		}

		sv.file(
			file.gitignore,
			transforms.text(({ content, text }) => {
				if (content.length === 0) return false;
				return text.upsert(content, '/src/generated/prisma/', {
					comment: 'Prisma generated client',
					separator: true
				});
			})
		);

		fs.mkdirSync(path.resolve(cwd, 'prisma'), { recursive: true });

		sv.file(
			'prisma/schema.prisma',
			transforms.text(({ content }) => {
				if (content) return false;

				return generateSchema(database);
			})
		);

		sv.file(
			`prisma.config.${language}`,
			transforms.text(({ content }) => {
				if (content) return false;

				return dedent`
					import "dotenv/config";
					import { defineConfig, env } from "prisma/config";

					export default defineConfig({
						schema: "prisma/schema.prisma",
						migrations: {
							path: "prisma/migrations"
						},
						datasource: {
							url: env("DATABASE_URL")
						}
					});
				`;
			})
		);

		sv.file(
			`src/lib/prisma.${language}`,
			transforms.text(({ content }) => {
				if (content) return false;

				if (database === 'sqlite') {
					return dedent`
						import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
						import { PrismaClient } from "../generated/prisma/client";
						import { DATABASE_URL } from "$env/static/private";

						const adapter = new PrismaBetterSqlite3({
							url: DATABASE_URL
						});

						const prisma = new PrismaClient({
							adapter
						});

						export default prisma;
					`;
				} else if (database === 'postgresql') {
					return dedent`
						import { PrismaPg } from "@prisma/adapter-pg";
						import { PrismaClient } from "../generated/prisma/client";
						import { DATABASE_URL } from "$env/static/private";

					const adapter = new PrismaPg({
						connectionString: DATABASE_URL
					});

					const prisma = new PrismaClient({
						adapter
					});

						export default prisma;
					`;
				}

				throw new Error(`Unsupported Prisma database: ${database}`);
			})
		);
	},
	nextSteps: ({ packageManager, options }) => [
		(() => {
			const database = options.database as Database;
			if (database === 'sqlite') {
				return `Use ${color.env('DATABASE_URL')} in ${color.path('.env')} to point at your SQLite file`;
			} else if (database === 'postgresql') {
				return `Create a Postgres database, then replace ${color.env('DATABASE_URL')} in ${color.path('.env')}`;
			}

			throw new Error(`Unsupported Prisma database: ${database}`);
		})(),
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:migrate']))} to create tables`,
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:generate']))} after schema changes`,
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:studio']))} to inspect your data`
	]
});

const generateSchema = (database: Database) => {
	if (database === 'sqlite') {
		return dedent`
			generator client {
			  provider = "prisma-client"
			  output   = "../src/generated/prisma"
			}

			datasource db {
			  provider = "sqlite"
			}

			model User {
			  id    Int     @id @default(autoincrement())
			  email String  @unique
			  name  String?
			  posts Post[]
			}

			model Post {
			  id        Int     @id @default(autoincrement())
			  title     String
			  content   String?
			  published Boolean @default(false)
			  authorId  Int
			  author    User    @relation(fields: [authorId], references: [id])
			}
		`;
	} else if (database === 'postgresql') {
		return dedent`
			generator client {
			  provider = "prisma-client"
			  output   = "../src/generated/prisma"
			}

			datasource db {
			  provider = "postgresql"
			}

			model User {
			  id    Int     @id @default(autoincrement())
			  email String  @unique
			  name  String?
			  posts Post[]
			}

			model Post {
			  id        Int     @id @default(autoincrement())
			  title     String
			  content   String?
			  published Boolean @default(false)
			  authorId  Int
			  author    User    @relation(fields: [authorId], references: [id])
			}
		`;
	}

	throw new Error(`Unsupported Prisma database: ${database}`);
};

type GenerateEnv = (database: Database) => TransformFn;
const generateEnv: GenerateEnv = (database) =>
	transforms.text(({ content, text }) => {
		let value: string;
		let comment: string;

		if (database === 'sqlite') {
			value = '"file:dev.db"';
			comment = 'Replace with your SQLite file URL!';
		} else if (database === 'postgresql') {
			value = '"postgres://user:password@host:port/db-name"';
			comment = 'Replace with your Prisma Postgres connection string!';
		} else {
			throw new Error(`Unsupported Prisma database: ${database}`);
		}

		content = text.upsert(content, 'DATABASE_URL', {
			value,
			comment: ['Prisma', comment],
			separator: true
		});

		return content;
	});
