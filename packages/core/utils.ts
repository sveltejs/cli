type Printers<Condition extends Record<string, boolean>> = {
	[K in keyof Condition]: (content: string, alt?: string) => string;
};
export function createPrinter<Condition extends Record<string, boolean>>(
	conditions: Condition
): Printers<Condition> {
	const printers = Object.entries(conditions).reduce((acc, [key, condition]) => {
		acc[key as keyof Condition] = (content: string, alt = '') => (condition ? content : alt);
		return acc;
	}, {} as Printers<Condition>);

	return printers;
}
