import process from 'node:process';
import * as p from '@clack/prompts';
import { type AgentName } from '@sveltejs/sv-utils';
import { describe, expect, it, vi } from 'vitest';
import {
	assertNoInstallConflict,
	parse_install_flags,
	type InstallMode
} from '../package-manager.ts';

function mockExit() {
	vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	vi.spyOn(process, 'exit').mockImplementation(((code: string | number | null | undefined) => {
		throw new Error(`exit ${code}`);
	}) as never);
}

type InstallOptions = {
	install?: boolean | AgentName;
	packageManager?: AgentName;
};

const scenarios: Array<{
	/** CLI flag combination, mirroring the rows of the `parse_install_flags` doc comment */
	flags: string;
	options: InstallOptions;
	expected?: InstallMode;
	throws?: boolean;
	warns?: boolean;
}> = [
	{
		flags: '(none)',
		options: {},
		expected: { kind: 'unset' }
	},
	{
		// bare `--install` without a pm: per-command default behaviour (prompt when needed)
		flags: '--install',
		options: { install: true },
		expected: { kind: 'unset' }
	},
	{
		flags: '--install pnpm',
		options: { install: 'pnpm' },
		expected: { kind: 'install', packageManager: 'pnpm' }
	},
	{
		flags: '--install --package-manager pnpm',
		options: { install: true, packageManager: 'pnpm' },
		expected: { kind: 'install', packageManager: 'pnpm' }
	},
	{
		flags: '--package-manager pnpm',
		options: { packageManager: 'pnpm' },
		expected: { kind: 'select', packageManager: 'pnpm' }
	},
	{
		flags: '--no-install --package-manager npm',
		options: { install: false, packageManager: 'npm' },
		expected: { kind: 'select', packageManager: 'npm' },
		warns: true
	},
	{
		flags: '--no-install',
		options: { install: false },
		expected: { kind: 'no-install', packageManager: undefined }
	},
	{
		flags: '--install pnpm --package-manager npm',
		options: { install: 'pnpm', packageManager: 'npm' },
		throws: true
	}
];

describe('parse_install_flags', () => {
	it.each(scenarios)('$flags', ({ options, expected, throws, warns }) => {
		const warn = vi.spyOn(p.log, 'warn').mockImplementation(() => undefined);
		warn.mockClear();
		if (throws) {
			mockExit();
			expect(() => parse_install_flags(options)).toThrow('exit 1');
			return;
		}

		expect(parse_install_flags(options)).toEqual(expected);
		expect(warn).toHaveBeenCalledTimes(warns ? 1 : 0);
	});
});

const conflictScenarios: Array<{
	/** raw argv, as `process.argv` would deliver it (minus the node/script paths) */
	argv: string[];
	throws?: boolean;
}> = [
	{
		argv: ['create', '--install', '--no-install'],
		throws: true
	},
	{
		// last-wins in commander makes the order irrelevant at the parsed level, but the conflict exists either way
		argv: ['create', '--no-install', '--install'],
		throws: true
	},
	{
		argv: ['create', '--install=pnpm', '--no-install'],
		throws: true
	},
	{
		argv: ['create', '--install', 'pnpm', '--no-install'],
		throws: true
	},
	{
		argv: ['create', '--install']
	},
	{
		argv: ['create', '--install', 'pnpm']
	},
	{
		argv: ['create', '--no-install']
	},
	{
		argv: ['create', '--install', 'pnpm', '--package-manager', 'npm']
	},
	{
		argv: []
	}
];

describe('assertNoInstallConflict', () => {
	it.each(conflictScenarios)('$argv.join(" ")', ({ argv, throws }) => {
		if (throws) {
			mockExit();
			expect(() => assertNoInstallConflict(argv)).toThrow('exit 1');
			return;
		}

		expect(() => assertNoInstallConflict(argv)).not.toThrow();
	});
});
