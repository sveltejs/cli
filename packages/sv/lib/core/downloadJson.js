/** @type {Map<string, any>} */
const inMemoryCache = new Map();

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
export const downloadJson = async (url) => {
	if (inMemoryCache.has(url)) {
		return inMemoryCache.get(url);
	}

	/** @type {Error | null} */
	let lastError = null;
	const maxRetries = 3;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url);
			if (
				!response.ok ||
				response.status === 404 ||
				(response.status < 200 && response.status >= 300)
			) {
				throw new Error(`${response.status} - ${response.statusText} - Failed to fetch ${url}`);
			}
			const data = await response.json();

			inMemoryCache.set(url, data);
			return data;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < maxRetries) {
				// Exponential backoff: wait 100ms, 200ms, 400ms
				const delay = 100 * Math.pow(2, attempt);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			// All retries exhausted
			throw lastError;
		}
	}

	throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
};
