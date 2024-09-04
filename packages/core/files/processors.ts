import {
	parseHtml,
	parseJson,
	parsePostcss,
	parseScript,
	parseSvelteFile,
	serializeHtml,
	serializeJson,
	serializePostcss,
	serializeScript,
	serializeSvelteFile,
	type AstTypes,
	type CssAst,
	type HtmlDocument
} from '@svelte-cli/ast-tooling';
import { fileExistsWorkspace, readFile, writeFile } from './utils.ts';
import type { ConditionDefinition } from '../adder/config.ts';
import type { OptionDefinition } from '../adder/options.ts';
import type { Workspace } from './workspace.ts';

export type CssFileEditor<Args extends OptionDefinition> = Workspace<Args> & { ast: CssAst };
export type HtmlFileEditor<Args extends OptionDefinition> = Workspace<Args> & { ast: HtmlDocument };
export type JsonFileEditor<Args extends OptionDefinition> = Workspace<Args> & { data: any };
export type ScriptFileEditor<Args extends OptionDefinition> = Workspace<Args> & {
	ast: AstTypes.Program;
};
export type SvelteFileEditor<Args extends OptionDefinition> = Workspace<Args> & {
	jsAst: AstTypes.Program;
	htmlAst: HtmlDocument;
	cssAst: CssAst;
};
export type TextFileEditor<Args extends OptionDefinition> = Workspace<Args> & { content: string };

type CssFile<Args extends OptionDefinition> = {
	contentType: 'css';
	content: (editor: CssFileEditor<Args>) => void;
};
type HtmlFile<Args extends OptionDefinition> = {
	contentType: 'html';
	content: (editor: HtmlFileEditor<Args>) => void;
};
type JsonFile<Args extends OptionDefinition> = {
	contentType: 'json';
	content: (editor: JsonFileEditor<Args>) => void;
};
type ScriptFile<Args extends OptionDefinition> = {
	contentType: 'script';
	content: (editor: ScriptFileEditor<Args>) => void;
};
type SvelteFile<Args extends OptionDefinition> = {
	contentType: 'svelte';
	content: (editor: SvelteFileEditor<Args>) => void;
};
type TextFile<Args extends OptionDefinition> = {
	contentType: 'text';
	content: (editor: TextFileEditor<Args>) => string;
};

type ParsedFile<Args extends OptionDefinition> =
	| CssFile<Args>
	| HtmlFile<Args>
	| JsonFile<Args>
	| ScriptFile<Args>
	| SvelteFile<Args>
	| TextFile<Args>;

type BaseFile<Args extends OptionDefinition> = {
	name: (options: Workspace<Args>) => string;
	condition?: ConditionDefinition<Args>;
};

export type FileType<Args extends OptionDefinition> = BaseFile<Args> & ParsedFile<Args>;

/**
 * @param files
 * @param workspace
 * @returns a list of paths of changed or created files
 */
export function createOrUpdateFiles<Args extends OptionDefinition>(
	files: Array<FileType<Args>>,
	workspace: Workspace<Args>
): string[] {
	const changedFiles = [];
	for (const fileDetails of files) {
		try {
			if (fileDetails.condition && !fileDetails.condition(workspace)) {
				continue;
			}

			const exists = fileExistsWorkspace(workspace, fileDetails.name(workspace));
			let content = exists ? readFile(workspace, fileDetails.name(workspace)) : '';

			if (fileDetails.contentType === 'css') {
				content = handleCssFile(content, fileDetails, workspace);
			}
			if (fileDetails.contentType === 'html') {
				content = handleHtmlFile(content, fileDetails, workspace);
			}
			if (fileDetails.contentType === 'json') {
				content = handleJsonFile(content, fileDetails, workspace);
			}
			if (fileDetails.contentType === 'script') {
				content = handleScriptFile(content, fileDetails, workspace);
			}
			if (fileDetails.contentType === 'svelte') {
				content = handleSvelteFile(content, fileDetails, workspace);
			}
			if (fileDetails.contentType === 'text') {
				content = handleTextFile(content, fileDetails, workspace);
			}

			writeFile(workspace, fileDetails.name(workspace), content);
			changedFiles.push(fileDetails.name(workspace));
		} catch (e) {
			if (e instanceof Error)
				throw new Error(`Unable to process '${fileDetails.name(workspace)}'. Reason: ${e.message}`);
			throw e;
		}
	}
	return changedFiles;
}

function handleCssFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: CssFile<Args>,
	workspace: Workspace<Args>
) {
	const ast = parsePostcss(content);
	ast.raws.semicolon = true; // always add the optional semicolon

	fileDetails.content({ ast, ...workspace });
	content = serializePostcss(ast);
	return content;
}

function handleHtmlFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: HtmlFile<Args>,
	workspace: Workspace<Args>
) {
	const ast = parseHtml(content);

	fileDetails.content({ ast, ...workspace });
	content = serializeHtml(ast);
	return content;
}

function handleJsonFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: JsonFile<Args>,
	workspace: Workspace<Args>
) {
	if (!content) content = '{}';
	const data = parseJson(content);

	fileDetails.content({ data, ...workspace });
	content = serializeJson(content, data);
	return content;
}

function handleScriptFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: ScriptFile<Args>,
	workspace: Workspace<Args>
) {
	const ast = parseScript(content);

	fileDetails.content({
		ast,
		...workspace
	});
	content = serializeScript(ast);
	return content;
}

function handleSvelteFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: SvelteFile<Args>,
	workspace: Workspace<Args>
) {
	const asts = parseSvelteFile(content);

	fileDetails.content({
		...asts,
		...workspace
	});

	return serializeSvelteFile(asts);
}

function handleTextFile<Args extends OptionDefinition>(
	content: string,
	fileDetails: TextFile<Args>,
	workspace: Workspace<Args>
) {
	content = fileDetails.content({ content, ...workspace });
	return content;
}
