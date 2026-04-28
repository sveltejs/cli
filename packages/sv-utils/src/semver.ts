import semverMinVersion from 'semver/ranges/min-version.js';

type Version = {
	major?: number;
	minor?: number;
	patch?: number;
};

/**
 * Returns the lowest version that satisfies the given range, e.g.
 * `^9.0.0` -> `9.0.0`, `~1.2.3` -> `1.2.3`, `workspace:^5.4.3` -> `5.4.3`.
 * Throws on unparseable inputs like `latest` or `workspace:*`.
 */
export function minVersion(range: string): string {
	const cleaned = range.replace(/^workspace:/, '');
	if (cleaned === '*' || cleaned === '') {
		throw new Error(`Cannot determine min version from range: ${range}`);
	}
	const min = semverMinVersion(cleaned);
	if (!min) throw new Error(`Cannot determine min version from range: ${range}`);
	return min.version;
}

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
