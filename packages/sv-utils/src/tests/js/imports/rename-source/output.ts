import { manual } from 'set-manually';
import { value } from 'new';

export async function load(source: string) {
	const dynamic = await import('new');
	const untouched = await import(source);

	return { value, manual, dynamic, untouched };
}
