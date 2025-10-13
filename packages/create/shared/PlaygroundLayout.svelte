<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const title = '$sv-title-$sv';
	const href = '$sv-url-$sv';

	let prefersDark = $state(true);
	let isDark = $state(true);

	function setTheme(/** @type {'dark' | 'light' | 'system'} */ value) {
		isDark = value === 'dark';
		localStorage.setItem('sv:theme', isDark === prefersDark ? 'system' : value);
	}

	$effect(() => {
		document.documentElement.classList.remove('light', 'dark');

		prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const theme = localStorage.getItem('sv:theme');
		isDark = theme === 'dark' || (theme === 'system' && prefersDark);

		document.documentElement.classList.add(isDark ? 'dark' : 'light');
	});
</script>

<svelte:head>
	<title>--from-playground {title}</title>
	<script>
		{
			const theme = localStorage.getItem('sv:theme');

			document.documentElement.classList.add(
				!theme || theme === 'system'
					? window.matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light'
					: theme
			);
		}
	</script>
</svelte:head>

<div class="layout">
	<nav class="navbar">
		<div class="nav-left">
			<a href="/" class="svelte-icon">
				<img src={favicon} alt="Svelte" width="32" height="32" />
			</a>
			<p class="title">{title}</p>
		</div>
		<div class="nav-right">
			<a {href} class="raised" target="_blank" rel="noopener noreferrer">
				--to-playground
				<span aria-hidden="true" style="margin-left:0.25em;"> ↗</span>
			</a>
			<button
				class="raised theme-toggle"
				onclick={() => setTheme(isDark ? 'light' : 'dark')}
				aria-label="Toggle theme"
			>
				<span class="icon"></span>
			</button>
		</div>
	</nav>

	<main class="content">
		{@render children?.()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
	}

	:global(html) {
		margin: 0;
		--bg-1: hsl(0, 0%, 100%);
		--bg-2: hsl(206, 20%, 90%);
		--bg-3: hsl(206, 20%, 80%);
		--navbar-bg: #fff;
		--fg-1: hsl(0, 0%, 13%);
		--fg-2: hsl(0, 0%, 50%);
		--fg-3: hsl(0, 0%, 60%);
		--link: hsl(208, 77%, 47%);
		--border-radius: 4px;
		--font:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
			'Helvetica Neue', sans-serif;
		color-scheme: light;
		background: var(--bg-1);
		color: var(--fg-1);
		font-family: var(--font);
		line-height: 1.5;
		height: calc(100vh - 2rem);
		accent-color: var(--link) !important;
		min-height: 100vh;
		background-color: var(--bg-1);
	}

	:global(html.dark) {
		color-scheme: dark;
		--bg-1: hsl(0, 0%, 18%);
		--bg-2: hsl(0, 0%, 30%);
		--bg-3: hsl(0, 0%, 40%);
		--navbar-bg: hsl(220, 14%, 16%);
		--fg-1: hsl(0, 0%, 75%);
		--fg-2: hsl(0, 0%, 40%);
		--fg-3: hsl(0, 0%, 30%);
		--link: hsl(206, 96%, 72%);
	}

	.navbar {
		color: var(--fg-1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0em 2.5rem;
		height: 3.7rem;
		background-color: var(--navbar-bg);
		box-shadow:
			0 2px 8px 0 rgba(0, 0, 0, 0.08),
			0 1.5px 4px 0 rgba(0, 0, 0, 0.04);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.svelte-icon {
		display: flex;
		align-items: center;
		text-decoration: none;
		transition: opacity 0.2s ease;
	}

	.svelte-icon:hover {
		opacity: 0.8;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 400;
		margin: 0;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.raised {
		background: var(--navbar-bg);
		border-left: 0.5px solid var(--fg-3);
		border-top: 0.5px solid var(--fg-3);
		border-bottom: none;
		border-right: none;
		border-radius: var(--border-radius);
		color: var(--fg-1);
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
		text-decoration: none;
		font-weight: 500;
		padding: 0.25rem 0.75rem;
		font-size: 0.8rem;
	}

	.raised:hover {
		border-left-color: var(--fg-2);
		border-top-color: var(--fg-2);
		box-shadow:
			0 4px 8px rgba(0, 0, 0, 0.15),
			0 2px 4px rgba(0, 0, 0, 0.1);
		transform: translate(-1px, -1px);
	}

	.content {
		padding: 1rem;
		color: var(--fg-1);
	}

	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.8rem;
		height: 1.8rem;
		padding: 0;
		min-width: 2rem;
	}

	.icon {
		display: inline-block;
		width: 1.5rem;
		height: 1.5rem;
		-webkit-mask-size: 1.5rem;
		mask-size: 1.5rem;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		background-color: var(--fg-1);
	}

	.icon {
		mask-image: url('data:image/svg+xml,%3csvg%20xmlns="http://www.w3.org/2000/svg"%20viewBox="0%200%2024%2024"%3e%3cpath%20fill="%23666"%20d="M12%2021q-3.775%200-6.388-2.613T3%2012q0-3.45%202.25-5.988T11%203.05q.625-.075.975.45t-.025%201.1q-.425.65-.638%201.375T11.1%207.5q0%202.25%201.575%203.825T16.5%2012.9q.775%200%201.538-.225t1.362-.625q.525-.35%201.075-.037t.475.987q-.35%203.45-2.937%205.725T12%2021Zm0-2q2.2%200%203.95-1.213t2.55-3.162q-.5.125-1%20.2t-1%20.075q-3.075%200-5.238-2.163T9.1%207.5q0-.5.075-1t.2-1q-1.95.8-3.163%202.55T5%2012q0%202.9%202.05%204.95T12%2019Zm-.25-6.75Z"/%3e%3c/svg%3e');
	}

	:global(html.dark) .icon {
		mask-image: url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='%23d4d4d4'%20d='M12%2019a1%201%200%200%201%20.993.883L13%2020v1a1%201%200%200%201-1.993.117L11%2021v-1a1%201%200%200%201%201-1zm6.313-2.09.094.083.7.7a1%201%200%200%201-1.32%201.497l-.094-.083-.7-.7a1%201%200%200%201%201.218-1.567l.102.07zm-11.306.083a1%201%200%200%201%20.083%201.32l-.083.094-.7.7a1%201%200%200%201-1.497-1.32l.083-.094.7-.7a1%201%200%200%201%201.414%200zM4%2011a1%201%200%200%201%20.117%201.993L4%2013H3a1%201%200%200%201-.117-1.993L3%2011h1zm17%200a1%201%200%200%201%20.117%201.993L21%2013h-1a1%201%200%200%201-.117-1.993L20%2011h1zM6.213%204.81l.094.083.7.7a1%201%200%200%201-1.32%201.497l-.094-.083-.7-.7A1%201%200%200%201%206.11%204.74l.102.07zm12.894.083a1%201%200%200%201%20.083%201.32l-.083.094-.7.7a1%201%200%200%201-1.497-1.32l.083-.094.7-.7a1%201%200%200%201%201.414%200zM12%202a1%201%200%200%201%20.993.883L13%203v1a1%201%200%200%201-1.993.117L11%204V3a1%201%200%200%201%201-1zm0%205a5%205%200%201%201-4.995%205.217L7%2012l.005-.217A5%205%200%200%201%2012%207z'/%3e%3c/svg%3e");
	}
</style>
