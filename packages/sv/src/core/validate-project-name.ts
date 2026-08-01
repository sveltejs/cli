// https://npmx.dev/package/validate-npm-package-name#user-content-naming-rules
export const validateProjectName = (value: string | undefined): string | undefined => {
	if (value === null) return 'Package name cannot be null';
	if (value === undefined) return 'Package name cannot be undefined';
	if (typeof value !== 'string') return 'Package name must be a string';
	if (!value) return 'Package name is required.';
	if (/\s/.test(value)) return 'Package name cannot contain spaces';
	if (value.startsWith('.')) return 'Package name cannot start with a period';
	if (value.startsWith('-')) return 'Package name cannot start with a hyphen';
	if (value.match(/^_/)) return 'Package name cannot start with an underscore';
	if (value.toLowerCase() !== value) return 'Package name cannot contain capital letters';
	if (value.length > 214) return 'Package name cannot contain more than 214 characters';
	for (const excluded of ['node_modules', 'favicon.ico']) {
		if (value === excluded) return `${excluded} is not a valid package name`;
	}
	if (encodeURIComponent(value) !== value) {
		const scopedPackagePattern = new RegExp('^(?:@([^/]+?)[/])?([^/]+?)$');
		const nameMatch = value.match(scopedPackagePattern);
		if (nameMatch) {
			const [, org, pkg] = nameMatch;
			if (pkg.startsWith('.')) return 'Package name cannot start with a period';
			if (/[~'!()*]/.test(pkg)) return 'Package name cannot contain special characters ("~\'!()*")';
			if (encodeURIComponent(org!) !== org || encodeURIComponent(pkg) !== pkg) {
				return `Package name can only contain URL-friendly characters: ${encodeURIComponent(org)}/${encodeURIComponent(pkg)}`;
			}
			return;
		}
	}
	return `Package name can only contain URL-friendly characters: ${encodeURIComponent(value)}`;
};
