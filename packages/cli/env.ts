import process from 'node:process';

export const TESTING: boolean = process.env.CI?.toLowerCase() === 'true';
