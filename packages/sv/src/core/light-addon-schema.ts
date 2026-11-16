import * as v from 'valibot';

// PUBLIC CONTRACT: published `sv.json` files depend on every key and rule below.
// Additive only: new optional keys are fine. Never rename, remove, tighten, or change what a key does.
// `light-addon.schema.json` is generated from this file and snapshot-tested: a diff there is a contract change.

const call = v.pipe(v.string(), v.description('Expression to insert, e.g. `kitRoutes()`.'));
const from = v.pipe(v.string(), v.description('Module to import from.'));
const named = {
	from,
	import: v.pipe(v.string(), v.description('Named import.')),
	call
};
const byDefault = {
	from,
	default: v.pipe(v.string(), v.description('Local name of the default import.')),
	call
};
const position = {
	position: v.optional(
		v.pipe(
			v.picklist(['start', 'end']),
			v.description(
				'Where in `plugins`. `start` entries keep their authored order. Default: `end`.'
			)
		)
	)
};

export const LightImportSchema = v.union([v.strictObject(named), v.strictObject(byDefault)]);

const Deps = v.pipe(
	v.record(v.string(), v.string()),
	v.description('Added only when the project does not declare the package yet.')
);

const Folder = (description: string) => v.pipe(v.string(), v.description(description));

export const LightAddonSchema = v.pipe(
	v.strictObject({
		$schema: v.optional(v.string()),
		id: v.pipe(v.string(), v.minLength(1)),
		description: v.optional(v.string()),
		homepage: v.optional(v.string()),
		kit: v.optional(
			v.pipe(v.boolean(), v.description('Requires SvelteKit. Implied by `hooks` and `demo`.'))
		),
		dependencies: v.optional(Deps),
		devDependencies: v.optional(Deps),
		vite: v.optional(
			v.pipe(
				v.array(
					v.union([
						v.strictObject({ ...named, ...position }),
						v.strictObject({ ...byDefault, ...position })
					])
				),
				v.description('Vite plugins. Skipped when `from` is already imported in the config.')
			)
		),
		hooks: v.optional(
			v.strictObject({
				server: v.optional(
					v.pipe(
						v.array(LightImportSchema),
						v.description(
							'`handle`s added to `src/hooks.server` (with `sequence`). Skipped when `from` is already imported.'
						)
					)
				)
			})
		),
		files: v.optional(
			v.pipe(
				v.array(
					v.strictObject({
						from: Folder(
							'Folder relative to `sv.json`. With `ts`/`js` subfolders, the project language picks one.'
						),
						to: Folder('Project path. May start with `$lib` or `$routes`.')
					})
				),
				v.description('Copied file by file. Existing files are never overwritten.')
			)
		),
		demo: v.optional(
			Folder('Folder copied to `<routes>/demo/<id>` and linked from the demo page.')
		),
		nextSteps: v.optional(
			v.pipe(v.array(v.string()), v.description('Lines shown after the add-on ran.'))
		)
	}),
	v.title('sv light add-on'),
	v.description('A no-code `sv add` add-on.')
);

export type LightAddon = v.InferOutput<typeof LightAddonSchema>;
export type LightImport = v.InferOutput<typeof LightImportSchema>;
