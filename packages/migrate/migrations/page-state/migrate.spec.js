import { assert, test } from 'vitest';
import { transform_svelte_code } from './migrate.js';

test('Updates $app/store #1', () => {
	const result = transform_svelte_code(
		`<script>
	import { page } from '$app/stores';
</script>

<div>{$page.url}</div>
<button onclick={() => {
	console.log($page.state);
}}></button>
`,
		{}
	);
	assert.equal(
		result,
		`<script>
	import { page } from '$app/state';
</script>

<div>{page.url}</div>
<button onclick={() => {
	console.log(page.state);
}}></button>
`
	);
});

test('Updates $app/store #2', () => {
	const result = transform_svelte_code(
		`<script>
	import { navigating, updated } from '$app/stores';
	$updated;
	updated.check();
</script>

is_navigating: {$navigating}
`,
		{}
	);
	assert.equal(
		result,
		`<script>
	import { navigating, updated } from '$app/state';
	updated.current;
	updated.check();
</script>

is_navigating: {navigating.current}
`
	);
});

test('Updates $app/store #3', () => {
	const result = transform_svelte_code(
		`<script>
	import { page as _page } from '$app/stores';
</script>

{$_page.data}
`,
		{}
	);
	assert.equal(
		result,
		`<script>
	import { page as _page } from '$app/state';
</script>

{_page.data}
`
	);
});

test('Does not update $app/store #1', () => {
	const input = `<script>
	import { page } from '$app/stores';
	$: x = $page.url;
</script>

{x}
`;
	const result = transform_svelte_code(input, {});
	assert.equal(result, input);
});

test('Does not update $app/store #2', () => {
	const input = `<script>
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	const url = derived(page, ($page) => $page.url);
</script>

{$url}
`;
	const result = transform_svelte_code(input, {});
	assert.equal(result, input);
});

test('Does not update $app/store #3', () => {
	const input = `<script>
	import { page, getStores } from '$app/stores';
	const x = getStores();
</script>

{$page.url}
`;
	const result = transform_svelte_code(input, {});
	assert.equal(result, input);
});
