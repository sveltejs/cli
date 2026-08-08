import { target } from 'module';

const first = source.value1;
const object = { target: source.value2 };

source.target;

function nested(target: string) {
	return target;
}

const last = source.value3;
