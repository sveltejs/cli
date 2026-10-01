<script context="module" lang="ts">
	import type { Page } from '$app/state';
	import type { RequestEvent } from '@sveltejs/kit';

	export type ModuleTypes = [Page, RequestEvent];
</script>

<script
	lang="ts"
>
	import type { Navigation } from '$app/navigation';
	import type { ActionResult } from '$app/forms';
	import type { ParamMatcher } from '@sveltejs/kit/params';

	/** @type {import('$app/state').ReadonlyURL} */
	let url;

	type Types = [Navigation, ActionResult, ParamMatcher];
</script>

<p>{url}</p>
