<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import type { Path } from '$app/types';

	let slug = 'hello-world';
	let pathname: Path;
</script>

<a href={resolve('/blog/[slug]', { slug })}>{pathname}</a>
<a href={resolve(`about`)}>About</a>
<img src={asset('foo.png')} alt="" />

{#each ['local'] as base}
	<span>{base}</span>
{/each}

{#snippet localPath(base: string)}
	<span>{base}</span>
{/snippet}

{@render localPath('local')}
