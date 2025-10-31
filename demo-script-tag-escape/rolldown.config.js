import { defineConfig } from 'rolldown';

export default defineConfig({
	input: ['src/index.ts'],
	output: {
		dir: 'dist-rolldown',
		format: 'es'
	}
});
