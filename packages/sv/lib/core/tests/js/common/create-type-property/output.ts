declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			cf?: IncomingRequestCfProperties
		}

		// interface Platform {}
	}
}

export {};
