<script lang="ts">
	import { ENV_PRIVATE_STATIC_2 } from '$app/env/private';
	import { ENV_PUBLIC_STATIC_2 as publicStaticValue } from '$app/env/public';
</script>

<p>{ENV_PRIVATE_STATIC_2}</p>
<a href={publicStaticValue}>static public value</a>
