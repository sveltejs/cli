import fs from 'node:fs';
import path, { join } from 'node:path';
import enhancedImg from '../../enhanced-img.ts';
import { setupTest } from '../_setup/suite.ts';

/** one file per `<img>` rewriting case, written before the addon runs */
const fixtures = {
	// tab indented, binding only used by the `<img>`: import is dropped
	'Tabs.svelte': `<script>
	import logo from '../assets/logo.png';
</script>

<img src={logo} alt="logo" />
`,
	// space indented: the import is still dropped
	'Spaces.svelte': `<script>
  import logo from '../assets/logo.png';
</script>

<img class="a" src={logo} alt="logo" />
`,
	// binding used elsewhere: the import has to stay
	'Shared.svelte': `<script>
	import logo from '../assets/logo.png';
</script>

<svelte:head><meta property="og:image" content={logo} /></svelte:head>
<img src={logo} alt="logo" />
`,
	// `.svg` is not processed by enhanced-img
	'Svg.svelte': `<script>
	import logo from '../assets/logo.svg';
</script>

<img src={logo} alt="logo" />
`,
	// runtime sources cannot be resolved at build time
	'Runtime.svelte': `<script>
	let { src } = $props();
</script>

<img {src} alt="logo" />
<img src="/favicon.png" alt="static" />
`
} as const;

const { test, testCases } = setupTest(
	{ enhancedImg },
	{
		kinds: [{ type: 'default', options: { 'enhanced-img': {} } }],
		browser: false,
		preAdd: ({ cwd }) => {
			const dir = path.resolve(cwd, 'src/fixtures');
			fs.mkdirSync(dir, { recursive: true });
			for (const [name, content] of Object.entries(fixtures)) {
				fs.writeFileSync(path.resolve(dir, name), content, 'utf8');
			}
		}
	}
);

test.concurrent.for(testCases)('enhanced-img $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const config = join(cwd, `vite.config.${testCase.variant.endsWith('-ts') ? 'ts' : 'js'}`);
	const source = fs.readFileSync(config, 'utf8');

	expect(source).toMatch(`from '@sveltejs/enhanced-img'`);
	expect(source).toMatch('enhancedImages()');

	const pkg = JSON.parse(fs.readFileSync(join(cwd, 'package.json'), 'utf8'));
	expect(pkg.devDependencies).toHaveProperty('@sveltejs/enhanced-img');

	// `pnpm-workspace.yaml` is found up, at the root of the test suite workspace
	const yaml = fs.readFileSync(join(cwd, '..', 'pnpm-workspace.yaml'), 'utf8');
	expect(yaml).toMatch('sharp');

	const fixture = (name: keyof typeof fixtures) =>
		fs.readFileSync(join(cwd, 'src/fixtures', name), 'utf8');

	// the import is inlined into `src`, no `?enhanced` query needed
	expect(fixture('Tabs.svelte')).toBe(`<script>
</script>

<enhanced:img src="../assets/logo.png" alt="logo" />
`);

	expect(fixture('Spaces.svelte')).toBe(`<script>
</script>

<enhanced:img class="a" src="../assets/logo.png" alt="logo" />
`);

	expect(fixture('Shared.svelte')).toBe(`<script>
	import logo from '../assets/logo.png';
</script>

<svelte:head><meta property="og:image" content={logo} /></svelte:head>
<enhanced:img src="../assets/logo.png" alt="logo" />
`);

	expect(fixture('Svg.svelte')).toBe(fixtures['Svg.svelte']);
	expect(fixture('Runtime.svelte')).toBe(fixtures['Runtime.svelte']);
});
