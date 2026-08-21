import { resolve } from '$app/paths';

// single-argument `resolve()` calls with route ids must keep their leading slash
export const root = resolve('/');
export const grouped = resolve('/(app)/about');
export const optional = resolve('/[[lang]]/home');
export const rest = resolve('/docs/[...path]');
export const plain = resolve('plain');
export const about = resolve('about');
