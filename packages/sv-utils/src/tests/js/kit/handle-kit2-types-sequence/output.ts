import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { i18n } from '#lib/i18n';

const originalHandle = async ({ event, resolve }) => resolve(event);
const handleFoo: Handle = i18n.handle();

export const handle = sequence(originalHandle, handleFoo);
