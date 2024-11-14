export type BooleanQuestion = {
	type: 'boolean';
	default: boolean;
};

export type StringQuestion = {
	type: 'string';
	default: string;
	validate?: (value: string) => string | undefined;
	placeholder?: string;
};

export type NumberQuestion = {
	type: 'number';
	default: number;
	validate?: (value: string) => string | undefined;
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
};

export type BaseQuestion = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 */
	condition?: (options: any) => boolean;
	// TODO: we want to type `options` similar to OptionValues<Args> so that its option values can be inferred
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
