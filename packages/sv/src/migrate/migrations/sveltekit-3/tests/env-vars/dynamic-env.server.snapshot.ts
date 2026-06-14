import { ENV_PUBLIC_DYNAMIC_1 } from '$app/env/public';
import { ENV_PRIVATE_DYNAMIC_1 } from '$app/env/private';

export function getDynamicEnvValues() {
	return { private: ENV_PRIVATE_DYNAMIC_1, public: ENV_PUBLIC_DYNAMIC_1 };
}
