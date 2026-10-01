import { afterNavigate, beforeNavigate, goto, onNavigate } from '$app/navigation';

declare const state: App.PageState;
declare function getState(): App.PageState;
declare function cleanup(): void;

goto('/foo', { shallow: true, state });
goto('/foo', { shallow: true });
goto('/bar', { shallow: true, replace: true, state: getState() });
goto('/unchanged');

beforeNavigate(({ shallow }) => {
	if (shallow) return;

	console.log('before navigation');
});

afterNavigate((navigation) => {
	if (navigation.shallow) return;

	console.log(navigation.to);
});

onNavigate(({ to, shallow }) => {
	if (shallow) return;

	return cleanup();
});
