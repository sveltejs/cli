export const pageServer = `
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema.js';

export const load = async () => {
	await insertUser({ name: 'Foobar', id: 0, age: 20 }).catch((err) => console.error(err));

	const users = await db.select().from(user);

	return { users };
};

function insertUser(value) {
	return db.insert(user).values(value);
}
`;

export const pageComp = `
<script>
	export let data;
</script>

{#each data.users as user}
	<span data-testid="user">{user.id} {user.name}</span>
{/each}
`;
