import { fileURLToPath } from 'node:url';

const stub = fileURLToPath(new URL('./a11y-stub.ts', import.meta.url));

/** Build + test alias swapping svelte's a11y data for `a11y-stub.ts`. */
export const a11yStubAlias = { 'aria-query': stub, 'axobject-query': stub };
