export async function getDynamicImportEnvValues() {
	const { ENV_PRIVATE_STATIC_IMPORT } = await import('$app/env/private');
	const { ENV_PUBLIC_DYNAMIC_IMPORT } = await import('$app/env/public');

	return {
		private: ENV_PRIVATE_STATIC_IMPORT,
		public: ENV_PUBLIC_DYNAMIC_IMPORT
	};
}
