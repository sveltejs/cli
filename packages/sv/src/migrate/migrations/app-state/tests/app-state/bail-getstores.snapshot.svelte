<script>
	import { page, getStores } from '$app/stores';
	const x = getStores();
</script>

<!-- @migration-task could not auto-migrate `$app/stores` to `$app/state`: `getStores()` is not available; migrate manually -->
{$page.url}
