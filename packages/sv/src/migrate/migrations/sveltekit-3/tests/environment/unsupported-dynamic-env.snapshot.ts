import { env } from '$env/dynamic/private';

export function requireEnv(name: string): string {
	// @migration-task Rewrite dynamic env lookup manually.
	const value = env[name];
	if (!value) throw new Error(`${name} must be set`);
	return value;
}
