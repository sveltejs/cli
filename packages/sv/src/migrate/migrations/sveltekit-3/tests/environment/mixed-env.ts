import { ENV_PUBLIC_STATIC_MIXED as publicStaticMixed } from '$env/static/public';
import { env as publicEnv } from '$env/dynamic/public';

export function getMixedEnvValues() {
	return {
		static: publicStaticMixed,
		dynamic: publicEnv.ENV_PUBLIC_DYNAMIC_MIXED
	};
}
