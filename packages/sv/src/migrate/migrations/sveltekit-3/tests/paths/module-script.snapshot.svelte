<script module lang="ts">
	import { resolve } from '$app/paths';

	export const link = resolve('module');
</script>

<script
	lang="ts"
>
	import { asset } from '$app/paths';
</script>

<a href={resolve('about')}>About</a>
<img src={asset('foo.png')} alt="" />
