import { goto } from './router.js';
import { goto as pushState } from '$app/navigation';

declare const state: App.PageState;

goto('/elsewhere');
pushState('/foo', { shallow: true, state });
pushState('/bar', { shallow: true, replace: true, state });
