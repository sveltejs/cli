#!/usr/bin/env bash

echo "UPDATING TEMPLATE REPO: https://github.com/sveltejs/kit-template-railway..."

set -e

get_sv_version() {
	pnpm -F sv exec node -p "require('./package.json').version"
}

ADDON_REPO=${ADDON_REPO:-git@github.com:sveltejs/sv-addon-railway.git}
ADDON_REF=${ADDON_REF:-main}
TEMPLATE_REPO=${TEMPLATE_REPO:-git@github.com:sveltejs/kit-template-railway.git}

VERSION=$(get_sv_version)
SV=$(cd "$(dirname "$0")/../../.." && pwd)/dist/bin.mjs

# outside the repo: a generated app inside it would resolve the cli pnpm workspace
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if [ "$CI" ]; then
	(umask 0077; echo "$UPDATE_RAILWAY_TEMPLATE_SSH_KEY" > ~/ssh_key;)
	export GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new -i ~/ssh_key'
fi

# first, so missing access fails before we spend minutes generating.
# the dry run is the real check: a deploy key can read a public repo it cannot push to
git clone --depth 1 --single-branch --branch main $TEMPLATE_REPO $TMP/repo
git -C $TMP/repo push --dry-run $TEMPLATE_REPO main

# the add-on lives in its own repo and isn't on npm yet
git clone --depth 1 --single-branch --branch $ADDON_REF $ADDON_REPO $TMP/addon
ADDON_SHA=$(git -C $TMP/addon rev-parse --short HEAD)
cd $TMP/addon
pnpm install --frozen-lockfile --ignore-workspace
pnpm build

# generate the app: same recipe as the add-on repo's `pnpm smoke`
cd $TMP
$SV create kit-template-railway \
	--template minimal --types ts \
	--add drizzle="database:postgresql+client:postgres.js+docker:yes" \
	better-auth="demo:password" \
	"file:$TMP/addon"="projectName:Svelte & Railway starter+enableStyle:yes" \
	--install pnpm --no-download-check

cd $TMP/kit-template-railway
# the better-auth addon leaves a stub schema; the real one must be committed for the template
pnpm auth:schema

# TODO: the add-on should write this itself, then this block can go
# TODO: `file:` path in the reproduce command: drop once sv-addon-railway is on npm
sed -i "s|file:$TMP/addon=|sv-addon-railway=|" README.md
{
	cat <<-'EOF'
	# Svelte & Railway starter

	[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/svelte-kit)

	SvelteKit + Drizzle (Postgres) + Better Auth, generated with [`sv`](https://github.com/sveltejs/cli) and the [railway add-on](https://github.com/sveltejs/sv-addon-railway). Deploys to Railway with one click, or via `railway config apply` (see `.railway/railway.ts`).
	EOF
	tail -n +4 README.md
} > README.next && mv README.next README.md

# Railpack defaults to pnpm 9 (rejects the generated workspace file); 11+ breaks onlyBuiltDependencies
pnpm pkg set packageManager=pnpm@$(npm view pnpm dist-tags.latest-10)

# gate: build like Railway does before pushing anything (env vars come from the template at build time)
DATABASE_URL=postgres://build:build@localhost:5432/build BETTER_AUTH_SECRET=build pnpm build
rm -rf build .svelte-kit node_modules

# replace the template repo's contents
find $TMP/repo -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a $TMP/kit-template-railway/. $TMP/repo/

cd $TMP/repo

if [ "$CI" ]; then
	git config user.email 'noreply@svelte.dev'
	git config user.name '[bot]'
fi

# commit when there are new files
if [[ `git status --porcelain` ]]; then
	git add -A
	git commit -m "sv $VERSION, sv-addon-railway $ADDON_SHA"
	git push $TEMPLATE_REPO main -f
fi
