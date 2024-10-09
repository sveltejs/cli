import { type AST, parse } from 'svelte/compiler';
import MagicString from 'magic-string';

export function svelteMagicAst(content: string): { ast: AST.Root, source: MagicString } {
    const ast = parse(content, { modern: true });
    const source = new MagicString(content);
    return { ast, source };
}
