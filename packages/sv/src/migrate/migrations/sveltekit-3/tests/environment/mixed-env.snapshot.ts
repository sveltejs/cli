import {
	ENV_PUBLIC_STATIC_MIXED as publicStaticMixed,
	ENV_PUBLIC_DYNAMIC_MIXED
} from '$app/env/public';

export function getMixedEnvValues() {
	return { static: publicStaticMixed, dynamic: ENV_PUBLIC_DYNAMIC_MIXED };
}
