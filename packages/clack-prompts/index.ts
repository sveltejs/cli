import {
	block,
	ConfirmPrompt,
	GroupMultiSelectPrompt,
	isCancel,
	MultiSelectPrompt,
	PasswordPrompt,
	SelectKeyPrompt,
	SelectPrompt,
	type State,
	TextPrompt
} from '@svelte-cli/clack-core';
import isUnicodeSupported from 'is-unicode-supported';
import pc from 'picocolors';
import { cursor, erase } from 'sisteransi';

export { isCancel } from '@svelte-cli/clack-core';

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_STEP_ACTIVE = s('◆', '*');
const S_STEP_CANCEL = s('■', 'x');
const S_STEP_ERROR = s('▲', 'x');
const S_STEP_SUBMIT = s('◇', 'o');

const S_BAR_START = s('┌', 'T');
const S_BAR = s('│', '|');
const S_BAR_END = s('└', '—');

const S_RADIO_ACTIVE = s('●', '>');
const S_RADIO_INACTIVE = s('○', ' ');
const S_CHECKBOX_ACTIVE = s('◻', '[•]');
const S_CHECKBOX_SELECTED = s('◼', '[+]');
const S_CHECKBOX_INACTIVE = s('◻', '[ ]');
const S_PASSWORD_MASK = s('▪', '•');

const S_BAR_H = s('─', '-');
const S_CORNER_TOP_RIGHT = s('╮', '+');
const S_CONNECT_LEFT = s('├', '+');
const S_CORNER_BOTTOM_RIGHT = s('╯', '+');

const S_INFO = s('●', '•');
const S_SUCCESS = s('◆', '*');
const S_WARN = s('▲', '!');
const S_ERROR = s('■', 'x');

const symbol = (state: State) => {
	switch (state) {
		case 'initial':
		case 'active':
			return pc.cyan(S_STEP_ACTIVE);
		case 'cancel':
			return pc.red(S_STEP_CANCEL);
		case 'error':
			return pc.yellow(S_STEP_ERROR);
		case 'submit':
			return pc.green(S_STEP_SUBMIT);
	}
};

interface LimitOptionsParams<TOption> {
	options: TOption[];
	maxItems: number | undefined;
	cursor: number;
	style: (option: TOption, active: boolean) => string;
}

const limitOptions = <TOption>(params: LimitOptionsParams<TOption>): string[] => {
	const { cursor, options, style } = params;

	const paramMaxItems = params.maxItems ?? Infinity;
	const outputMaxItems = Math.max(process.stdout.rows - 4, 0);
	// We clamp to minimum 5 because anything less doesn't make sense UX wise
	const maxItems = Math.min(outputMaxItems, Math.max(paramMaxItems, 5));
	let slidingWindowLocation = 0;

	if (cursor >= slidingWindowLocation + maxItems - 3) {
		slidingWindowLocation = Math.max(Math.min(cursor - maxItems + 3, options.length - maxItems), 0);
	} else if (cursor < slidingWindowLocation + 2) {
		slidingWindowLocation = Math.max(cursor - 2, 0);
	}

	const shouldRenderTopEllipsis = maxItems < options.length && slidingWindowLocation > 0;
	const shouldRenderBottomEllipsis =
		maxItems < options.length && slidingWindowLocation + maxItems < options.length;

	return options
		.slice(slidingWindowLocation, slidingWindowLocation + maxItems)
		.map((option, i, arr) => {
			const isTopLimit = i === 0 && shouldRenderTopEllipsis;
			const isBottomLimit = i === arr.length - 1 && shouldRenderBottomEllipsis;
			return isTopLimit || isBottomLimit
				? pc.dim('...')
				: style(option, i + slidingWindowLocation === cursor);
		});
};

