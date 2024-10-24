import { getAdderDetails, officialAdders } from '@sveltejs/adders';

export async function getAdderTestDetails() {
	return Promise.all(
		officialAdders.map(async (x) => {
			return {
				config: getAdderDetails(x.id),
				tests: (await import(`../adders/${x.id}/tests.ts`)).tests
			};
		})
	);
}
