import { ENV_PRIVATE_DYNAMIC_1 } from '$app/env/private';
import { ENV_PUBLIC_DYNAMIC_1 } from '$app/env/public';

export function getDynamicEnvValues() {
	return {
		private: ENV_PRIVATE_DYNAMIC_1,
		privateAgain: ENV_PRIVATE_DYNAMIC_1,
		public: ENV_PUBLIC_DYNAMIC_1
	};
}
