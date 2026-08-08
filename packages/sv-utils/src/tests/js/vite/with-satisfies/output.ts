import myPlugin from 'my-plugin';
import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import examples from 'mdsvexamples/vite';
import { defineConfig, type UserConfig } from 'vite';
import { kitRoutes } from 'vite-plugin-kit-routes';

const $root = path.resolve(__dirname, './src');
const libDir = path.resolve($root, './lib');
const $routes = path.resolve($root, './routes');
const $scripts = path.resolve(libDir, './scripts');
const $actions = path.resolve(libDir, './actions');

const config = defineConfig({
	plugins: [
		// all plugins
		examples,
		tailwindcss(),
		sveltekit(),
		kitRoutes(),
		myPlugin()
	],
	resolve: { alias: { libDir, $routes, $scripts, $actions } },
	build: { sourcemap: true, target: 'esnext', cssMinify: 'lightningcss' },
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			targets: browserslistToTargets(browserslist('defaults, not ie 11'))
		}
	},
	experimental: { enableNativePlugin: true }
}) satisfies UserConfig;

export default config;
