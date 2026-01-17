/**
 * @typedef {{ id: string; reason: string }} Reason
 */

export class UnsupportedError extends Error {
	name = 'Unsupported Environment';
	/** @type {Reason[]} */
	reasons = [];

	/**
	 * @param {Reason[]} reasons
	 */
	constructor(reasons) {
		super();
		this.reasons = reasons;
	}
}
