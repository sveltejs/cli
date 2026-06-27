<script>
	import { navigating, updated } from '$app/stores';
	$updated;
	updated.check();
</script>

{navigating?.to?.url.pathname}
