import readline, { type Key, type ReadLine } from 'node:readline';
import process, { stdin, stdout } from 'node:process';
import { WriteStream } from 'node:tty';
import type { Readable, Writable } from 'node:stream';
import { cursor, erase } from 'sisteransi';
import wrap from 'wrap-ansi';

function diffLines(a: string, b: string) {
	if (a === b) return;

	const aLines = a.split('\n');
	const bLines = b.split('\n');
	const diff: number[] = [];

	for (let i = 0; i < Math.max(aLines.length, bLines.length); i++) {
		if (aLines[i] !== bLines[i]) diff.push(i);
	}

	return diff;
}

const cancel = Symbol('clack:cancel');
export function isCancel(value: unknown): value is symbol {
	return value === cancel;
}

function setRawMode(input: Readable, value: boolean) {
	if ((input as typeof stdin).isTTY) (input as typeof stdin).setRawMode(value);
}

const aliases = new Map([
	['k', 'up'],
	['j', 'down'],
	['h', 'left'],
	['l', 'right']
]);
const keys = new Set(['up', 'down', 'left', 'right', 'space', 'enter']);

export interface PromptOptions<Self extends Prompt> {
	render(this: Omit<Self, 'prompt'>): string | void;
	placeholder?: string;
	initialValue?: any;
	validate?: ((value: any) => string | void) | undefined;
	input?: Readable;
	output?: Writable;
	debug?: boolean;
}

export type State = 'initial' | 'active' | 'cancel' | 'submit' | 'error';

export default class Prompt {
	protected input: Readable;
	protected output: Writable;
	private rl!: ReadLine;
	private opts: Omit<PromptOptions<Prompt>, 'render' | 'input' | 'output'>;
	private _track: boolean = false;
	private _render: (context: Omit<Prompt, 'prompt'>) => string | void;
	protected _cursor: number = 0;

	public state: State = 'initial';
	public value: any;
	public error: string = '';

	constructor(
		{ render, input = stdin, output = stdout, ...opts }: PromptOptions<Prompt>,
		trackValue: boolean = true
	) {
		this.opts = opts;
		this.onKeypress = this.onKeypress.bind(this);
		this.close = this.close.bind(this);
		this.render = this.render.bind(this);
		this._render = render.bind(this);
		this._track = trackValue;

		this.input = input;
		this.output = output;
	}

	public prompt(): Promise<string | symbol> {
		const sink = new WriteStream(0);
		sink._write = (chunk, encoding, done) => {
			if (this._track) {
				this.value = this.rl.line.replace(/\t/g, '');
				this._cursor = this.rl.cursor;
				this.emit('value', this.value);
			}
			done();
		};
		this.input.pipe(sink);

		this.rl = readline.createInterface({
			input: this.input,
			output: sink,
			tabSize: 2,
			prompt: '',
			escapeCodeTimeout: 50
		});
		readline.emitKeypressEvents(this.input, this.rl);
		this.rl.prompt();
		if (this.opts.initialValue !== undefined && this._track) {
			this.rl.write(this.opts.initialValue);
		}

		this.input.on('keypress', this.onKeypress);
		setRawMode(this.input, true);
		this.output.on('resize', this.render);

		this.render();

		return new Promise<string | symbol>((resolve) => {
			this.once('submit', () => {
				this.output.write(cursor.show);
				this.output.off('resize', this.render);
				setRawMode(this.input, false);
				resolve(this.value);
			});
			this.once('cancel', () => {
				this.output.write(cursor.show);
				this.output.off('resize', this.render);
				setRawMode(this.input, false);
				resolve(cancel);
			});
		});
	}

