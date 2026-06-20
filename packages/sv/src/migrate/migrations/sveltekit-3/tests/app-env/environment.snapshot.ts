import { browser, dev } from '$app/env';
import { building as isBuilding, version } from '$app/env';
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
