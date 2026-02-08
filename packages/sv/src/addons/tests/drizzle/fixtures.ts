export const pageServer = `
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema.js';

export const load = async () => {
	await insertTask({ title: 'My first task', id: 0, priority: 1 }).catch((err) => console.error(err));

	const tasks = await db.select().from(task);

	return { tasks };
};

function insertTask(value) {
	return db.insert(task).values(value);
}
`;

export const pageComp = `
<script>
	export let data;
</script>

{#each data.tasks as task}
	<span data-testid="task">{task.id} {task.title}</span>
{/each}
`;
