<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<!-- Added by `sv add`. To remove: delete this file and `<DemoLinks />` from +layout.svelte -->

<div class="sv-demo-links">
	<p>sv addon demos</p>
	<ul><li><a href={resolve('/demo/better-auth')}>better-auth</a></li></ul>
</div>

<style>
	.sv-demo-links {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 9999;
		min-width: 11rem;
		max-width: 16rem;
		padding: 1rem 1.125rem 0.875rem;
		background: linear-gradient(to bottom, #fff9b0, #fff176);
		color: #3d3500;
		font: 14px/1.5 system-ui, sans-serif;
		text-align: left;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.15),
			0 10px 24px -6px rgb(0 0 0 / 0.35);
		transform: rotate(-1.5deg);
	}

	/* tape */

	.sv-demo-links::before {
		content: '';
		position: absolute;
		top: -0.5rem;
		left: 50%;
		width: 4.5rem;
		height: 1.25rem;
		background: rgb(255 255 255 / 0.55);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
		transform: translateX(-50%) rotate(2deg);
	}

	p {
		margin: 0;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	ul {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 0.125rem 0;
	}

	a {
		color: #1a4fd6;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	a:visited {
		color: #6b6420;
	}

	a:hover {
		color: #0b2f8a;
	}
</style>
