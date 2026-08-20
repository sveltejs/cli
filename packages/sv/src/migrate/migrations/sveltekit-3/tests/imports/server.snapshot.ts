import type { RequestEvent, ValidationError } from '@sveltejs/kit';

import type {
	InvalidField,
	LiveQueryRequestedResult,
	LiveRequestedEntry,
	QueryRequestedResult,
	RemoteCommand,
	RemoteForm,
	RemoteFormEnhanceCallback,
	RemoteFormEnhanceInstance,
	RemoteFormField,
	RemoteFormFields,
	RemoteFormFieldType,
	RemoteFormFieldValue,
	RemoteFormInput,
	RemoteFormIssue,
	RemoteLiveQuery,
	RemoteLiveQueryFunction,
	RemotePrerenderFunction,
	RemoteQuery,
	RemoteQueryFunction,
	RemoteQueryOverride,
	RemoteQueryUpdate,
	RemoteResource,
	RequestedEntry,
	RequestedResult
} from '$app/server';

export type { RequestEvent } from '@sveltejs/kit';
export type { RemoteQuery as Query } from '$app/server';

type Requested = import('$app/server').RequestedResult<string, unknown>;

/** @type {import('@sveltejs/kit').ValidationError | null} */
export const validationError = null;

export type { RemoteForm, Requested };
