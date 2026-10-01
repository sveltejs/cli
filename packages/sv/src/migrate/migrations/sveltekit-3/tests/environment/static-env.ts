import { ENV_PRIVATE_STATIC_1 } from '$env/static/private';
import { ENV_PUBLIC_STATIC_1 as publicStaticEnv } from '$env/static/public';

export function getStaticEnvValues() {
	return {
		private: ENV_PRIVATE_STATIC_1,
		public: publicStaticEnv
	};
}
