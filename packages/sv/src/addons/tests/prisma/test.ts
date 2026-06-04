import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import prisma from '../../prisma.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ prisma },
	{
		kinds: [
			{ type: 'sqlite', options: { prisma: { database: 'sqlite' } } },
			{ type: 'postgresql', options: { prisma: { database: 'postgresql' } } }
		],
		browser: false,
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(testCases)('prisma $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);
	const language = testCase.variant.endsWith('ts') ? 'ts' : 'js';
	const packageJson = JSON.parse(fs.readFileSync(path.resolve(cwd, 'package.json'), 'utf8'));
	const schema = fs.readFileSync(path.resolve(cwd, 'prisma/schema.prisma'), 'utf8');
	const config = fs.readFileSync(path.resolve(cwd, `prisma.config.${language}`), 'utf8');
	const client = fs.readFileSync(path.resolve(cwd, `src/lib/prisma.${language}`), 'utf8');
	const env = fs.readFileSync(path.resolve(cwd, '.env'), 'utf8');

	expect(packageJson.dependencies?.['@prisma/client']).toBe('^7.8.0');
	expect(packageJson.dependencies?.dotenv).toBe('^17.4.2');
	expect(config).toContain('schema: "prisma/schema.prisma"');
	expect(config).toContain('url: env("DATABASE_URL")');

	if (testCase.kind.type === 'sqlite') {
		expect(schema).toContain('provider = "sqlite"');
		expect(client).toContain('@prisma/adapter-better-sqlite3');
		expect(client).toContain('PrismaBetterSqlite3');
		expect(client).toContain('url: DATABASE_URL');
		expect(env).toContain('DATABASE_URL="file:dev.db"');
		expect(packageJson.dependencies?.['@prisma/adapter-better-sqlite3']).toBe('^7.8.0');
		expect(packageJson.dependencies?.['better-sqlite3']).toBe('^12.10.0');
		expect(packageJson.dependencies?.['@prisma/adapter-pg']).toBeUndefined();
		expect(packageJson.dependencies?.pg).toBeUndefined();
		expect(packageJson.devDependencies?.['@types/pg']).toBeUndefined();
	} else if (testCase.kind.type === 'postgresql') {
		expect(schema).toContain('provider = "postgresql"');
		expect(client).toContain('@prisma/adapter-pg');
		expect(client).toContain('PrismaPg');
		expect(client).toContain('connectionString: DATABASE_URL');
		expect(env).toContain('DATABASE_URL="postgres://user:password@host:port/db-name"');
		expect(packageJson.dependencies?.['@prisma/adapter-pg']).toBe('^7.8.0');
		expect(packageJson.dependencies?.pg).toBe('^8.21.0');
		expect(packageJson.devDependencies?.['@types/pg']).toBe('^8.20.0');
		expect(packageJson.dependencies?.['@prisma/adapter-better-sqlite3']).toBeUndefined();
		expect(packageJson.dependencies?.['better-sqlite3']).toBeUndefined();
	} else {
		throw new Error(`Unsupported prisma test kind: ${testCase.kind.type}`);
	}
});
