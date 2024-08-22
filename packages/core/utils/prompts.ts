import {
	cancel,
	intro,
	isCancel,
	outro,
	select,
	text,
	multiselect,
	note,
	groupMultiselect,
	confirm
} from '@svelte-cli/clack-prompts';

type Primitive = Readonly<string | boolean | number>;
export type PromptOption<Value> = Value extends Primitive
	? {
			value: Value;
			label?: string;
			hint?: string;
		}
	: {
			value: Value;
			label: string;
			hint?: string;
		};

export function startPrompts(message: string): void {
	intro(message);
}

export function endPrompts(message: string): void {
	outro(message);
}

export async function confirmPrompt(message: string, initialValue: boolean): Promise<boolean> {
	const value = await confirm({
		message,
		initialValue
	});
	return cancelIfRequired(value);
}

export async function booleanPrompt(question: string, initialValue: boolean): Promise<boolean> {
	return selectPrompt(question, initialValue, [
		{ label: 'Yes', value: true },
		{ label: 'No', value: false }
	]);
}

export async function selectPrompt<T>(
	question: string,
	initialValue: T,
	options: Array<PromptOption<T>>
): Promise<T extends symbol ? never : T> {
	const value = await select({
		message: question,
		options,
		initialValue
	});

	return cancelIfRequired(value);
}

export async function textPrompt(
	question: string,
	placeholder: string = '',
	initialValue: string = ''
): Promise<string> {
	const value = await text({
		message: question,
		placeholder,
		initialValue
	});

	const result = cancelIfRequired(value);
	return result;
}

export async function multiSelectPrompt<T>(
	question: string,
	options: Array<PromptOption<T>>
): Promise<T[]> {
	const value = await multiselect<T>({
		message: question,
		options,
		required: false
	});

	return cancelIfRequired(value);
}

export async function groupedMultiSelectPrompt<T>(
	question: string,
	options: Record<string, Array<PromptOption<T>>>
): Promise<T[]> {
	const value = await groupMultiselect<T>({
		message: question,
		options,
		required: false,
		selectableGroups: false,
		spacedGroups: true
	});

	return cancelIfRequired(value);
}

export function messagePrompt(title: string, content: string): void {
	note(content, title);
}

function cancelIfRequired<T>(value: T): T extends symbol ? never : T {
	if (typeof value === 'symbol' || isCancel(value)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	// @ts-expect-error hacking it to never return a symbol. there's probably a better way, but this works for now.
	return value;
}
