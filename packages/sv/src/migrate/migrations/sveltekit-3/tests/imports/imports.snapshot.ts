import { error, type Actions } from '@sveltejs/kit';
import { defineParams, type ParamMatcher, type ParamValue } from '@sveltejs/kit/params';
import type { Page as AppPage, ReadonlyURL } from '$app/state';
import type { Navigation, BeforeNavigate } from '$app/navigation';
import type { ActionResult, SubmitFunction } from '$app/forms';

import type {
	CaughtError,
	ClientCaughtError,
	ClientInit,
	Handle,
	HandleClientError,
	HandleFetch,
	HandleServerError,
	Reroute,
	ResolveOptions,
	ServerInit,
	Transport,
	Transporter
} from '@sveltejs/kit/hooks';

import type { DefinedEnvVars, EnvVarConfig } from '@sveltejs/kit/env';

export type { RequestEvent } from '@sveltejs/kit';
export type { Page } from '$app/state';
export type { NavigationTarget } from '$app/navigation';
export type { ActionResult as Result } from '$app/forms';
export type { ParamDefinition } from '@sveltejs/kit/params';
export type { Handle as Hook } from '@sveltejs/kit/hooks';
export type { EnvVarConfig as VariableConfig } from '@sveltejs/kit/env';

type NavigationOptions = import('$app/navigation').GotoOptions;
type URLSearchParams = import('$app/state').ReadonlyURLSearchParams;
type HookTransport = import('@sveltejs/kit/hooks').Transport;
type Environment = import('@sveltejs/kit/env').DefinedEnvVars<Record<string, EnvVarConfig<unknown>>>;
type Load = import('@sveltejs/kit').Load;

/** @type {import('@sveltejs/kit/params').DefinedParams<Record<string, ParamMatcher>>} */
const params = defineParams({});

export function respond(page: AppPage, navigation: Navigation, result: ActionResult, url: ReadonlyURL) {
	return error(500, { page, navigation, result, url, params });
}

export type {
	Actions,
	SubmitFunction,
	BeforeNavigate,
	ParamValue,
	CaughtError,
	ClientCaughtError,
	ClientInit,
	Handle,
	HandleClientError,
	HandleFetch,
	HandleServerError,
	Reroute,
	ResolveOptions,
	ServerInit,
	Transport,
	Transporter,
	DefinedEnvVars,
	EnvVarConfig,
	NavigationOptions,
	URLSearchParams,
	HookTransport,
	Environment,
	Load
};
