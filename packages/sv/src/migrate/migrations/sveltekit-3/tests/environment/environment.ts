import { browser, dev } from '$app/environment';
import { building as isBuilding, version } from '$app/environment';
import { untouched } from '$app/env';

export function getEnvironmentState() {
	return {
		browser,
		dev,
		isBuilding,
		version,
		untouched
	};
}
