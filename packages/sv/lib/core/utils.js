/**
 * @typedef {(content: string, alt?: string) => string} Printer
 */

/**
 * @param {boolean[]} conditions
 * @returns {Printer[]}
 */
export function createPrinter(...conditions) {
	const printers = conditions.map((condition) => {
		return /** @type {Printer} */ (content, alt = '') => (condition ? content : alt);
	});
	return printers;
}
