import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => /^[\da-f]+$/i.test(param)) satisfies ParamMatcher;
