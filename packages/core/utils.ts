type Printers<Condition extends Record<string, boolean>> = {
	[K in keyof Condition]: (content: string, alt?: string) => string;
};
export function createPrinter<Condition extends Record<string, boolean>>(
	conditions: Condition
): Printers<Condition> {
	const printers = Object.values(conditions).map((condition) => {
		return (content: string, alt = '') => (condition ? content : alt);
	}) as Printers<Condition>;

	return printers;
}