export interface TextOptions {
	message: string;
	placeholder?: string;
	defaultValue?: string;
	initialValue?: string;
	validate?: (value: string) => string | void;
}
export const text = (opts: TextOptions): Promise<string | symbol> => {
	return new TextPrompt({
		validate: opts.validate,
		placeholder: opts.placeholder,
		defaultValue: opts.defaultValue,
		initialValue: opts.initialValue,
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const placeholder = opts.placeholder
				? pc.inverse(opts.placeholder[0]) + pc.dim(opts.placeholder.slice(1))
				: pc.inverse(pc.hidden('_'));
			const value = !this.value ? placeholder : this.valueWithCursor;

			switch (this.state) {
				case 'error':
					return `${title.trim()}\n${pc.yellow(S_BAR)}  ${value}\n${pc.yellow(
						S_BAR_END
					)}  ${pc.yellow(this.error)}\n`;
				case 'submit':
					return `${title}${pc.gray(S_BAR)}  ${pc.dim(this.value || opts.placeholder)}`;
				case 'cancel':
					return `${title}${pc.gray(S_BAR)}  ${pc.strikethrough(
						pc.dim(this.value ?? '')
					)}${this.value?.trim() ? '\n' + pc.gray(S_BAR) : ''}`;
				default:
					return `${title}${pc.cyan(S_BAR)}  ${value}\n${pc.cyan(S_BAR_END)}\n`;
			}
		}
	}).prompt();
};

export interface PasswordOptions {
	message: string;
	mask?: string;
	validate?: (value: string) => string | void;
}
export const password = (opts: PasswordOptions): Promise<string | symbol> => {
	return new PasswordPrompt({
		validate: opts.validate,
		mask: opts.mask ?? S_PASSWORD_MASK,
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const value = this.valueWithCursor;
			const masked = this.masked;

			switch (this.state) {
				case 'error':
					return `${title.trim()}\n${pc.yellow(S_BAR)}  ${masked}\n${pc.yellow(
						S_BAR_END
					)}  ${pc.yellow(this.error)}\n`;
				case 'submit':
					return `${title}${pc.gray(S_BAR)}  ${pc.dim(masked)}`;
				case 'cancel':
					return `${title}${pc.gray(S_BAR)}  ${pc.strikethrough(pc.dim(masked ?? ''))}${
						masked ? '\n' + pc.gray(S_BAR) : ''
					}`;
				default:
					return `${title}${pc.cyan(S_BAR)}  ${value}\n${pc.cyan(S_BAR_END)}\n`;
			}
		}
	}).prompt();
};

export interface ConfirmOptions {
	message: string;
	active?: string;
	inactive?: string;
	initialValue?: boolean;
}
export const confirm = (opts: ConfirmOptions) => {
	const active = opts.active ?? 'Yes';
	const inactive = opts.inactive ?? 'No';
	return new ConfirmPrompt({
		active,
		inactive,
		initialValue: opts.initialValue ?? true,
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const value = this.value ? active : inactive;

			switch (this.state) {
				case 'submit':
					return `${title}${pc.gray(S_BAR)}  ${pc.dim(value)}`;
				case 'cancel':
					return `${title}${pc.gray(S_BAR)}  ${pc.strikethrough(pc.dim(value))}\n${pc.gray(S_BAR)}`;
				default: {
					return `${title}${pc.cyan(S_BAR)}  ${
						this.value
							? `${pc.green(S_RADIO_ACTIVE)} ${active}`
							: `${pc.dim(S_RADIO_INACTIVE)} ${pc.dim(active)}`
					} ${pc.dim('/')} ${
						!this.value
							? `${pc.green(S_RADIO_ACTIVE)} ${inactive}`
							: `${pc.dim(S_RADIO_INACTIVE)} ${pc.dim(inactive)}`
					}\n${pc.cyan(S_BAR_END)}\n`;
				}
			}
		}
	}).prompt() as Promise<boolean | symbol>;
};

type Primitive = Readonly<string | boolean | number>;

type Option<Value> = Value extends Primitive
	? { value: Value; label?: string; hint?: string }
	: { value: Value; label: string; hint?: string };

export interface SelectOptions<Value> {
	message: string;
	options: Array<Option<Value>>;
	initialValue?: Value;
	maxItems?: number;
}

