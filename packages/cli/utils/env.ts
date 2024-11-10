import process from 'node:process';

export const TESTING: boolean = process.env.NODE_ENV?.toLowerCase() === 'test';
