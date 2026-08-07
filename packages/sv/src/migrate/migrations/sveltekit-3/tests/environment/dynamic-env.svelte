<script lang="ts">
	import { env as privateEnv } from '$env/dynamic/private';
	import { env as publicEnv } from '$env/dynamic/public';

	const privateDynamicValue = privateEnv.ENV_PRIVATE_DYNAMIC_2;
</script>

<p>{privateDynamicValue}</p>
<a href={publicEnv.ENV_PUBLIC_DYNAMIC_2}>dynamic public value</a>
