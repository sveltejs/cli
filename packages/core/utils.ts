export function createPrinter(
	...conditions: boolean[]
): Array<(content: string, alt?: string) => string> {
	const printers = conditions.map((condition) => {
		return (content: string, alt = '') => (condition ? content : alt);
	});
	return printers;
}
