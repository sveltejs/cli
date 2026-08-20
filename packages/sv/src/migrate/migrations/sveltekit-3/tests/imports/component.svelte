<script context="module" lang="ts">
	import type { Page, RequestEvent } from '@sveltejs/kit';

	export type ModuleTypes = [Page, RequestEvent];
</script>

<script lang="ts">
	import type { Navigation, ActionResult, ParamMatcher } from '@sveltejs/kit';

	/** @type {import('@sveltejs/kit').ReadonlyURL} */
	let url;

	type Types = [Navigation, ActionResult, ParamMatcher];
</script>

<p>{url}</p>
