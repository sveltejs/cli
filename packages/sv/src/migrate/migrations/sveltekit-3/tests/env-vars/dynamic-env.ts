import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export function getDynamicEnvValues() {
	return {
		private: privateEnv.ENV_PRIVATE_DYNAMIC_1,
		privateAgain: privateEnv.ENV_PRIVATE_DYNAMIC_1,
		public: publicEnv.ENV_PUBLIC_DYNAMIC_1
	};
}
