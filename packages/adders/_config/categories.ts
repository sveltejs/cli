export type Category = (typeof categories)[number];
export type CommunityCategory = (typeof communityCategories)[number];

export type AdderCategories = Record<Category, string[]>;

// the order defined here is how it'll be shown in the prompt
export const categories = [
	'Code Quality',
	'Testing',
	'CSS',
	'Database',
	'Auth',
	'Additional Functionality'
] as const;

export const communityCategories = ['Icon'] as const;
