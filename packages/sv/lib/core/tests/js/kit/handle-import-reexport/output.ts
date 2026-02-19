import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { i18n } from '$lib/i18n';
import { handleExisting } from '$lib/auth.server';

const handleFoo: Handle = i18n.handle();

export const handle: Handle = sequence(handleExisting, handleFoo);
