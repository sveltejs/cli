export type CategoryKeys = 'codeQuality' | 'css' | 'db' | 'testing' | 'additional';

export type CategoryInfo = {
	id: CategoryKeys;
	name: string;
	description: string;
};

export type CategoryDetails = Record<CategoryKeys, CategoryInfo>;

export type AdderCategories = Record<CategoryKeys, string[]>;

export const categories: CategoryDetails = {
	codeQuality: {
		id: 'codeQuality',
		name: 'Code Quality',
		description: ''
	},
	testing: {
		id: 'testing',
		name: 'Testing',
		description: ''
	},
	css: {
		id: 'css',
		name: 'CSS',
		description: 'Can be used to style your components'
	},
	db: {
		id: 'db',
		name: 'Database',
		description: ''
	},
	additional: {
		id: 'additional',
		name: 'Additional functionality',
		description: ''
	}
};
