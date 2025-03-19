import type * as estree from 'estree';

// Enhances existing nodes and adds new type nodes to estree.
declare module 'estree' {
	// new types
	interface TSTypeAnnotation {
		type: 'TSTypeAnnotation';
		typeAnnotation: TSStringKeyword | TSTypeReference | TSUnionType | TSIndexedAccessType;
	}
	interface TSStringKeyword {
		type: 'TSStringKeyword';
	}
	interface TSNullKeyword {
		type: 'TSNullKeyword';
	}
	interface TSTypeReference {
		type: 'TSTypeReference';
		typeName: Identifier;
	}
	interface TSAsExpression extends BaseNode {
		type: 'TSAsExpression';
		expression: Expression;
		typeAnnotation: TSTypeAnnotation['typeAnnotation'];
	}
	interface TSModuleDeclaration extends BaseNode {
		type: 'TSModuleDeclaration';
		global: boolean;
		declare: boolean;
		id: Identifier;
		body: TSModuleBlock;
	}
	interface TSModuleBlock extends BaseNode {
		type: 'TSModuleBlock';
		body: Array<TSModuleDeclaration | TSInterfaceDeclaration>;
	}
	interface TSInterfaceDeclaration extends BaseNode {
		type: 'TSInterfaceDeclaration';
		id: Identifier;
		body: TSInterfaceBody;
	}
	interface TSInterfaceBody extends BaseNode {
		type: 'TSInterfaceBody';
		body: TSPropertySignature[];
	}
	interface TSPropertySignature extends BaseNode {
		type: 'TSPropertySignature';
		computed: boolean;
		key: Identifier;
		typeAnnotation: TSTypeAnnotation;
	}
	interface TSProgram extends Omit<Program, 'body'> {
		body: Array<Directive | Statement | ModuleDeclaration | TSModuleDeclaration>;
	}
	interface TSUnionType {
		type: 'TSUnionType';
		types: Array<TSNullKeyword | TSTypeReference | TSImportType>;
	}
	interface TSImportType {
		type: 'TSImportType';
		argument: Literal;
		qualifier: Identifier;
	}
	interface TSIndexedAccessType {
		type: 'TSIndexedAccessType';
		objectType: TSImportType;
		indexType: TSLiteralType;
	}
	interface TSLiteralType {
		type: 'TSLiteralType';
		literal: Literal;
	}
	interface TSSatisfiesExpression extends BaseNode {
		type: 'TSSatisfiesExpression';
		expression: Expression;
		typeAnnotation: TSTypeAnnotation['typeAnnotation'];
	}

	// enhanced types
	interface Identifier {
		typeAnnotation?: TSTypeAnnotation;
	}
	interface ExpressionMap {
		TSAsExpression: TSAsExpression;
		TSSatisfiesExpression: TSSatisfiesExpression;
	}
	interface NodeMap {
		TSModuleDeclaration: TSModuleDeclaration;
		TSInterfaceDeclaration: TSInterfaceDeclaration;
	}
	interface ImportDeclaration {
		importKind: 'type' | 'value';
	}
}

export type { estree as TsEstree };
