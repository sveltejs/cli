import { a } from 'pkg-a';
import def from 'other';

export async function load() {
	const { c } = await import('pkg-c');
	const d = await import('other-dyn');
	return { a, def, c, d };
}
