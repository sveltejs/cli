const empty = {};
const created = { foo: 1, bar: 'string' };

const created2 = {
	foo: 1,
	bar: 'string',
	object: { foo: 'hello', nested: { bar: 'world' } },
	array: [123, 'hello', { foo: 'bar', bool: true }, [456, '789']]
};

const created3 = {
	type: '123',
	nested: { type: 'something', value: 'inside' },
	array: [{ type: 'item', id: 1 }]
};
