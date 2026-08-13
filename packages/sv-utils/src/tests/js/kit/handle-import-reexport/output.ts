import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { handleExisting } from '#lib/auth.server';
import { i18n } from '#lib/i18n';

const handleFoo: Handle = i18n.handle();

export const handle: Handle = sequence(handleExisting, handleFoo);
