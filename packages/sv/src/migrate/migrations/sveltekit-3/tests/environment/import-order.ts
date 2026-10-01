import { before } from './before';
import { ENV_PUBLIC_STATIC_ORDERED } from '$env/static/public';
import { between } from './between';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { after } from './after';

export function getOrderedEnvValues() {
	return {
		before,
		static: ENV_PUBLIC_STATIC_ORDERED,
		between,
		dynamicPublic: publicEnv.ENV_PUBLIC_DYNAMIC_ORDERED,
		dynamicPrivate: privateEnv.ENV_PRIVATE_DYNAMIC_ORDERED,
		after
	};
}
