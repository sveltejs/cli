import { goto } from './router.js';
import { pushState, replaceState } from '$app/navigation';

declare const state: App.PageState;

goto('/elsewhere');
pushState('/foo', state);
replaceState('/bar', state);
