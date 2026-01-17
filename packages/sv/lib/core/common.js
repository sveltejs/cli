/**
 * @typedef {{
 *   major?: number;
 *   minor?: number;
 *   patch?: number;
 * }} Version
 */

/**
 * @param {string | undefined} str
 * @returns {Version}
 */
export function splitVersion(str) {
	const [major, minor, patch] = str?.split('.') ?? [];

	/**
	 * @param {string | undefined} val
	 * @returns {number | undefined}
	 */
	function toVersionNumber(val) {
		return val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
	}

	return {
		major: toVersionNumber(major),
		minor: toVersionNumber(minor),
		patch: toVersionNumber(patch)
	};
}

/**
 * @param {string | undefined} versionStr
 * @param {string} belowStr
 * @returns {boolean | undefined}
 */
export function isVersionUnsupportedBelow(versionStr, belowStr) {
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
