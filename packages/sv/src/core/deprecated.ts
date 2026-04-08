const warned = new Set<string>();

/** Emit a one-time deprecation warning. */
export function svDeprecated(message: string): void {
	if (warned.has(message)) return;
	warned.add(message);
	console.warn(`[sv] Deprecated: ${message}`);
}
