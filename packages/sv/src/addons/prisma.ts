import {
	color,
	dedent,
	type TransformFn,
	transforms,
	resolveCommandArray
} from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const PRISMA_VERSION = '^7.6.0';
const PG_VERSION = '^8.13.1';
const DOTENV_VERSION = '^16.4.7';
const TYPES_PG_VERSION = '^8.11.11';

const options = defineAddonOptions().build();

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
	run: ({ sv, language, cwd, cancel, file, dependencyVersion }) => {
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

		sv.devDependency('prisma', PRISMA_VERSION);
		sv.dependency('@prisma/client', PRISMA_VERSION);
		sv.dependency('@prisma/adapter-pg', PRISMA_VERSION);
		sv.dependency('pg', PG_VERSION);
		sv.devDependency('@types/pg', TYPES_PG_VERSION);
		sv.dependency('dotenv', DOTENV_VERSION);

		sv.file('.env', generateEnv(false));
		sv.file('.env.example', generateEnv(true));

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
			})
		);
	},
	nextSteps: ({ packageManager }) => [
		`Create a Prisma Postgres database, then replace ${color.env('DATABASE_URL')} in ${color.path('.env')}`,
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:migrate']))} to create tables`,
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:generate']))} after schema changes`,
		`Run ${color.command(resolveCommandArray(packageManager, 'run', ['db:studio']))} to inspect your data`
	]
});

type GenerateEnv = (isExample: boolean) => TransformFn;
const generateEnv: GenerateEnv = (isExample) =>
	transforms.text(({ content, text }) => {
		content = text.upsert(content, 'DATABASE_URL', {
			value: isExample ? '""' : '"postgres://user:password@host:port/db-name"',
			comment: ['Prisma', 'Replace with your Prisma Postgres connection string!'],
			separator: true
		});

		return content;
	});
