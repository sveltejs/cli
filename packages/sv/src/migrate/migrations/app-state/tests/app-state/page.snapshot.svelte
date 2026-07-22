<script>
	import { page } from '$app/state';
</script>

<div>{page.url}</div>
<button onclick={() => {
	console.log(page.state);
}}></button>
