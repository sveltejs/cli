// Rolldown doesn't support dynamic import vars yet.
export async function getAdderDetails(name: string) {
	let adder;
	switch (name) {
		case 'drizzle':
			adder = await import('./drizzle/index');
			break;
		case 'eslint':
			adder = await import('./eslint/index');
			break;
		case 'mdsvex':
			adder = await import('./mdsvex/index');
			break;
		case 'playwright':
			adder = await import('./playwright/index');
			break;
		case 'prettier':
			adder = await import('./prettier/index');
			break;
		case 'routify':
			adder = await import('./routify/index');
			break;
		case 'storybook':
			adder = await import('./storybook/index');
			break;
		case 'tailwindcss':
			adder = await import('./tailwindcss/index');
			break;
		case 'vitest':
			adder = await import('./vitest/index');
			break;
		default:
			throw new Error(`invalid adder name: ${name}`);
	}

	return adder.default;
}
