export async function requireDynamicImportEnv(name: string): Promise<string> {
	const privateEnv = await import('$env/dynamic/private');
	const value = privateEnv[name];
	if (!value) throw new Error(`${name} must be set`);
	return value;
}
