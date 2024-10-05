export const TESTING: boolean =
	process.env.CI?.toLowerCase() === 'true' || process.env.NODE_ENV?.toLowerCase() === 'test';
