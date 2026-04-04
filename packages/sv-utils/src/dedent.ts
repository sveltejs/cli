import dedentImpl from 'dedent';

/**
 * Template-tag or single-string dedent helper (same behavior as the `dedent` package).
 * Types are hand-written so the public `.d.mts` does not inline `dedent`'s full declarations.
 */
export type Dedent = {
	(strings: TemplateStringsArray, ...values: unknown[]): string;
	(source: string): string;
};

const dedent: Dedent = dedentImpl as Dedent;
export default dedent;