export const select = <Value>(opts: SelectOptions<Value>) => {
	const opt = (option: Option<Value>, state: 'inactive' | 'active' | 'selected' | 'cancelled') => {
		const label = option.label ?? String(option.value);
		switch (state) {
			case 'selected':
				return pc.dim(label);
			case 'active':
				return `${pc.green(S_RADIO_ACTIVE)} ${label} ${
					option.hint ? pc.dim(`(${option.hint})`) : ''
				}`;
			case 'cancelled':
				return pc.strikethrough(pc.dim(label));
			default:
				return `${pc.dim(S_RADIO_INACTIVE)} ${pc.dim(label)}`;
		}
	};

	return new SelectPrompt({
		options: opts.options,
		initialValue: opts.initialValue,
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			switch (this.state) {
				case 'submit':
					return `${title}${pc.gray(S_BAR)}  ${opt(this.options[this.cursor], 'selected')}`;
				case 'cancel':
					return `${title}${pc.gray(S_BAR)}  ${opt(
						this.options[this.cursor],
						'cancelled'
					)}\n${pc.gray(S_BAR)}`;
				default: {
					return `${title}${pc.cyan(S_BAR)}  ${limitOptions({
						cursor: this.cursor,
						options: this.options,
						maxItems: opts.maxItems,
						style: (item, active) => opt(item, active ? 'active' : 'inactive')
					}).join(`\n${pc.cyan(S_BAR)}  `)}\n${pc.cyan(S_BAR_END)}\n`;
				}
			}
		}
	}).prompt() as Promise<Value | symbol>;
};

export const selectKey = <Value extends string>(opts: SelectOptions<Value>) => {
	const opt = (
		option: Option<Value>,
		state: 'inactive' | 'active' | 'selected' | 'cancelled' = 'inactive'
	) => {
		const label = option.label ?? String(option.value);
		if (state === 'selected') {
			return pc.dim(label);
		} else if (state === 'cancelled') {
			return pc.strikethrough(pc.dim(label));
		} else if (state === 'active') {
			return `${pc.bgCyan(pc.gray(` ${option.value} `))} ${label} ${
				option.hint ? pc.dim(`(${option.hint})`) : ''
			}`;
		}
		return `${pc.gray(pc.bgWhite(pc.inverse(` ${option.value} `)))} ${label} ${
			option.hint ? pc.dim(`(${option.hint})`) : ''
		}`;
	};

	return new SelectKeyPrompt({
		options: opts.options,
		initialValue: opts.initialValue,
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			switch (this.state) {
				case 'submit':
					return `${title}${pc.gray(S_BAR)}  ${opt(
						this.options.find((opt) => opt.value === this.value)!,
						'selected'
					)}`;
				case 'cancel':
					return `${title}${pc.gray(S_BAR)}  ${opt(this.options[0], 'cancelled')}\n${pc.gray(
						S_BAR
					)}`;
				default: {
					return `${title}${pc.cyan(S_BAR)}  ${this.options
						.map((option, i) => opt(option, i === this.cursor ? 'active' : 'inactive'))
						.join(`\n${pc.cyan(S_BAR)}  `)}\n${pc.cyan(S_BAR_END)}\n`;
				}
			}
		}
	}).prompt() as Promise<Value | symbol>;
};

