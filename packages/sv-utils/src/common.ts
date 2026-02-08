type Version = {
	major?: number;
	minor?: number;
	patch?: number;
};

export function splitVersion(str: string): Version {
	const [major, minor, patch] = str?.split('.') ?? [];

	function toVersionNumber(val: string | undefined): number | undefined {
		return val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
	}

	return {
		major: toVersionNumber(major),
		minor: toVersionNumber(minor),
		patch: toVersionNumber(patch)
	};
}

export function isVersionUnsupportedBelow(
	versionStr: string,
	belowStr: string
): boolean | undefined {
	const version = splitVersion(versionStr);
	const below = splitVersion(belowStr);

	if (version.major === undefined || below.major === undefined) return undefined;
	if (version.major < below.major) return true;
	if (version.major > below.major) return false;

	if (version.minor === undefined || below.minor === undefined) {
		if (version.major === below.major) return false;
		else return true;
	}
	if (version.minor < below.minor) return true;
	if (version.minor > below.minor) return false;

	if (version.patch === undefined || below.patch === undefined) {
		if (version.minor === below.minor) return false;
		else return true;
	}
	if (version.patch < below.patch) return true;
	if (version.patch > below.patch) return false;
	if (version.patch === below.patch) return false;

	return undefined;
}
