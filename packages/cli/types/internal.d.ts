export type Options = {
	name: string;
	template: 'default' | 'skeleton' | 'skeletonlib';
	types: 'typescript' | 'checkjs' | null;
};

export type File = {
	name: string;
	contents: string;
};

export type Condition =
	| 'typescript'
	| 'checkjs'
	| 'skeleton'
	| 'default'
	| 'skeletonlib';

export type Common = {
	files: Array<{
		name: string;
		include: Condition[];
		exclude: Condition[];
		contents: string;
	}>;
};
