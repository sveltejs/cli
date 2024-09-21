import { test, describe, beforeAll, afterAll } from 'vitest';
import { adderIds, getAdderDetails } from '@svelte-cli/adders';
import { runEndToEndTests } from '@svelte-cli/adder-testing-library';

const adders = adderIds.flatMap((x) => getAdderDetails(x));
// const filteredAdders = adders.filter((x) => x.config.metadata.id == 'drizzle');

runEndToEndTests('.outputs', adders, describe, test, beforeAll, afterAll);
