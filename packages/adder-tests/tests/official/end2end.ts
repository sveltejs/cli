import { test, describe, beforeAll, afterAll } from 'vitest';
import { adderIds, getAdderDetails } from '@svelte-cli/adders';
import { runEndToEndTests } from '@svelte-cli/adder-testing-library';

const adders = adderIds.flatMap((x) => getAdderDetails(x));

runEndToEndTests('.outputs-e2e', adders, describe, test.concurrent, beforeAll, afterAll);
