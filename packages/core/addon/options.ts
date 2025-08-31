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

// Utility type to prettify complex types for better IDE display
type Prettify<T> = {
	[P in keyof T]: T[P];
} & {};

// Extract the resolved values from option definitions
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

// Partial option values for condition functions - excludes the current option being evaluated
export type PartialOptionValues<T extends OptionDefinition, CurrentKey extends keyof T> = Prettify<
	Partial<OptionValues<Omit<T, CurrentKey>>>
>;

// Enhanced BaseQuestion that supports properly typed condition function
export type TypedBaseQuestion<T extends OptionDefinition, K extends keyof T> = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 * The `options` parameter contains the values of other options (excluding the current one).
	 */
	condition?: (options: PartialOptionValues<T, K>) => boolean;
};

// Helper type to create properly typed option definitions
export type OptionDefinition<T extends Record<string, any> = any> = {
	[K in keyof T]: TypedBaseQuestion<T, K> &
		(BooleanQuestion | StringQuestion | NumberQuestion | SelectQuestion | MultiSelectQuestion);
};

// Legacy OptionDefinition for backward compatibility
// export type OptionDefinition = Record<string, Question>;

// Legacy types for backward compatibility
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
