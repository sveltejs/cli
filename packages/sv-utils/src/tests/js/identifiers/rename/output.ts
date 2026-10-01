const result = source;

consume(result);

const object = { target: result, fixed: result };

object.target;

function parameter(target: string) {
	return new.target ?? target;
}

{
	consume(target);

	let target = 1;

	consume(target);
}

target: {
	break target;
}

function renamedRecurse(count: number) {
	return count > 0 ? renamedRecurse(count - 1) : count;
}

{
	function recurse() {
		return recurse();
	}
}
