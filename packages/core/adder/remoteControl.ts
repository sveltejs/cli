let remoteControlled = false;

export type RemoteControlOptions = {
	workingDirectory: string;
	isTesting: boolean;
	adderOptions: Record<string, Record<string, unknown>>;
};

export function enable(): void {
	remoteControlled = true;
}

export function isRemoteControlled(): boolean {
	return remoteControlled;
}

export function disable(): void {
	remoteControlled = false;
}
