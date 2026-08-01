import { assert, test } from 'vitest';
import { read_samples } from '../../utils.js';
import {
	transform_code,
	update_pkg_json_content,
	update_svelte_config_content,
	update_tsconfig_content
} from './migrate.js';

for (const sample of read_samples(new URL('./svelte-config-samples.md', import.meta.url))) {
	test('svelte.config.js: ' + sample.description, () => {
		const actual = update_svelte_config_content(sample.before);
		assert.equal(actual, sample.after);
	});
}

for (const sample of read_samples(new URL('./tsconfig-samples.md', import.meta.url))) {
	test('tsconfig.json: ' + sample.description, () => {
		const actual = update_tsconfig_content(sample.before);
		assert.equal(actual, sample.after);
	});
}

for (const sample of read_samples(new URL('./tsjs-samples.md', import.meta.url))) {
	test('JS/TS file: ' + sample.description, () => {
		const actual = transform_code(
			sample.before,
			sample.filename?.endsWith('.ts') ?? false,
			sample.filename ?? '+page.js'
		);
		assert.equal(actual, sample.after);
	});
}

test('Update package.json', () => {
	const result = update_pkg_json_content(`{
	"name": "svelte-app",
	"version": "1.0.0",
	"devDependencies": {
		"@sveltejs/kit": "^1.0.0",
		"@sveltejs/adapter-auto": "^1.0.0",
		"@sveltejs/vite-plugin-svelte": "^1.0.0",
		"vite": "^4.0.0"
	},
	"dependencies": {
		"@sveltejs/adapter-static": "^1.0.0",
		"@sveltejs/adapter-node": "^1.0.0",
		"@sveltejs/adapter-vercel": "^1.0.0",
		"@sveltejs/adapter-netlify": "^1.0.0",
		"@sveltejs/adapter-cloudflare": "^1.0.0",
		"@sveltejs/adapter-cloudflare-workers": "^1.0.0"
	}
}`);
	assert.equal(
		result,
		`{
	"name": "svelte-app",
	"version": "1.0.0",
	"devDependencies": {
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/adapter-auto": "^3.0.0",
		"@sveltejs/vite-plugin-svelte": "^3.0.0",
		"vite": "^5.0.0"
	},
	"dependencies": {
		"@sveltejs/adapter-static": "^3.0.0",
		"@sveltejs/adapter-node": "^2.0.0",
		"@sveltejs/adapter-vercel": "^4.0.0",
		"@sveltejs/adapter-netlify": "^3.0.0",
		"@sveltejs/adapter-cloudflare": "^3.0.0",
		"@sveltejs/adapter-cloudflare-workers": "^2.0.0"
	}
}`
	);
});