export interface MultiSelectOptions<Value> {
	message: string;
	options: Array<Option<Value>>;
	initialValues?: Value[];
	maxItems?: number;
	required?: boolean;
	cursorAt?: Value;
}
export const multiselect = <Value>(opts: MultiSelectOptions<Value>) => {
	const opt = (
		option: Option<Value>,
		state: 'inactive' | 'active' | 'selected' | 'active-selected' | 'submitted' | 'cancelled'
	) => {
		const label = option.label ?? String(option.value);
		if (state === 'active') {
			return `${pc.cyan(S_CHECKBOX_ACTIVE)} ${label} ${
				option.hint ? pc.dim(`(${option.hint})`) : ''
			}`;
		} else if (state === 'selected') {
			return `${pc.green(S_CHECKBOX_SELECTED)} ${pc.dim(label)}`;
		} else if (state === 'cancelled') {
			return pc.strikethrough(pc.dim(label));
		} else if (state === 'active-selected') {
			return `${pc.green(S_CHECKBOX_SELECTED)} ${label} ${
				option.hint ? pc.dim(`(${option.hint})`) : ''
			}`;
		} else if (state === 'submitted') {
			return pc.dim(label);
		}
		return `${pc.dim(S_CHECKBOX_INACTIVE)} ${pc.dim(label)}`;
	};

	return new MultiSelectPrompt({
		options: opts.options,
		initialValues: opts.initialValues,
		required: opts.required ?? true,
		cursorAt: opts.cursorAt,
		validate(selected: Value[]) {
			if (this.required && selected.length === 0)
				return `Please select at least one option.\n${pc.reset(
					pc.dim(
						`Press ${pc.gray(pc.bgWhite(pc.inverse(' space ')))} to select, ${pc.gray(
							pc.bgWhite(pc.inverse(' enter '))
						)} to submit`
					)
				)}`;
		},
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			const styleOption = (option: Option<Value>, active: boolean) => {
				const selected = this.value.includes(option.value);
				if (active && selected) {
					return opt(option, 'active-selected');
				}
				if (selected) {
					return opt(option, 'selected');
				}
				return opt(option, active ? 'active' : 'inactive');
			};

			switch (this.state) {
				case 'submit': {
					return `${title}${pc.gray(S_BAR)}  ${
						this.options
							.filter(({ value }) => this.value.includes(value))
							.map((option) => opt(option, 'submitted'))
							.join(pc.dim(', ')) || pc.dim('none')
					}`;
				}
				case 'cancel': {
					const label = this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => opt(option, 'cancelled'))
						.join(pc.dim(', '));
					return `${title}${pc.gray(S_BAR)}  ${label.trim() ? `${label}\n${pc.gray(S_BAR)}` : ''}`;
				}
				case 'error': {
					const footer = this.error
						.split('\n')
						.map((ln, i) => (i === 0 ? `${pc.yellow(S_BAR_END)}  ${pc.yellow(ln)}` : `   ${ln}`))
						.join('\n');
					return (
						title +
						pc.yellow(S_BAR) +
						'  ' +
						limitOptions({
							options: this.options,
							cursor: this.cursor,
							maxItems: opts.maxItems,
							style: styleOption
						}).join(`\n${pc.yellow(S_BAR)}  `) +
						'\n' +
						footer +
						'\n'
					);
				}
				default: {
					return `${title}${pc.cyan(S_BAR)}  ${limitOptions({
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						style: styleOption
					}).join(`\n${pc.cyan(S_BAR)}  `)}\n${pc.cyan(S_BAR_END)}\n`;
				}
			}
		}
	}).prompt() as Promise<Value[] | symbol>;
};

export interface GroupMultiSelectOptions<Value> {
	message: string;
	options: Record<string, Array<Option<Value>>>;
	initialValues?: Value[];
	required?: boolean;
	cursorAt?: Value;
	selectableGroups?: boolean;
	spacedGroups?: boolean;
}

