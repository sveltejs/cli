import { defineAddonOptions } from './packages/core/index.ts';

const options = defineAddonOptions({
	database: {
		type: 'select',
		question: 'Choose a database',
		default: 'sqlite',
		options: [
			{ value: 'sqlite', label: 'SQLite' },
			{ value: 'postgres', label: 'PostgreSQL' }
		]
	},
	orm: {
		type: 'select',
		question: 'Choose an ORM',
		default: 'drizzle',
		options: [
			{ value: 'drizzle', label: 'Drizzle' },
			{ value: 'prisma', label: 'Prisma' }
		],
		condition: (options) => options.database === 'postgres' // ✨ Fully typed!
		//                     ^? options.database: 'sqlite' | 'postgres' | undefined
	}
});
