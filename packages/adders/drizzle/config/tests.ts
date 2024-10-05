import { options } from './options.ts';
import { defineAdderTests } from '@svelte-cli/core';
import { common } from '@svelte-cli/core/js';
import { addFromRawHtml } from '@svelte-cli/core/html';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';

const defaultOptionValues = {
	sqlite: options.sqlite.default,
	mysql: options.mysql.default,
	postgresql: options.postgresql.default,
	docker: options.docker.default
};

const dockerComposeCwd = path.resolve(url.fileURLToPath(import.meta.url), '..', '..');

export const tests = defineAdderTests({
	options,
	optionValues: [
		{ ...defaultOptionValues, database: 'sqlite', sqlite: 'better-sqlite3' },
		{ ...defaultOptionValues, database: 'sqlite', sqlite: 'libsql' },
		{ ...defaultOptionValues, database: 'mysql', mysql: 'mysql2', docker: true },
		{ ...defaultOptionValues, database: 'postgresql', postgresql: 'postgres.js', docker: true }
	],
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			contentType: 'svelte',
			condition: ({ kit }) => Boolean(kit),
			content: ({ htmlAst, jsAst }) => {
				common.addFromString(jsAst, 'export let data;');
				addFromRawHtml(
					htmlAst.childNodes,
					`
                    {#each data.users as user}
                        <span data-test-id="user-id-{user.id}">{user.id} {user.name}</span>
                    {/each}
                    `
				);
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/+page.server.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			condition: ({ kit }) => Boolean(kit),
			content: ({ ast, typescript }) => {
				common.addFromString(
					ast,
					`
                    import { db } from '$lib/server/db';
                    import { user } from '$lib/server/db/schema.js';

                    export const load = async () => {
                        await insertUser({ name: 'Foobar', id: 0, age: 20 }).catch((err) => console.error(err));

                        const users = await db.select().from(user);

                        return { users };
                    };

                    function insertUser(${typescript ? 'value: typeof user.$inferInsert' : 'value'}) {
                        return db.insert(user).values(value);
                    }
                    `
				);
			}
		},
		{
			// override the config so we can remove strict mode
			name: ({ typescript }) => `drizzle.config.${typescript ? 'ts' : 'js'}`,
			contentType: 'text',
			condition: ({ kit }) => Boolean(kit),
			content: ({ content }) => {
				return content.replace('strict: true,', '');
			}
		}
	],
	beforeAll: async (testType) => {
		if (testType == 'snapshot') return;

		console.log('Starting docker containers');
		execSync('docker compose up --detach', { cwd: dockerComposeCwd, stdio: 'pipe' });

		// the containers take some time to startup and be ready
		// to accept any connections. As there is no standard / easy
		// way of doing this for different containers (mysql / postgres)
		// we are waiting for them to startup
		await new Promise((x) => setTimeout(x, 15000));
	},
	afterAll: (testType) => {
		if (testType == 'snapshot') return;

		console.log('Stopping docker containers');
		execSync('docker compose down --volumes', { cwd: dockerComposeCwd, stdio: 'pipe' });
	},
	beforeEach: (cwd, testType) => {
		if (testType == 'snapshot') return;

		execSync('pnpm db:push', { cwd, stdio: 'pipe' });
	},
	tests: [
		{
			name: 'queries database',
			run: async ({ elementExists }) => {
				await elementExists('[data-test-id]');
			}
		}
	]
});
