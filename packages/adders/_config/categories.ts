export type Category = (typeof categories)[number];
export type CommunityCategory = (typeof communityCategories)[number];

export type AdderCategories = Record<Category, string[]>;

export const categories = [
	'Code Quality',
	'Testing',
	'CSS',
	'Database',
	'Auth',
	'Additional Functionality'
] as const;

export const communityCategories = ['Icon'] as const;
