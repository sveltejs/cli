<script>
	import { navigating, updated } from '$app/state';
	updated.current;
	updated.check();
</script>

{navigating?.to?.url.pathname}
