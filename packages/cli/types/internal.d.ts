export type TemplateTypes = 'default' | 'skeleton' | 'skeletonlib'
export type Types = 'typescript' | 'checkjs' | null

export type Options = {
	name: string;
	template: TemplateTypes;
	types: Types;
};

export type File = {
	name: string;
	contents: string;
};

export type Condition = Exclude<TemplateTypes | Types, null>;

export type Common = {
	files: Array<{
		name: string;
		include: Condition[];
		exclude: Condition[];
		contents: string;
	}>;
};
