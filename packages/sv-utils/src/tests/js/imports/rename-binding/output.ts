import { defineConfig as config } from 'config';
import { oldName as other } from 'other';

import {
	replacement as existing,
	type ExistingType,
	type NewType as TypeAlias,
	type RenamedDeclared
} from 'pkg';

import * as namespace from 'pkg';

const object = { oldName: existing, aliased: existing };
const result = replacement(existing) + existing(existing);
const configResult = config();
const stringResult = existing;

type A = TypeAlias;
type B = RenamedDeclared;
type C = ExistingType;

export { object, result, configResult, stringResult, other, namespace };
