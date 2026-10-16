import { beforeNavigate, pushState, goto } from '$app/navigation';

declare const args: [string, App.PageState];
declare const state: App.PageState;

pushState(...args);
goto('/foo', { shallow: true, state });
goto('/bar', { shallow: true, replace: true, state });

beforeNavigate(({ shallow, type }) => {
	if (shallow && type === 'goto') return;

	console.log('before navigation');
});
