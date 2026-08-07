import { pushState, replaceState, goto } from '$app/navigation';

declare const args: [string, App.PageState];
declare const state: App.PageState;

pushState(...args);
goto('/foo', { shallow: true, state });
replaceState('/bar', ...args);
goto('/baz', { shallow: true, replace: true, state });
