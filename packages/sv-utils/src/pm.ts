/**
 * Thin wrapper around [`package-manager-detector`](https://github.com/antfu/package-manager-detector).
 * Only the symbols re-exported from the package root are public — we keep this module small and
 * avoid exposing the full upstream surface.
 */
import {
	resolveCommand as _resolveCommand,
	type Agent,
	type Command
} from 'package-manager-detector';

export {
	AGENTS,
	type AgentName,
	COMMANDS,
	constructCommand,
	detect,
	resolveCommand
} from 'package-manager-detector';

export function resolveCommandArray(agent: Agent, command: Command, args: string[]): string[] {
	const cmd = _resolveCommand(agent, command, args)!;
	return [cmd.command, ...cmd.args];
}
