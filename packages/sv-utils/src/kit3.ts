import { coerceVersion } from './semver.ts';

/** Whether a `@sveltejs/kit` range resolves to v3+, including the `next` dist-tag. */
export function isKit3(kitRange: string | undefined): boolean {
	if (!kitRange) return false;
	if (kitRange === 'next') return true;
	const { major } = coerceVersion(kitRange);
	return major !== undefined && major >= 3;
}

/** The prefix for `src/lib` imports. Kit 3 dropped the built-in `$lib` alias for `#lib` subpath imports. */
export function resolveLibPrefix(kitRange: string | undefined): '#lib' | '$lib' {
	return isKit3(kitRange) ? '#lib' : '$lib';
}

/** The `package.json#imports` entries backing `#lib`. `libDir` is workspace-relative, e.g. `src/lib`. */
export function libSubpathImports(libDir: string): Record<string, string> {
	return { '#lib': `./${libDir}/index.js`, '#lib/*': `./${libDir}/*` };
}

/** The config kit 3 generates into `node_modules`, replacing `.svelte-kit/tsconfig.json`. */
export const KIT3_TSCONFIG = '$app/tsconfig';

/**
 * Options `$app/tsconfig` already sets. A local copy of the same value is noise, but a different
 * value is a deliberate override and must stay - so only drop keys whose value matches.
 */
export const KIT3_TSCONFIG_DEFAULT: Record<string, unknown> = {
	allowImportingTsExtensions: true,
	allowJs: true,
	checkJs: true,
	esModuleInterop: true,
	forceConsistentCasingInFileNames: true,
	isolatedModules: true,
	module: 'esnext',
	moduleDetection: 'force',
	moduleResolution: 'bundler',
	noEmit: true,
	resolveJsonModule: true,
	skipLibCheck: true,
	target: 'esnext',
	verbatimModuleSyntax: true
};
