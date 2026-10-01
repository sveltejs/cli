<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<!-- Added by `sv add`. To remove: delete this file and `<DemoLinks />` from +layout.svelte -->

<details class="sv-demo-links" open>
	<summary>sv demos</summary>
	<ul><li><a href={resolve('/demo/better-auth')}>better-auth</a></li></ul>
</details>

<style>
	.sv-demo-links {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 9999;
		max-width: 14rem;
		padding: 0.75rem 1rem;
		background: #fff59d;
		color: #3b3200;
		font: 14px/1.4 system-ui, sans-serif;
		border-radius: 2px;
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.25);
		transform: rotate(-2deg);
	}

	summary {
		cursor: pointer;
		font-weight: 700;
	}

	ul {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
	}

	a {
		color: inherit;
	}
</style>
