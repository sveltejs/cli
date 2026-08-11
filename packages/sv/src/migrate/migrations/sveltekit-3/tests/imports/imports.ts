import {
	error,
	defineParams,
	type ParamMatcher,
	type Page as AppPage,
	type Navigation,
	type ActionResult,
	type ReadonlyURL
} from '@sveltejs/kit';
import type { Actions, SubmitFunction, BeforeNavigate, ParamValue } from '@sveltejs/kit';

export type {
	Page,
	NavigationTarget,
	ActionResult as Result,
	ParamDefinition,
	RequestEvent
} from '@sveltejs/kit';

type NavigationOptions = import('@sveltejs/kit').GotoOptions;
type URLSearchParams = import('@sveltejs/kit').ReadonlyURLSearchParams;
type Load = import('@sveltejs/kit').Load;

/** @type {import('@sveltejs/kit').DefinedParams<Record<string, ParamMatcher>>} */
const params = defineParams({});

export function respond(page: AppPage, navigation: Navigation, result: ActionResult, url: ReadonlyURL) {
	return error(500, { page, navigation, result, url, params });
}

export type { Actions, SubmitFunction, BeforeNavigate, ParamValue, NavigationOptions, URLSearchParams, Load };
