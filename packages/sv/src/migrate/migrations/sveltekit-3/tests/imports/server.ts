import type {
	RequestEvent,
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
	RequestedResult,
	ValidationError
} from '@sveltejs/kit';

export type { RemoteQuery as Query, RequestEvent } from '@sveltejs/kit';

type Requested = import('@sveltejs/kit').RequestedResult<string, unknown>;

/** @type {import('@sveltejs/kit').ValidationError | null} */
export const validationError = null;

export type { RemoteForm, Requested };
