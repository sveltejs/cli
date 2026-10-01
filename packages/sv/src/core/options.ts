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

export type SelectQuestion<Value> = {
	type: 'select';
	default: NoInfer<Value>;
	options: Array<{ value: Value; label?: string; hint?: string }>;
};

export type MultiSelectQuestion<Value> = {
	type: 'multiselect';
	default: NoInfer<Value[]>;
	options: Array<{ value: Value; label?: string; hint?: string }>;
	required: boolean;
};

export type BaseQuestion<Args extends OptionDefinition> = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 */
	condition?: (options: OptionValues<Args>) => boolean;
};

export type Question<Args extends OptionDefinition = OptionDefinition> = BaseQuestion<Args> &
	(
		| BooleanQuestion
		| StringQuestion
		| NumberQuestion
		| SelectQuestion<any>
		| MultiSelectQuestion<any>
	);

export type OptionDefinition = Record<string, Question<any>>;

// `[…]` pairs keep unions from distributing.
type QuestionFor<Value> = BaseQuestion<any> &
	([Value] extends [boolean]
		? BooleanQuestion
		: [Value] extends [number]
			? NumberQuestion
			: [Value] extends [Array<infer Item>]
				? MultiSelectQuestion<Item>
				: [string] extends [Value]
					? StringQuestion
					: SelectQuestion<Value>);

/** The questions of an add-on, described by the values they produce. See `defineAddonOptions<Values>()`. */
// `infer … extends` re-states the constraint TS can't verify through the mapped type.
export type AddonOptions<Values extends Record<string, unknown>> = {
	[K in keyof Values]: QuestionFor<Values[K]>;
} extends infer Questions extends OptionDefinition
	? Questions
	: never;

type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Keys whose question is missing, extra, or produces a different value than declared. */
export type MismatchedOptions<Args extends OptionDefinition, Values> = {
	[K in keyof Args | keyof Values]: K extends keyof Args
		? K extends keyof Values
			? SameType<OptionValues<Args>[K], Values[K]> extends true
				? never
				: K
			: K
		: K;
}[keyof Args | keyof Values];

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
						: Args[K] extends Question<any>
							? unknown
							: 'ERROR: The value for this type is invalid. Ensure that the `default` value exists in `options`.';
};
