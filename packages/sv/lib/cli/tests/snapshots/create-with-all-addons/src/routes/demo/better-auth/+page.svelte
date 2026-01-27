<script lang='ts'>
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	async function logout() {
		await authClient.signOut();
		goto('/demo/better-auth/login');
	}
</script>

<h1>Hi, {data.user.name}!</h1>
<p>Your user ID is {data.user.id}.</p>
<button onclick={logout} class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Sign out</button>
