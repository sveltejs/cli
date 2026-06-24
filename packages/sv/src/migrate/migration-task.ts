import type { AstTypes, Comments, SvelteAst } from '@sveltejs/sv-utils';

/** Marker prefixing every manual follow-up a migration leaves in the user's code. */
export const MIGRATION_TASK_MARKER = '@migration-task';

let migrationTaskCount = 0;

/** Running total of `@migration-task` comments left in the user's code during this migration run. */
export function getMigrationTaskCount(): number {
	return migrationTaskCount;
}

/** Resets the running total; call before starting a migration run. */
export function resetMigrationTaskCount(): void {
	migrationTaskCount = 0;
}

/** Target a JS/TS AST: attach the comment to `node` via the `comments` registry. */
export type JsMigrationTaskTarget = {
	comments: Comments;
	node: AstTypes.Node;
	position?: 'leading' | 'trailing';
};

/**
 * Target a Svelte component: insert a real `Comment` node into `fragment`. Needed because the
 * Svelte printer ignores the `Comments` registry but does print `Comment` AST nodes. The comment
 * is placed before `anchor` when it's a direct child of the fragment, otherwise prepended.
 */
export type SvelteMigrationTaskTarget = {
	fragment: SvelteAst.Fragment;
	anchor?: SvelteAst.SvelteNode;
};

/**
 * Leaves a standardized `@migration-task` comment for the user to resolve manually, and bumps the
 * running total so the post-migration summary can report it without re-reading files.
 *
 * The placement depends on the `target` you pass:
 * - `{ comments, node }` for a JS/TS AST (`transforms.script`)
 * - `{ fragment }` for a `.svelte` component (`transforms.svelte` / `svelteScript`)
 *
 * @example
 * ```ts
 * addMigrationTask('rewrite this manually', { comments, node });
 * addMigrationTask('rewrite this manually', { fragment: ast.fragment, anchor });
 * ```
 */
export function addMigrationTask(
	message: string,
	target: JsMigrationTaskTarget | SvelteMigrationTaskTarget
): void {
	if ('fragment' in target) {
		addSvelteComment(target.fragment, message, target.anchor);
	} else {
		target.comments.add(
			target.node,
			{ type: 'Line', value: ` ${MIGRATION_TASK_MARKER} ${message}` },
			target.position ? { position: target.position } : undefined
		);
	}

	migrationTaskCount++;
}

function addSvelteComment(
	fragment: SvelteAst.Fragment,
	message: string,
	anchor?: SvelteAst.SvelteNode
): void {
	const comment: SvelteAst.Comment = {
		type: 'Comment',
		data: ` ${MIGRATION_TASK_MARKER} ${message} `,
		start: 0,
		end: 0
	};
	const newline: SvelteAst.Text = {
		type: 'Text',
		data: '\n',
		raw: '\n',
		start: 0,
		end: 0
	};

	const index = anchor ? fragment.nodes.indexOf(anchor as (typeof fragment.nodes)[number]) : -1;
	if (index === -1) {
		fragment.nodes.unshift(comment, newline);
	} else {
		fragment.nodes.splice(index, 0, comment, newline);
	}
}
