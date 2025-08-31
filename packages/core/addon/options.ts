export type BooleanQuestion = {
	type: 'boolean';
	default: boolean;
};

export type StringQuestion = {
	type: 'string';
	default: string;
	validate?: (value: string | undefined) => string | Error | undefined;
	placeholder?: string;
};

export type NumberQuestion = {
	type: 'number';
	default: number;
	validate?: (value: string | undefined) => string | Error | undefined;
	placeholder?: string;
};

export type SelectQuestion<Value = any> = {
	type: 'select';
	default: Value;
	options: Array<{ value: Value; label?: string; hint?: string }>;
};

export type MultiSelectQuestion<Value = any> = {
	type: 'multiselect';
	default: Value[];
	options: Array<{ value: Value; label?: string; hint?: string }>;
	required: boolean;
};

export type BaseQuestion = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 */
	condition?: (options: any) => boolean;
};

export type Question = BaseQuestion &
	(BooleanQuestion | StringQuestion | NumberQuestion | SelectQuestion | MultiSelectQuestion);

export type OptionDefinition = Record<string, Question>;
export type OptionValues<Args extends OptionDefinition> = {
	[K in keyof Args]: Args[K] extends StringQuestion
		? string
		: Args[K] extends BooleanQuestion
			? boolean
			: Args[K] extends NumberQuestion
				? number
				: Args[K] extends SelectQuestion<infer Value>
					? Value
					: Args[K] extends MultiSelectQuestion<infer Value>
						? Value[]
						: never;
};

// Helper type for creating properly typed option definitions
// Extract option values directly from the input type
export type ExtractOptionValues<T extends Record<string, any>> = {
	[K in keyof T]: T[K] extends { type: 'string'; default: infer D }
		? D extends string
			? string
			: never
		: T[K] extends { type: 'boolean'; default: infer D }
			? D extends boolean
				? boolean
				: never
			: T[K] extends { type: 'number'; default: infer D }
				? D extends number
					? number
					: never
				: T[K] extends { type: 'select'; options: Array<{ value: infer V }> }
					? V
					: T[K] extends { type: 'multiselect'; options: Array<{ value: infer V }> }
						? V[]
						: never;
};

// Create a properly typed option definition that preserves the structure
// but adds typed conditions
export type InferredOptionDefinition<T extends Record<string, any>> = {
	[K in keyof T]: T[K] extends infer Q
		? Q & {
				condition?: (options: Partial<ExtractOptionValues<T>>) => boolean;
			}
		: never;
};
