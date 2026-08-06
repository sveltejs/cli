<script context="module">
	import { redirect } from '@sveltejs/kit';

	redirect(307, 'https://example.com/from-module');
</script>

<script>
	import { redirect as go } from '@sveltejs/kit';

	go(307, 'https://example.com/from-instance');
</script>