	private subscribers = new Map<string, Array<{ cb: (...args: any) => any; once?: boolean }>>();
	public on(event: string, cb: (...args: any) => any): void {
		const arr = this.subscribers.get(event) ?? [];
		arr.push({ cb });
		this.subscribers.set(event, arr);
	}
	public once(event: string, cb: (...args: any) => any): void {
		const arr = this.subscribers.get(event) ?? [];
		arr.push({ cb, once: true });
		this.subscribers.set(event, arr);
	}
	public emit(event: string, ...data: any[]): void {
		const cbs = this.subscribers.get(event) ?? [];
		const cleanup: Array<() => void> = [];
		for (const subscriber of cbs) {
			subscriber.cb(...data);
			if (subscriber.once) {
				cleanup.push(() => cbs.splice(cbs.indexOf(subscriber), 1));
			}
		}
		for (const cb of cleanup) {
			cb();
		}
	}
	private unsubscribe() {
		this.subscribers.clear();
	}

	private onKeypress(char: string, key?: Key) {
		if (this.state === 'error') {
			this.state = 'active';
		}
		if (key?.name && !this._track && aliases.has(key.name)) {
			this.emit('cursor', aliases.get(key.name));
		}
		if (key?.name && keys.has(key.name)) {
			this.emit('cursor', key.name);
		}
		if (char && (char.toLowerCase() === 'y' || char.toLowerCase() === 'n')) {
			this.emit('confirm', char.toLowerCase() === 'y');
		}
		if (char === '\t' && this.opts.placeholder) {
			if (!this.value) {
				this.rl.write(this.opts.placeholder);
				this.emit('value', this.opts.placeholder);
			}
		}
		if (char) {
			this.emit('key', char.toLowerCase());
		}

		if (key?.name === 'return') {
			if (this.opts.validate) {
				const problem = this.opts.validate(this.value);
				if (problem) {
					this.error = problem;
					this.state = 'error';
					this.rl.write(this.value);
				}
			}
			if (this.state !== 'error') {
				this.state = 'submit';
			}
		}
		if (char === '\x03') {
			this.state = 'cancel';
		}
		if (this.state === 'submit' || this.state === 'cancel') {
			this.emit('finalize');
		}
		this.render();
		if (this.state === 'submit' || this.state === 'cancel') {
			this.close();
		}
	}

	protected close(): void {
		this.input.unpipe();
		this.input.removeListener('keypress', this.onKeypress);
		this.output.write('\n');
		setRawMode(this.input, false);
		this.rl.close();
		this.emit(this.state, this.value);
		this.unsubscribe();
	}

	private restoreCursor() {
		const lines =
			wrap(this._prevFrame, process.stdout.columns, { hard: true }).split('\n').length - 1;
		this.output.write(cursor.move(-999, lines * -1));
	}

	private _prevFrame = '';
	private render() {
		const frame = wrap(this._render(this) ?? '', process.stdout.columns, { hard: true });
		if (frame === this._prevFrame) return;

		if (this.state === 'initial') {
			this.output.write(cursor.hide);
		}

		const diff = diffLines(this._prevFrame, frame);
		this.restoreCursor();
		if (diff) {
			const diffLine = diff[0]!;
			const lines = frame.split('\n');
			let newLines: string[] = [];

			// If we don't have enough vertical space to print all of the lines simultaneously,
			// then we'll sticky the prompt message (first 3 lines) to the top so it's always shown.
			// We'll then take the remaining space and render a snippet of the list that's relative
			// to the currently selected option
			if (lines.length > process.stdout.rows) {
				const OFFSET = 3;
				const PAGE_SIZE = process.stdout.rows - OFFSET;

				// @ts-expect-error `cursor` is a property that's implemented by prompts extending this class.
				const pos: number = this.cursor;

				// page positions
				const start = pos <= OFFSET ? OFFSET : pos;
				const end = start + PAGE_SIZE;

				this.output.write(erase.down());

				// stickied headers
				const header = lines.slice(0, OFFSET);
				const content = lines.slice(start, end);
				newLines = newLines.concat(header, content);
			} else {
				this.output.write(cursor.move(0, diffLine));
				this.output.write(erase.down());

				newLines = lines.slice(diffLine);
			}

			this.output.write(newLines.join('\n'));
			this._prevFrame = frame;
			return;
		}

		this.output.write(frame);
		if (this.state === 'initial') {
			this.state = 'active';
		}
		this._prevFrame = frame;
	}
}
