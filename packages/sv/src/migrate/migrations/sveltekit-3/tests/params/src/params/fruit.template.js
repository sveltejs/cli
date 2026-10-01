import { fruits } from '../lib/fruits.js';

const allowed = new Set(fruits);

/** @type {import('@sveltejs/kit').ParamMatcher} */
export const match = (param) => allowed.has(param);
