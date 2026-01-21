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

export function packageScriptsUpsert(
	data: any,
	key: string,
	value: any,
	options?: {
		mode?: 'append' | 'prepend';
	}
): void {
	const { mode = 'append' } = options ?? {};
	data.scripts ??= {};
	const scripts: Record<string, string> = data.scripts;
	scripts[key] ??= value;
	if (!scripts[key].includes(value)) {
		if (mode === 'prepend') {
			scripts[key] = `${value} && ${scripts[key]}`;
		} else {
			scripts[key] += ` && ${value}`;
		}
	}
}
