import path from 'node:path';
import * as fs from 'node:fs';
import { parseSvelte } from '@sveltejs/cli-core/parsers';
import * as js from '@sveltejs/cli-core/js';

export function validatePlaygroundUrl(link: string): boolean {
	try {
		const url = new URL(link);
		if (url.hostname !== 'svelte.dev' || !url.pathname.startsWith('/playground/')) {
			return false;
		}

		const { playgroundId, hash } = extractPartsFromPlaygroundUrl(link);
		return playgroundId !== undefined || hash !== undefined;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_) {
		// new Url() will throw if the URL is invalid
		return false;
	}
}

export function extractPartsFromPlaygroundUrl(link: string): {
	playgroundId: string | undefined;
	hash: string | undefined;
} {
	const url = new URL(link);
	const [, playgroundId] = url.pathname.match(/\/playground\/([^/]+)/) || [];
	const hash = url.hash !== '' ? url.hash.slice(1) : undefined;

	return { playgroundId, hash };
}

type PlaygroundData = {
	name: string;
	files: Array<{
		name: string;
		content: string;
	}>;
};
export async function downloadFilesFromPlayground({
	playgroundId,
	hash
}: {
	playgroundId?: string;
	hash?: string;
}): Promise<PlaygroundData> {
	let data = [];
	// forked playgrounds have a playground_id and an optional hash.
	// usually the hash is more up to date so take the hash if present.
	if (hash) {
		data = JSON.parse(await decode_and_decompress_text(hash));
	} else {
		const response = await fetch(`https://svelte.dev/playground/api/${playgroundId}.json`);
		data = await response.json();
	}

	// saved playgrounds and playground hashes have a different structure
	// therefore we need to handle both cases.
	const files = data.components !== undefined ? data.components : data.files;
	return {
		name: data.name,
		files: files.map((file: { name: string; type: string; contents: string; source: string }) => {
			return {
				name: file.name + (file.type !== 'file' ? `.${file.type}` : ''),
				content: file.source || file.contents
			};
		})
	};
}

// Taken from https://github.com/sveltejs/svelte.dev/blob/ba7ad256f786aa5bc67eac3a58608f3f50b59e91/apps/svelte.dev/src/routes/(authed)/playground/%5Bid%5D/gzip.js#L19-L29
/** @param {string} input */
async function decode_and_decompress_text(input: string) {
	const decoded = atob(input.replaceAll('-', '+').replaceAll('_', '/'));
	// putting it directly into the blob gives a corrupted file
	const u8 = new Uint8Array(decoded.length);
	for (let i = 0; i < decoded.length; i++) {
		u8[i] = decoded.charCodeAt(i);
	}
	const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

export function setupPlayogroundProject(playground: PlaygroundData, cwd: string): void {
	for (const file of playground.files) {
		const filePath = path.join(cwd, 'src', 'routes', file.name);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, file.content, 'utf8');
	}

	const filePath = path.join(cwd, 'src/routes/+page.svelte');
	const content = fs.readFileSync(filePath, 'utf-8');
	const { script, template, generateCode } = parseSvelte(content);
	js.imports.addDefault(script.ast, {
		from: './App.svelte',
		as: 'App'
	});
	template.source = template.source + `\n<App />`;
	const newContent = generateCode({
		script: script.generateCode(),
		template: template.source
	});
	fs.writeFileSync(filePath, newContent, 'utf-8');
}
