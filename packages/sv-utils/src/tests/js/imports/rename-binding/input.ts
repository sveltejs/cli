import { configured as configuredAlias } from 'config';
import { oldName as other } from 'other';
import {
	oldName,
	oldName as aliased,
	replacement as existing,
	type OldType as TypeAlias,
	type ExistingType
} from 'pkg';
import type { DeclaredType } from 'pkg';
import * as namespace from 'pkg';
import { 'oldName' as stringNamed } from 'pkg';

const object = { oldName, aliased };
const result = replacement(oldName) + existing(aliased);
const configResult = configuredAlias();
const stringResult = stringNamed;
type A = TypeAlias;
type B = DeclaredType;
type C = ExistingType;

export { object, result, configResult, stringResult, other, namespace };
