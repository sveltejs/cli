<script>
	import { page } from '$app/stores';
	$: x = $page.url;
</script>

<!-- @migration-task could not auto-migrate `$app/stores` to `$app/state`: legacy reactive statement (`$:`); migrate manually -->
{x}
