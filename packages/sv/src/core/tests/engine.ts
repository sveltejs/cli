import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defineAddon, defineAddonOptions, type LoadedAddon } from '../config.ts';
import { applyAddons, setupAddons } from '../engine.ts';
import { createWorkspace } from '../workspace.ts';

function makeWorkspace() {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-engine-'));
	fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"t","private":true}');
	return cwd;
}
const loaded = (a: ReturnType<typeof defineAddon<any, any>>): LoadedAddon => ({
	reference: { specifier: a.id, options: [], source: { kind: 'official', id: a.id } },
	addon: a
});
const dep = defineAddon({
	id: 'dep',
	options: defineAddonOptions().build(),
	run: ({ cancel }) => cancel('nope')
});

describe('applyAddons cancel propagation', () => {
	it("skips addons whose 'dependsOn' was canceled", async () => {
		const child = defineAddon({
			id: 'child',
			options: defineAddonOptions().build(),
			setup: ({ dependsOn }) => dependsOn('dep' as never),
			run: () => expect.fail('child should not have run')
		});
		const workspace = await createWorkspace({ cwd: makeWorkspace() });
		const addons = [loaded(dep), loaded(child)];
		const { status } = await applyAddons({
			loadedAddons: addons,
			workspace,
			setupResults: setupAddons(addons, workspace),
			options: { dep: {}, child: {} }
		});
		expect(status.dep).toEqual(['nope']);
		expect(status.child).toEqual(["Because dependency 'dep' was canceled"]);
	});

	it("does not skip addons that only 'runsAfter' a canceled addon", async () => {
		let ran = false;
		const child = defineAddon({
			id: 'child',
			options: defineAddonOptions().build(),
			setup: ({ runsAfter }) => runsAfter('dep' as never),
			run: () => {
				ran = true;
			}
		});
		const workspace = await createWorkspace({ cwd: makeWorkspace() });
		const addons = [loaded(dep), loaded(child)];
		const { status } = await applyAddons({
			loadedAddons: addons,
			workspace,
			setupResults: setupAddons(addons, workspace),
			options: { dep: {}, child: {} }
		});
		expect(status.child).toBe('success');
		expect(ran).toBe(true);
	});
});
