import type { RequestEvent } from '@sveltejs/kit';
import type { InvalidField } from '$app/server';

import type {
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
	RequestedResult,
	ValidationError
} from '@sveltejs/kit/remote';

export type { RequestEvent } from '@sveltejs/kit';
export type { RemoteQuery as Query } from '@sveltejs/kit/remote';

type Requested = import('@sveltejs/kit/remote').RequestedResult<string, unknown>;

/** @type {import('@sveltejs/kit/remote').ValidationError | null} */
export const validationError = null;

export type { RemoteForm, Requested };
