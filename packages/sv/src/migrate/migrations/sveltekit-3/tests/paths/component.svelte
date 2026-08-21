<script lang="ts">
	import { assets as staticAssets, base, resolveRoute } from '$app/paths';
	import type { Pathname } from '$app/types';

	let slug = 'hello-world';
	let pathname: Pathname;
</script>

<a href={base + resolveRoute('/blog/[slug]', { slug })}>{pathname}</a>
<a href={`${base}/about`}>About</a>
<img src={staticAssets + '/foo.png'} alt="" />

{#each ['local'] as base}
	<span>{base}</span>
{/each}

{#snippet localPath(base: string)}
	<span>{base}</span>
{/snippet}

{@render localPath('local')}
