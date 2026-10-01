<script>
	import { navigating } from '$app/state';

	function describe(n) {
		return n ? 'navigating' : 'idle';
	}
</script>

<!-- @migration-task `navigating` is always defined now - review this usage; use `navigating.to` for the pending navigation -->
<p>{describe(navigating)}</p>
