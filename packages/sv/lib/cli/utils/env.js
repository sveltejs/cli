import process from 'node:process';

/** @type {boolean} */
export const TESTING = process.env.NODE_ENV?.toLowerCase() === 'test';
