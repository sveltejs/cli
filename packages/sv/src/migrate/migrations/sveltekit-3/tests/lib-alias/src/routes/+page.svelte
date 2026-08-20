<script>
	import component from '$lib/component.svelte';
	import file from '$lib/file';
	import ts from '$lib/ts';
	import index from '$lib/index';
	import alreadySpecifier from '$lib/alreadySpecifier.js';
	import { library } from '$library';
</script>

<svelte:component this={component} />

<style>
	div {
		background-image: url("$lib/example.jpg");
	}
</style>
