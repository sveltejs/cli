import { color } from '@sveltejs/sv-utils';

const warned = new Set<string>();

/** Emit a one-time deprecation warning. */
export function svDeprecated(message: string): void {
	if (warned.has(message)) return;
	warned.add(message);
	console.warn();
	console.warn(`   ${color.dim('[sv] Deprecated:')} ${message}`);
	console.warn(`       Still works. ${color.warning("Warn add-on's author about it.")}`);
	console.warn();
}
