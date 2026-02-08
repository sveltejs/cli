type Printer = (content: string, alt?: string) => string;
export function createPrinter(...conditions: boolean[]): Printer[] {
	const printers = conditions.map((condition) => {
		return (content: string, alt = '') => (condition ? content : alt);
	});
	return printers;
}
