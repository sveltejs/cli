<script lang='ts'>
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<form method="post" action="?/signInEmail" use:enhance>
	<label>
		Email
		<input type="email" name="email" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
	</label>
	<label>
		Password
		<input type="password" name="password" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
	</label>
	<label>
		Name (for registration)
		<input name="name" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
	</label>
	<button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Login</button>
	<button formaction="?/signUpEmail" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Register</button>
</form>
<p class="text-red-500">{form?.message ?? ''}</p>

<hr class="my-4" />
<form method="post" action="?/signInSocial" use:enhance>
	<input type="hidden" name="provider" value="github" />
	<input type="hidden" name="callbackURL" value="/demo/better-auth" />
	<button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Sign in with GitHub</button>
</form>
