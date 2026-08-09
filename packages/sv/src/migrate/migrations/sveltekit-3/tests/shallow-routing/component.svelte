<script lang="ts">
	import { beforeNavigate, pushState } from '$app/navigation';

	let count = $state(0);

	beforeNavigate(() => {
		count = 0;
	});

	function update() {
		pushState('', { count });
	}
</script>

<button onclick={update}>Count: {count}</button>
