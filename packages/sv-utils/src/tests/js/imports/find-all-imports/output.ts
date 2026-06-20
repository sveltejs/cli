import { a } from 'MIGRATED/static/pkg-a';
import def from 'other';

export async function load() {
	const { c } = await import('MIGRATED/dynamic/pkg-c');
	const d = await import('other-dyn');

	return { a, def, c, d };
}
