import { defineParams } from '@sveltejs/kit/params';
import { fruits } from './lib/fruits.js';

const allowed = new Set(fruits);
const matchFruit = (param) => allowed.has(param);

const matchHex = (param: string) => (/^[\da-f]+$/i).test(param);

function matchInteger(param) {
	return (/^\d+$/).test(param);
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function matchUuid_v4(param) {
	return UUID_V4.test(param);
}

const allowed2 = new Set(fruits);
const matchVeggie = (param) => !allowed2.has(param);

export const params = defineParams({
	fruit: (param) => (matchFruit(param) ? param : undefined),
	hex: (param) => (matchHex(param) ? param : undefined),
	integer: (param) => (matchInteger(param) ? param : undefined),
	uuid_v4: (param) => (matchUuid_v4(param) ? param : undefined),
	veggie: (param) => (matchVeggie(param) ? param : undefined)
});
