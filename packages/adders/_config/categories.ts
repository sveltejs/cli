export type Category = 'codeQuality' | 'css' | 'db' | 'testing' | 'auth' | 'additional';
export type CommunityCategory = 'community-category';

export type CategoryInfo = {
	name: string;
	description: string;
};

export type CategoryDetails = Record<Category, CategoryInfo>;
export type CommunityCategoryDetails = Record<CommunityCategory, CategoryInfo>;

export type AdderCategories = Record<Category, string[]>;

export const categories: CategoryDetails = {
	codeQuality: {
		name: 'Code Quality',
		description: ''
	},
	testing: {
		name: 'Testing',
		description: ''
	},
	css: {
		name: 'CSS',
		description: 'Can be used to style your components'
	},
	db: {
		name: 'Database',
		description: ''
	},
	auth: {
		id: 'auth',
		name: 'Auth',
		description: ''
	},
	additional: {
		name: 'Additional functionality',
		description: ''
	}
};

export const communityCategories: CommunityCategoryDetails = {
	'community-category': {
		name: 'Community category',
		description: ''
	}
};
