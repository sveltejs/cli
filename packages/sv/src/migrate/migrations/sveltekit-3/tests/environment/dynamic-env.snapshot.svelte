<script lang="ts">
	import { ENV_PRIVATE_DYNAMIC_2 } from '$app/env/private';
	import { ENV_PUBLIC_DYNAMIC_2 } from '$app/env/public';

	const privateDynamicValue = ENV_PRIVATE_DYNAMIC_2;
</script>

<p>{privateDynamicValue}</p>
<a href={ENV_PUBLIC_DYNAMIC_2}>dynamic public value</a>
