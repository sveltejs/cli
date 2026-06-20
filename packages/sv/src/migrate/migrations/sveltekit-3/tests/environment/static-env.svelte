<script lang="ts">
	import { ENV_PRIVATE_STATIC_2 } from '$env/static/private';
	import { ENV_PUBLIC_STATIC_2 as publicStaticValue } from '$env/static/public';
</script>

<p>{ENV_PRIVATE_STATIC_2}</p>
<a href={publicStaticValue}>static public value</a>
