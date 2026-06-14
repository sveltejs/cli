import { ENV_PUBLIC_STATIC_1 as publicStaticEnv } from '$app/env/public';
import { ENV_PRIVATE_STATIC_1 } from '$app/env/private';

export function getStaticEnvValues() {
	return { private: ENV_PRIVATE_STATIC_1, public: publicStaticEnv };
}
