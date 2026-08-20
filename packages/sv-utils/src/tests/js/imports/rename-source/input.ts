import { manual } from 'manual';
import { value } from 'old';

export async function load(source: string) {
	const dynamic = await import('old');
	const untouched = await import(source);
	return { value, manual, dynamic, untouched };
}
