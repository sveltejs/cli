import {
	error,
	defineParams,
	type ParamMatcher,
	type Page as AppPage,
	type Navigation,
	type ActionResult,
	type ReadonlyURL
} from '@sveltejs/kit';
import type {
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
	EnvVarConfig
} from '@sveltejs/kit';

export type {
	Page,
	NavigationTarget,
	ActionResult as Result,
	ParamDefinition,
	Handle as Hook,
	EnvVarConfig as VariableConfig,
	RequestEvent
} from '@sveltejs/kit';

type NavigationOptions = import('@sveltejs/kit').GotoOptions;
type URLSearchParams = import('@sveltejs/kit').ReadonlyURLSearchParams;
type HookTransport = import('@sveltejs/kit').Transport;
type Environment = import('@sveltejs/kit').DefinedEnvVars<Record<string, EnvVarConfig<unknown>>>;
type Load = import('@sveltejs/kit').Load;

/** @type {import('@sveltejs/kit').DefinedParams<Record<string, ParamMatcher>>} */
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
