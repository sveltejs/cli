<script lang='ts'>
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<form method="post" action="?/signInEmail" use:enhance>
	<label>
		Email
		<input type="email" name="email" />
	</label>
	<label>
		Password
		<input type="password" name="password" />
	</label>
	<label>
		Name (for registration)
		<input name="name" />
	</label>
	<button>Login</button>
	<button formaction="?/signUpEmail">Register</button>
</form>
<p style="color: red">{form?.message ?? ''}</p>

<hr  />

<form method="post" action="?/signInSocial" use:enhance>
	<input type="hidden" name="provider" value="github" />
	<input type="hidden" name="callbackURL" value="/demo/better-auth" />
	<button>Sign in with GitHub</button>
</form>
