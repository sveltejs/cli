import { defineAdderTests } from '@sveltejs/cli-core';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';
import { options } from './index.ts';
import { parseSvelte } from '@sveltejs/cli-core/parsers';

const defaultOptionValues = {
	sqlite: options.sqlite.default,
	mysql: options.mysql.default,
	postgresql: options.postgresql.default,
	docker: options.docker.default
};

const dockerComposeCwd = path.resolve(url.fileURLToPath(import.meta.url), '..');

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
			condition: ({ kit }) => Boolean(kit),
			content: ({ content }) => {
				const { script, template, generateCode } = parseSvelte(content);
				const dataProp = '\nexport let data;';
				const eachBlock = `
					{#each data.users as user}
                        <span data-test-id="user-id-{user.id}">{user.id} {user.name}</span>
                    {/each}`;
				return generateCode({
					script: script.source + dataProp,
					template: template.source + eachBlock
				});
			}
		},
		{
			name: ({ kit, typescript }) =>
				`${kit?.routesDirectory}/+page.server.${typescript ? 'ts' : 'js'}`,
			condition: ({ kit }) => Boolean(kit),
			content: ({ typescript }) => {
				return `
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
                    `;
			}
		},
		{
			// override the config so we can remove strict mode
			name: ({ typescript }) => `drizzle.config.${typescript ? 'ts' : 'js'}`,
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