export const groupMultiselect = <Value>(opts: GroupMultiSelectOptions<Value>) => {
	const { selectableGroups = false, spacedGroups = false } = opts;
	const opt = (
		option: Option<Value>,
		state:
			| 'inactive'
			| 'active'
			| 'selected'
			| 'active-selected'
			| 'group-active'
			| 'group-active-selected'
			| 'submitted'
			| 'cancelled',
		options: Array<Option<Value>> = []
	) => {
		const label = option.label ?? String(option.value);
		const isItem = typeof (option as any).group === 'string';
		const next = isItem && (options[options.indexOf(option) + 1] ?? { group: true });
		// @ts-ignore
		const isLast = isItem && next.group === true;
		const prefix = isItem ? (selectableGroups ? `${isLast ? S_BAR_END : S_BAR} ` : ' ') : '';
		const spacingPrefix = spacedGroups && !isItem ? `\n${pc.cyan(S_BAR)}  ` : '';

		if (state === 'active') {
			return `${spacingPrefix}${pc.dim(prefix)}${pc.cyan(S_CHECKBOX_ACTIVE)} ${label} ${
				option.hint ? pc.dim(`(${option.hint})`) : ''
			}`;
		} else if (state === 'group-active') {
			return `${spacingPrefix}${prefix}${pc.cyan(S_CHECKBOX_ACTIVE)} ${pc.dim(label)}`;
		} else if (state === 'group-active-selected') {
			return `${spacingPrefix}${prefix}${pc.green(S_CHECKBOX_SELECTED)} ${pc.dim(label)}`;
		} else if (state === 'selected') {
			return `${spacingPrefix}${pc.dim(prefix)}${pc.green(S_CHECKBOX_SELECTED)} ${pc.dim(label)}`;
		} else if (state === 'cancelled') {
			return pc.strikethrough(pc.dim(label));
		} else if (state === 'active-selected') {
			return `${spacingPrefix}${pc.dim(prefix)}${pc.green(S_CHECKBOX_SELECTED)} ${label} ${
				option.hint ? pc.dim(`(${option.hint})`) : ''
			}`;
		} else if (state === 'submitted') {
			return pc.dim(label);
		}
		return `${spacingPrefix}${pc.dim(prefix)}${
			isItem || selectableGroups ? `${pc.dim(S_CHECKBOX_INACTIVE)} ` : ''
		}${pc.dim(label)}`;
	};

	return new GroupMultiSelectPrompt({
		options: opts.options,
		initialValues: opts.initialValues,
		required: opts.required ?? true,
		cursorAt: opts.cursorAt,
		selectableGroups,
		validate(selected: Value[]) {
			if (this.required && selected.length === 0)
				return `Please select at least one option.\n${pc.reset(
					pc.dim(
						`Press ${pc.gray(pc.bgWhite(pc.inverse(' space ')))} to select, ${pc.gray(
							pc.bgWhite(pc.inverse(' enter '))
						)} to submit`
					)
				)}`;
		},
		render() {
			const title = `${pc.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			switch (this.state) {
				case 'submit': {
					return `${title}${pc.gray(S_BAR)}  ${this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => opt(option, 'submitted'))
						.join(pc.dim(', '))}`;
				}
				case 'cancel': {
					const label = this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => opt(option, 'cancelled'))
						.join(pc.dim(', '));
					return `${title}${pc.gray(S_BAR)}  ${label.trim() ? `${label}\n${pc.gray(S_BAR)}` : ''}`;
				}
				case 'error': {
					const footer = this.error
						.split('\n')
						.map((ln, i) => (i === 0 ? `${pc.yellow(S_BAR_END)}  ${pc.yellow(ln)}` : `   ${ln}`))
						.join('\n');
					return `${title}${pc.yellow(S_BAR)}  ${this.options
						.map((option, i, options) => {
							const selected =
								this.value.includes(option.value) ||
								(option.group === true && this.isGroupSelected(`${option.value}`));
							const active = i === this.cursor;
							const groupActive =
								!active &&
								typeof option.group === 'string' &&
								this.options[this.cursor].value === option.group;
							if (groupActive) {
								return opt(option, selected ? 'group-active-selected' : 'group-active', options);
							}
							if (active && selected) {
								return opt(option, 'active-selected', options);
							}
							if (selected) {
								return opt(option, 'selected', options);
							}
							return opt(option, active ? 'active' : 'inactive', options);
						})
						.join(`\n${pc.yellow(S_BAR)}  `)}\n${footer}\n`;
				}
				default: {
					return `${title}${pc.cyan(S_BAR)}  ${this.options
						.map((option, i, options) => {
							const selected =
								this.value.includes(option.value) ||
								(option.group === true && this.isGroupSelected(`${option.value}`));
							const active = i === this.cursor;
							const groupActive =
								!active &&
								typeof option.group === 'string' &&
								this.options[this.cursor].value === option.group;
							if (groupActive) {
								return opt(option, selected ? 'group-active-selected' : 'group-active', options);
							}
							if (active && selected) {
								return opt(option, 'active-selected', options);
							}
							if (selected) {
								return opt(option, 'selected', options);
							}
							return opt(option, active ? 'active' : 'inactive', options);
						})
						.join(`\n${pc.cyan(S_BAR)}  `)}\n${pc.cyan(S_BAR_END)}\n`;
				}
			}
		}
	}).prompt() as Promise<Value[] | symbol>;
};

const strip = (str: string) => str.replace(ansiRegex(), '');
export const note = (message = '', title = ''): void => {
	const lines = `\n${message}\n`.split('\n');
	const titleLen = strip(title).length;
	const len =
		Math.max(
			lines.reduce((sum, ln) => {
				ln = strip(ln);
				return ln.length > sum ? ln.length : sum;
			}, 0),
			titleLen
		) + 2;
	const msg = lines
		.map(
			(ln) =>
				`${pc.gray(S_BAR)}  ${pc.dim(ln)}${' '.repeat(len - strip(ln).length)}${pc.gray(S_BAR)}`
		)
		.join('\n');
	process.stdout.write(
		`${pc.gray(S_BAR)}\n${pc.green(S_STEP_SUBMIT)}  ${pc.reset(title)} ${pc.gray(
			S_BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT
		)}\n${msg}\n${pc.gray(S_CONNECT_LEFT + S_BAR_H.repeat(len + 2) + S_CORNER_BOTTOM_RIGHT)}\n`
	);
};

export const cancel = (message = ''): void => {
	process.stdout.write(`${pc.gray(S_BAR_END)}  ${pc.red(message)}\n\n`);
};

export const intro = (title = ''): void => {
	process.stdout.write(`${pc.gray(S_BAR_START)}  ${title}\n`);
};

export const outro = (message = ''): void => {
	process.stdout.write(`${pc.gray(S_BAR)}\n${pc.gray(S_BAR_END)}  ${message}\n\n`);
};

export type LogMessageOptions = {
	symbol?: string;
};
export const log = {
	message: (message = '', { symbol = pc.gray(S_BAR) }: LogMessageOptions = {}): void => {
		const parts = [pc.gray(S_BAR)];
		if (message) {
			const [firstLine, ...lines] = message.split('\n');
			parts.push(`${symbol}  ${firstLine}`, ...lines.map((ln) => `${pc.gray(S_BAR)}  ${ln}`));
		}
		process.stdout.write(`${parts.join('\n')}\n`);
	},
	info: (message: string): void => {
		log.message(message, { symbol: pc.blue(S_INFO) });
	},
	success: (message: string): void => {
		log.message(message, { symbol: pc.green(S_SUCCESS) });
	},
	step: (message: string): void => {
		log.message(message, { symbol: pc.green(S_STEP_SUBMIT) });
	},
	warn: (message: string): void => {
		log.message(message, { symbol: pc.yellow(S_WARN) });
	},
	/** alias for `log.warn()`. */
	warning: (message: string): void => {
		log.warn(message);
	},
	error: (message: string): void => {
		log.message(message, { symbol: pc.red(S_ERROR) });
	}
};

export const spinner = (): {
	start: (msg?: string) => void;
	stop: (msg?: string, code?: number) => void;
	message: (msg?: string) => void;
} => {
	const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0'];
	const delay = unicode ? 80 : 120;

	let unblock: () => void;
	let loop: NodeJS.Timeout;
	let isSpinnerActive: boolean = false;
	let _message: string = '';

	const handleExit = (code: number) => {
		const msg = code > 1 ? 'Something went wrong' : 'Canceled';
		if (isSpinnerActive) stop(msg, code);
	};

	const errorEventHandler = () => {
		handleExit(2);
	};
	const signalEventHandler = () => {
		handleExit(1);
	};

	const registerHooks = () => {
		// Reference: https://nodejs.org/api/process.html#event-uncaughtexception
		process.on('uncaughtExceptionMonitor', errorEventHandler);
		// Reference: https://nodejs.org/api/process.html#event-unhandledrejection
		process.on('unhandledRejection', errorEventHandler);
		// Reference Signal Events: https://nodejs.org/api/process.html#signal-events
		process.on('SIGINT', signalEventHandler);
		process.on('SIGTERM', signalEventHandler);
		process.on('exit', handleExit);
	};

	const clearHooks = () => {
		process.removeListener('uncaughtExceptionMonitor', errorEventHandler);
		process.removeListener('unhandledRejection', errorEventHandler);
		process.removeListener('SIGINT', signalEventHandler);
		process.removeListener('SIGTERM', signalEventHandler);
		process.removeListener('exit', handleExit);
	};

	const start = (msg: string = ''): void => {
		isSpinnerActive = true;
		unblock = block();
		_message = msg.replace(/\.+$/, '');
		process.stdout.write(`${pc.gray(S_BAR)}\n`);
		let frameIndex = 0;
		let dotsTimer = 0;
		registerHooks();
		loop = setInterval(() => {
			const frame = pc.magenta(frames[frameIndex]);
			const loadingDots = '.'.repeat(Math.floor(dotsTimer)).slice(0, 3);
			process.stdout.write(cursor.move(-999, 0));
			process.stdout.write(erase.down(1));
			process.stdout.write(`${frame}  ${_message}${loadingDots}`);
			frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
			dotsTimer = dotsTimer < frames.length ? dotsTimer + 0.125 : 0;
		}, delay);
	};

	const stop = (msg: string = '', code: number = 0): void => {
		_message = msg ?? _message;
		isSpinnerActive = false;
		clearInterval(loop);
		const step =
			code === 0
				? pc.green(S_STEP_SUBMIT)
				: code === 1
					? pc.red(S_STEP_CANCEL)
					: pc.red(S_STEP_ERROR);
		process.stdout.write(cursor.move(-999, 0));
		process.stdout.write(erase.down(1));
		process.stdout.write(`${step}  ${_message}\n`);
		clearHooks();
		unblock();
	};

	const message = (msg: string = ''): void => {
		_message = msg ?? _message;
	};

	return {
		start,
		stop,
		message
	};
};

// Adapted from https://github.com/chalk/ansi-regex
// @see LICENSE
function ansiRegex() {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
	].join('|');

	return new RegExp(pattern, 'g');
}

export type PromptGroupAwaitedReturn<T> = {
	[P in keyof T]: Exclude<Awaited<T[P]>, symbol>;
};

export interface PromptGroupOptions<T> {
	/**
	 * Control how the group can be canceled
	 * if one of the prompts is canceled.
	 */
	onCancel?: (opts: { results: Prettify<Partial<PromptGroupAwaitedReturn<T>>> }) => void;
}

type Prettify<T> = {
	[P in keyof T]: T[P];
} & {};

export type PromptGroup<T> = {
	[P in keyof T]: (opts: {
		results: Prettify<Partial<PromptGroupAwaitedReturn<Omit<T, P>>>>;
	}) => void | Promise<T[P] | void>;
};

/**
 * Define a group of prompts to be displayed
 * and return a results of objects within the group
 */
export const group = async <T>(
	prompts: PromptGroup<T>,
	opts?: PromptGroupOptions<T>
): Promise<Prettify<PromptGroupAwaitedReturn<T>>> => {
	const results = {} as any;
	const promptNames = Object.keys(prompts);

	for (const name of promptNames) {
		const prompt = prompts[name as keyof T];
		const result = await prompt({ results })?.catch((e) => {
			throw e;
		});

		// Pass the results to the onCancel function
		// so the user can decide what to do with the results
		// TODO: Switch to callback within core to avoid isCancel Fn
		if (typeof opts?.onCancel === 'function' && isCancel(result)) {
			results[name] = 'canceled';
			opts.onCancel({ results });
			continue;
		}

		results[name] = result;
	}

	return results;
};

export type Task = {
	/**
	 * Task title
	 */
	title: string;
	/**
	 * Task function
	 */
	task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;

	/**
	 * If enabled === false the task will be skipped
	 */
	enabled?: boolean;
};

/**
 * Define a group of tasks to be executed
 */
export const tasks = async (tasks: Task[]): Promise<void> => {
	for (const task of tasks) {
		if (task.enabled === false) continue;

		const s = spinner();
		s.start(task.title);
		const result = await task.task(s.message);
		s.stop(result || task.title);
	}
};
