import dedent from 'dedent';
import type { SvelteAst } from './tooling/index.ts';
import { type TransformFn, transforms } from './tooling/transforms.ts';

const findElement = (
	nodes: SvelteAst.SvelteNode[],
	name: string
): SvelteAst.RegularElement | undefined => {
	for (const node of nodes) {
		if (node.type === 'RegularElement' && node.name === name) return node;
		if ('fragment' in node && node.fragment && 'nodes' in node.fragment) {
			const result = findElement(node.fragment.nodes, name);
			if (result) return result;
		}
	}
	return undefined;
};

const hasDemoLink = (nodes: SvelteAst.Fragment['nodes'], addonName?: string): boolean => {
	for (const node of nodes) {
		if (node.type !== 'RegularElement') continue;
		const hrefAttribute = node.attributes.find(
			(x): x is SvelteAst.Attribute => x.type === 'Attribute' && x.name === 'href'
		);
		if (!hrefAttribute?.value) continue;
		if (!Array.isArray(hrefAttribute.value)) continue;
		return hrefAttribute.value.some(
			// `includes` because the href may be `/demo/x`, `resolve("demo/x")` or `resolve('demo/x')`
			(x) => x.type === 'Text' && x.data.includes(`/demo${addonName ? `/${addonName}` : ''}`)
		);
	}
	return false;
};

type KitRoutes = string & {};
type AddonName = string & {};

export type DemoPage = {
	/** Where the add-on's own demo route belongs. */
	addonPath: `${KitRoutes}/demo/${AddonName}`;
	/** Links the add-on from the `/demo` index. */
	listing: [path: `${KitRoutes}/demo/+page.svelte`, transform: TransformFn];
	/** Adds a `Demo` entry to the template's nav, when it has one. */
	header: [path: `${KitRoutes}/Header.svelte`, transform: TransformFn];
};

/**
 * Wires an add-on into the `/demo` section of a SvelteKit project.
 *
 * ```ts
 * const demo = defineDemoPage('my-addon', language, directory.kitRoutes);
 * sv.file(...demo.listing);
 * sv.file(...demo.header);
 * sv.file(`${demo.addonPath}/+page.svelte`, ...);
 * ```
 *
 * Both transforms bail out once their link exists, so re-running an add-on
 * won't duplicate entries. The header transform also bails on templates whose
 * layout has no nav list.
 */
export function defineDemoPage(name: string, language: 'ts' | 'js', kitRoutes: string): DemoPage {
	const listing = transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
		if (hasDemoLink(ast.fragment.nodes, name)) return false;

		js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });
		svelte.addFragment(ast, `<a href={resolve('/demo/${name}')}>${name}</a>`, { mode: 'prepend' });
	});

	const header = transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
		const ul = findElement(ast.fragment.nodes, 'ul');
		if (!ul) return false;
		if (hasDemoLink(ul.fragment.nodes)) return false;

		js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });
		svelte.addFragment(
			ul,
			dedent`
				<li aria-current={page.url.pathname.startsWith('/demo') ? 'page' : undefined}>
					<a href={resolve('/demo')}>Demo</a>
				</li>`
		);
	});

	return {
		addonPath: `${kitRoutes}/demo/${name}`,
		listing: [`${kitRoutes}/demo/+page.svelte`, listing],
		header: [`${kitRoutes}/Header.svelte`, header]
	};
}
