import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '#lib/i18n';

const originalHandle = async ({ event, resolve }) => resolve(event);
/** @type {import('@sveltejs/kit').Handle} */ const handleFoo = i18n.handle();

export const handle = sequence(originalHandle, handleFoo);
