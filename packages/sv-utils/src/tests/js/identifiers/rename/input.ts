const target = source;

consume(target);

const object = { target, fixed: target };

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

function recurse(count: number) {
	return count > 0 ? recurse(count - 1) : count;
}

{
	function recurse() {
		return recurse();
	}
}
