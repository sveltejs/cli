import { before } from './before';
import { ENV_PUBLIC_STATIC_ORDERED, ENV_PUBLIC_DYNAMIC_ORDERED } from '$app/env/public';
import { between } from './between';
import { ENV_PRIVATE_DYNAMIC_ORDERED } from '$app/env/private';
import { after } from './after';

export function getOrderedEnvValues() {
	return {
		before,
		static: ENV_PUBLIC_STATIC_ORDERED,
		between,
		dynamicPublic: ENV_PUBLIC_DYNAMIC_ORDERED,
		dynamicPrivate: ENV_PRIVATE_DYNAMIC_ORDERED,
		after
	};
}
