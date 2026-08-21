<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';

	let count = $state(0);

	beforeNavigate(({ shallow }) => {
		if (shallow) return;

		count = 0;
	});

	function update() {
		goto('', { shallow: true, state: { count } });
	}
</script>

<button onclick={update}>Count: {count}</button>
