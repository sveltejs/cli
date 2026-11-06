import { coerce, findMinimumForRange, isLessThan, isRangeSubset, normalize } from 'verkit';

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
	const normalized = normalize(min);
	if (!normalized) throw new Error(`Cannot determine min version from range: ${range}`);
	return normalized;
}

/**
 * Parses a version-ish string into `{ major, minor, patch, version }` using verkit's `coerce`.
 * `version` is the clean `major.minor.patch` string (e.g. `"9.0.0"` for `^9.0.0`).
 * Understands ranges (`^9.0.0`), partial versions (`18.13`), and `workspace:` prefixes.
 * Returns all-undefined for unparseable input.
 */
export function coerceVersion(str: string): Version {
	const coerced = coerce(str);
	if (!coerced) return { major: undefined, minor: undefined, patch: undefined, version: undefined };
	const version = normalize(coerced) ?? undefined;
	return {
		major: coerced.major,
		minor: coerced.minor,
		patch: coerced.patch,
		version
	};
}

/**
 * Returns `true` when every version matching `subset` also matches `superset`,
 * e.g. `^9.2.0` is within `^9.0.0` but `^8.0.0` is not.
 * Unparseable inputs (`latest`, `workspace:*`, ...) return `false`.
 */
export function isRangeWithin(subset: string, superset: string): boolean {
	try {
		return isRangeSubset(subset, superset);
	} catch {
		return false;
	}
}

/**
 * @returns `true` when `version` is older than `below`,
 * Unparseable inputs (`latest`, `workspace:*`, ...) return `undefined`.
 */
export function isVersionUnsupportedBelow(version: string, below: string): boolean | undefined {
	// this function has an obtuse name, consider renaming to `isOlderThan` in the next major
	const version_c = coerce(version);
	const below_c = coerce(below);
	if (!version_c || !below_c) return undefined;
	return isLessThan(version_c, below_c);
}
