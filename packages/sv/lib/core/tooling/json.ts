export function arrayUpsert(
	data: any,
	key: string,
	value: any,
	options?: {
		/** default: `append` */
		mode?: 'append' | 'prepend';
	}
): void {
	const array = data[key] ?? [];

	if (array.includes(value)) return;

	if (options?.mode === 'prepend') {
		array.unshift(value);
	} else {
		array.push(value);
	}
	data[key] = array;
}
