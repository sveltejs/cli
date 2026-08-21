import { beforeNavigate, pushState, replaceState } from '$app/navigation';

declare const args: [string, App.PageState];
declare const state: App.PageState;

pushState(...args);
pushState('/foo', state);
replaceState('/bar', state);

beforeNavigate(() => {
	console.log('before navigation');
});
