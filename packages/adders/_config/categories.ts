export type CategoryKeys = 'codeQuality' | 'css' | 'db' | 'testing' | 'additional';

export type CategoryInfo = {
	id: CategoryKeys;
	name: string;
	description: string;
};

<<<<<<< HEAD:packages/adders/_config/categories.ts
<<<<<<< HEAD:packages/adders/_config/categories.ts
=======
export type CategoryKeys = 'codeQuality' | 'css' | 'db' | 'testing' | 'additional' | 'baas';
>>>>>>> a19c799 (add baas category):packages/config/categories.ts
=======
export type CategoryKeys = 'codeQuality' | 'css' | 'db' | 'testing' | 'additional';
>>>>>>> f47d2f4 (Apply suggestions from benmccann and manuel3108):packages/config/categories.ts
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
