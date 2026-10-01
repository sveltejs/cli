import path from 'node:path';
import { setupGlobal } from 'sv/testing';

const TEST_DIR = path.resolve(import.meta.dirname, '..', '..', '.test-output');

export default setupGlobal({
	TEST_DIR,
	pre: async () => {
		// global setup (e.g. spin up docker containers)
	},
	post: async () => {
		// tear down... (e.g. cleanup docker containers)
	}
});
