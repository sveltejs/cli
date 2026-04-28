import semverCoerce from 'semver/functions/coerce.js';
import semverLt from 'semver/functions/lt.js';
import semverMinVersion from 'semver/ranges/min-version.js';

type Version = {
	major?: number;
	minor?: number;
	patch?: number;
	/** The clean `major.minor.patch` string. Only populated by `coerceVersion`. */
	version?: string;
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

/**
 * @deprecated Use `coerceVersion` instead.
 */
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

/**
 * Parses a version-ish string into `{ major, minor, patch, version }` using `semver.coerce`.
 * `version` is the clean `major.minor.patch` string (e.g. `"9.0.0"` for `^9.0.0`).
 * Understands ranges (`^9.0.0`), partial versions (`18.13`), and `workspace:` prefixes.
 * Returns all-undefined for unparseable input.
 */
export function coerceVersion(str: string): Version {
	const c = semverCoerce(str);
	if (!c) return { major: undefined, minor: undefined, patch: undefined, version: undefined };
	return { major: c.major, minor: c.minor, patch: c.patch, version: c.version };
}

export function isVersionUnsupportedBelow(
	versionStr: string,
	belowStr: string
): boolean | undefined {
	const version = semverCoerce(versionStr);
	const below = semverCoerce(belowStr);
	if (!version || !below) return undefined;
	return semverLt(version, below);
}
