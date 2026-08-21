import type { Path } from '$app/types';

// `resolve` and `asset` are unrelated globals, not imports from `$app/paths`
export const x = resolve('/foo');
export const y = asset('/bar.png');
export const p: Path = '/baz';
