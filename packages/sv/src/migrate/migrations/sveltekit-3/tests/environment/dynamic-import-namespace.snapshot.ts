export async function requireDynamicImportEnv(name: string): Promise<string> {
	// @migration-task Declare the imported env variables in src/env.ts manually.
	const privateEnv = await import('$app/env/private');

	const value = privateEnv[name];
	if (!value) throw new Error(`${name} must be set`);
	return value;
}
