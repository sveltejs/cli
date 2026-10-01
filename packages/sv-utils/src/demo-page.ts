import dedent from 'dedent';
import type { SvelteAst } from './tooling/index.ts';
import { type TransformFn, transforms } from './tooling/transforms.ts';

type KitRoutes = string & {};
type AddonName = string & {};

export type DemoPage = {
	/** Where the add-on's own demo route belongs. */
	addonPath: `${KitRoutes}/demo/${AddonName}`;
	/** Upserts the add-on link into the floating `DemoLinks` component. */
	links: [path: `${KitRoutes}/demo/DemoLinks.svelte`, transform: TransformFn];
	/** Upserts `<DemoLinks />` into the root layout. */
	layout: [path: `${KitRoutes}/+layout.svelte`, transform: TransformFn];
};

const COMPONENT = 'DemoLinks';

function walk(nodes: SvelteAst.SvelteNode[], visit: (node: SvelteAst.SvelteNode) => boolean) {
	for (const node of nodes) {
		if (visit(node)) return true;
		if ('fragment' in node && node.fragment && 'nodes' in node.fragment) {
			if (walk(node.fragment.nodes, visit)) return true;
		}
	}
	return false;
}

const scriptTag = (language: 'ts' | 'js') => `<script${language === 'ts' ? ' lang="ts"' : ''}>`;

const linksTemplate = (language: 'ts' | 'js') => dedent`
	${scriptTag(language)}
		import { resolve } from '$app/paths';
		import { page } from '$app/state';

		const KEY = 'sv-demo-visited';
		let visited = $state(new Set());

		// ticks each demo once visited, remembered across reloads
		$effect(() => {
			const seen = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
			seen.add(page.url.pathname);
			localStorage.setItem(KEY, JSON.stringify([...seen]));
			visited = seen;
		});
	</script>

	<!-- Added by \`sv add\`. To remove: delete this file and \`<${COMPONENT} />\` from +layout.svelte -->
	<div class="sv-demo-links">
		<p>sv addon demos</p>
		<ul></ul>
	</div>

	<style>
		.sv-demo-links {
			position: fixed;
			right: 1.25rem;
			bottom: 1.25rem;
			z-index: 9999;
			min-width: 11rem;
			max-width: 16rem;
			padding: 1rem 1.125rem 0.875rem;
			background: linear-gradient(to bottom, #fff9b0, #fff176);
			color: #3d3500;
			font: 14px/1.5 system-ui, sans-serif;
			text-align: left;
			box-shadow:
				0 1px 2px rgb(0 0 0 / 0.15),
				0 10px 24px -6px rgb(0 0 0 / 0.35);
			transform: rotate(-1.5deg);
		}
		/* tape */
		.sv-demo-links::before {
			content: '';
			position: absolute;
			top: -0.5rem;
			left: 50%;
			width: 4.5rem;
			height: 1.25rem;
			background: rgb(255 255 255 / 0.55);
			box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
			transform: translateX(-50%) rotate(2deg);
		}
		p {
			margin: 0;
			font-weight: 700;
			letter-spacing: 0.02em;
		}
		ul {
			margin: 0.5rem 0 0;
			padding: 0;
			list-style: none;
		}
		li {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.125rem 0;
		}
		input {
			margin: 0;
			accent-color: #3d3500;
		}
		a {
			color: #1a4fd6;
			text-decoration: underline;
			text-underline-offset: 2px;
		}
		a:hover {
			color: #0b2f8a;
		}
		input:checked + a {
			color: #6b6420;
		}
	</style>
`;

const layoutTemplate = (language: 'ts' | 'js') => dedent`
	${scriptTag(language)}
		let { children } = $props();
	</script>

	{@render children()}
`;

/**
 * Wires an add-on demo into a SvelteKit project: a floating `DemoLinks` post-it,
 * rendered from the root layout, listing every add-on demo route.
 *
 * ```ts
 * const demo = defineDemoPage('my-addon', language, directory.kitRoutes);
 * sv.file(...demo.links);
 * sv.file(...demo.layout);
 * sv.file(`${demo.addonPath}/+page.svelte`, ...);
 * ```
 *
 * Both transforms are idempotent, so re-running an add-on won't duplicate entries.
 */
export function defineDemoPage(name: string, language: 'ts' | 'js', kitRoutes: string): DemoPage {
	const href = `/demo/${name}`;

	const links: TransformFn = (content) =>
		transforms.svelteScript({ language }, ({ ast, content, js, svelte }) => {
			let ul: SvelteAst.RegularElement | undefined;
			const exists = walk(ast.fragment.nodes, (node) => {
				if (node.type !== 'RegularElement') return false;
				if (node.name === 'ul') ul ??= node;
				if (node.name !== 'a') return false;
				const attr = node.attributes.find((a) => a.type === 'Attribute' && a.name === 'href');
				// source slice so `/demo/x`, `{resolve('/demo/x')}`, ... all match
				return !!attr && content.slice(attr.start, attr.end).includes(`'${href}'`);
			});
			if (exists || !ul) return false;

			js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });
			svelte.addFragment(
				ul,
				`<li><input type="checkbox" inert checked={visited.has(resolve('${href}'))} aria-label="visited ${name}" /><a href={resolve('${href}')}>${name}</a></li>`
			);
		})(content || linksTemplate(language));

	const layout: TransformFn = (content) =>
		transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
			const exists = walk(
				ast.fragment.nodes,
				(node) => node.type === 'Component' && node.name === COMPONENT
			);
			if (exists) return false;

			js.imports.addDefault(ast.instance.content, {
				as: COMPONENT,
				from: `./demo/${COMPONENT}.svelte`
			});
			svelte.addFragment(ast, `<${COMPONENT} />`);
		})(content || layoutTemplate(language));

	return {
		addonPath: `${kitRoutes}/demo/${name}`,
		links: [`${kitRoutes}/demo/${COMPONENT}.svelte`, links],
		layout: [`${kitRoutes}/+layout.svelte`, layout]
	};
}
