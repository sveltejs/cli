import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '../downloadJson.js';

describe('downloadJson', () => {
	/** @type {typeof globalThis.fetch} */
	let originalFetch;
	/** @type {ReturnType<typeof vi.fn>} */
	let fetchMock;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchMock = vi.fn();
		globalThis.fetch = /** @type {typeof globalThis.fetch} */ (fetchMock);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.resetModules();
	});

	it('should cache responses and return cached data on subsequent calls', async () => {
		const mockData = { cached: true };
		fetchMock.mockResolvedValueOnce(
			/** @type {unknown} */ ({
				ok: true,
				json: () => Promise.resolve(mockData)
			})
		);

		const url = 'https://example.com/api/cached';
		const firstResult = await downloadJson(url);
		const secondResult = await downloadJson(url);

		expect(firstResult).toEqual(mockData);
		expect(secondResult).toEqual(mockData);
		// Fetch should only be called once due to caching
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('should retry on network errors with exponential backoff', async () => {
		const mockData = { success: true };
		const networkError = new Error('Network error');

		// First two attempts fail, third succeeds
		fetchMock
			.mockRejectedValueOnce(networkError)
			.mockRejectedValueOnce(networkError)
			.mockResolvedValueOnce(
				/** @type {unknown} */ ({
					ok: true,
					json: () => Promise.resolve(mockData)
				})
			);

		const result = await downloadJson('https://example.com/api/retry');

		expect(result).toEqual(mockData);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('should throw error after all retries are exhausted', async () => {
		const networkError = new Error('Network error');

		// All attempts fail
		fetchMock.mockRejectedValue(networkError);

		await expect(downloadJson('https://example.com/api/fail')).rejects.toThrow('Network error');
		// Should attempt 4 times (initial + 3 retries)
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it('should handle JSON parsing errors', async () => {
		fetchMock.mockResolvedValue(
			/** @type {unknown} */ ({
				ok: true,
				json: () => {
					return Promise.reject(new Error('Invalid JSON'));
				}
			})
		);

		await expect(downloadJson('https://example.com/api/invalid-json')).rejects.toThrow(
			'Invalid JSON'
		);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});
