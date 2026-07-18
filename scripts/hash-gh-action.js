#!/usr/bin/env node
// Usage: node hash-gh-action.js owner/repo@ref
// Prints: owner/repo@<sha> # ref
import process from 'node:process';

const [, , arg] = process.argv;

if (!arg || !arg.includes('@')) {
	console.error('Usage: node hash-gh-action.js owner/repo@ref');
	process.exit(1);
}

const [repo, ref] = arg.split('@');
const token = process.env.GITHUB_TOKEN;

const headers = {
	'User-Agent': 'hash-gh-action',
	Accept: 'application/vnd.github+json',
	...(token ? { Authorization: `Bearer ${token}` } : {})
};

async function resolveActionRef() {
	const attempts = [
		`https://api.github.com/repos/${repo}/git/ref/tags/${ref}`,
		`https://api.github.com/repos/${repo}/git/ref/heads/${ref}`,
		`https://api.github.com/repos/${repo}/commits/${ref}`
	];

	for (const url of attempts) {
		const res = await fetch(url, { headers });

		if (!res.ok) continue;

		const data = await res.json();

		let sha = data.object?.sha ?? data.sha;

		if (data.object?.type === 'tag') {
			const tagRes = await fetch(data.object.url, { headers });

			if (!tagRes.ok) continue;

			const tagData = await tagRes.json();
			sha = tagData.object?.sha;
		}

		if (sha) {
			console.log(`${repo}@${sha} # ${ref}`);
			return;
		}
	}

	console.error(`Could not resolve ${arg}`);
	process.exit(1);
}

await resolveActionRef();
