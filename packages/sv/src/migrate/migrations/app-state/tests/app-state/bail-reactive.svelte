<script>
	import { page } from '$app/stores';
	$: x = $page.url;
</script>

{x}
