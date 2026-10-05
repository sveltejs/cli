import { afterNavigate, beforeNavigate, goto, onNavigate } from '$app/navigation';

declare const state: App.PageState;
declare function getState(): App.PageState;
declare function cleanup(): void;

goto('/foo', { shallow: true, state });
goto('/foo', { shallow: true });
goto('/bar', { shallow: true, replace: true, state: getState() });
goto('/unchanged');

beforeNavigate(({ shallow, type }) => {
	if (shallow && type === 'goto') return;

	console.log('before navigation');
});

afterNavigate((navigation) => {
	if (navigation.shallow && navigation.type === 'goto') return;

	console.log(navigation.to);
});

onNavigate(({ to, shallow, type }) => {
	if (shallow && type === 'goto') return;

	return cleanup();
});
