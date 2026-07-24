import { coerce, findMinimumForRange, isLess, tryParse } from 'verkit';

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
	const min = findMinimumForRange(cleaned);
	if (!min) throw new Error(`Cannot determine min version from range: ${range}`);
	return min.version;
}

/**
 * Parses a version-ish string into `{ major, minor, patch, version }` using verkit's `coerce`.
 * `version` is the clean `major.minor.patch` string (e.g. `"9.0.0"` for `^9.0.0`).
 * Understands ranges (`^9.0.0`), partial versions (`18.13`), and `workspace:` prefixes.
 * Returns all-undefined for unparseable input.
 */
export function coerceVersion(str: string): Version {
	const coerced = coerce(str);
	const c = coerced ? tryParse(coerced) : null;
	if (!c) return { major: undefined, minor: undefined, patch: undefined, version: undefined };
	return { major: c.major, minor: c.minor, patch: c.patch, version: coerced! };
}

export function isVersionUnsupportedBelow(
	versionStr: string,
	belowStr: string
): boolean | undefined {
	const version = coerce(versionStr);
	const below = coerce(belowStr);
	if (!version || !below) return undefined;
	return isLess(version, below);
}
