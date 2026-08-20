<script>
	import component from '#lib/component.svelte';
	import file from '#lib/file.js';
	import ts from '#lib/ts.js';
	import index from '#lib/index/index.js';
	import alreadySpecifier from '#lib/alreadySpecifier.js';
	import { library } from '$library';
</script>

<svelte:component this={component} />

<style>
	div {
		background-image: url("../lib/example.jpg");
	}
</style>
