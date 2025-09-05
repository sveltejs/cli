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

export type SelectQuestionOptions<Value = any> = Array<{
	value: Value;
	label?: string;
	hint?: string;
}>;

export type SelectQuestion<Value = any> = {
	type: 'select';
	default: Value;
	options: SelectQuestionOptions<Value>;
};

export type MultiSelectQuestion<Value = any> = {
	type: 'multiselect';
	default: Value[];
	options: SelectQuestionOptions<Value>;
	required: boolean;
};

export type BaseQuestion<Args extends OptionDefinition = OptionDefinition> = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 */
	condition?: (options: OptionValues<Args>) => boolean;
};

export type Question<Args extends OptionDefinition = OptionDefinition> = BaseQuestion<Args> &
	(BooleanQuestion | StringQuestion | NumberQuestion | SelectQuestion | MultiSelectQuestion);

export type OptionDefinition = Record<string, Question<any>>;
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

export function selectQuestion<Value = any>(
	o: Omit<SelectQuestion<Value> & BaseQuestion, 'type'>
): SelectQuestion<Value> & BaseQuestion {
	return {
		type: 'select',
		...o
	};
}

export function multiSelectQuestion<Value = any>(
	o: Omit<MultiSelectQuestion<Value> & BaseQuestion, 'type'>
): MultiSelectQuestion<Value> & BaseQuestion {
	return {
		type: 'multiselect',
		...o
	};
}
