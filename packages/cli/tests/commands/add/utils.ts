import { describe, expect, it } from 'vitest';
import { getAllPaths } from '../../../commands/add/utils.ts';

describe('getAllPaths', () => {
	it('should return all levels', () => {
		const allPathsUntilWorkspaceRoot = getAllPaths('/a', '/a/b/c');
		expect(allPathsUntilWorkspaceRoot).toEqual(['/a', '/a/b', '/a/b/c']);
	});

	it('should return the only path', () => {
		const allPathsUntilWorkspaceRoot = getAllPaths('/a', '/a');
		expect(allPathsUntilWorkspaceRoot).toEqual(['/a']);
	});

	it('should have the correct order', () => {
		const allPathsUntilWorkspaceRoot = getAllPaths('/a/b', '/a');
		expect(allPathsUntilWorkspaceRoot).toEqual(['/a/b', '/a']);
	});

	it('should even navigate to ..', () => {
		const allPathsUntilWorkspaceRoot = getAllPaths('/a', '/b/c');
		expect(allPathsUntilWorkspaceRoot).toEqual(['/a', '/', '/b', '/b/c']);
	});
});
