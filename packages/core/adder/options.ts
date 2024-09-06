export type BooleanQuestion = {
	type: 'boolean';
	default: boolean;
};

export type StringQuestion = {
	type: 'string';
	default: string;
};

export type NumberQuestion = {
	type: 'number';
	default: number;
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
	// TODO: we want this to be akin to OptionValues<Args> so that the options can be inferred
	condition?: (options: OptionValues<any>) => boolean;
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
