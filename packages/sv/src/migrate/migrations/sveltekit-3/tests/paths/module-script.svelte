<script module lang="ts">
	import { base } from '$app/paths';

	export const link = base + '/module';
</script>

<script lang="ts">
	import { assets } from '$app/paths';
</script>

<a href={base + '/about'}>About</a>
<img src={assets + '/foo.png'} alt="" />
