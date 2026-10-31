import type { Handle } from '@sveltejs/kit';
import { i18n } from '#lib/i18n';

const handleFoo: Handle = i18n.handle();

export const handle: Handle = handleFoo;
