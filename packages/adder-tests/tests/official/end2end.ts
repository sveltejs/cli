import { test, describe, beforeAll, afterAll } from 'vitest';
import { adderIds, getAdderDetails } from '@svelte-cli/adders';
import { runEndToEndTests } from '@svelte-cli/adder-testing-library';

// in order to only run a selection of adders replace `adderIds` below
// with `['tailwindcss']` or whatever adder you want to test. Keep in
// mind that adders can have dependencies on each other, in these cases
// you need to provide all dependant adders.

const adders = adderIds.flatMap((x) => getAdderDetails(x));

runEndToEndTests('.outputs-e2e', adders, describe, test.concurrent, beforeAll, afterAll);
