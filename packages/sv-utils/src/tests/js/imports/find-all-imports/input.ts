import def from 'other';
import { a } from 'pkg-a';

export async function load() {
	const { c } = await import('pkg-c');
	const d = await import('other-dyn');
	return { a, def, c, d };
}
