import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '../downloadJson.ts';

describe('downloadJson', () => {
	let originalFetch: typeof globalThis.fetch;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchMock = vi.fn();
		globalThis.fetch = fetchMock as typeof globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.resetModules();
	});

	it('should cache responses and return cached data on subsequent calls', async () => {
		const mockData = { cached: true };
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockData)
		} as unknown as Response);

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
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockData)
			} as unknown as Response);

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
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => {
				return Promise.reject(new Error('Invalid JSON'));
			}
		} as unknown as Response);

		await expect(downloadJson('https://example.com/api/invalid-json')).rejects.toThrow(
			'Invalid JSON'
		);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});
