export async function getDynamicImportEnvValues() {
	const { ENV_PRIVATE_STATIC_IMPORT } = await import('$env/static/private');
	const { ENV_PUBLIC_DYNAMIC_IMPORT } = await import('$env/dynamic/public');

	return {
		private: ENV_PRIVATE_STATIC_IMPORT,
		public: ENV_PUBLIC_DYNAMIC_IMPORT
	};
}
