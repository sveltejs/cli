<script>
	import { navigating } from '$app/stores';

	function describe(n) {
		return n ? 'navigating' : 'idle';
	}
</script>

<p>{describe($navigating)}</p>
