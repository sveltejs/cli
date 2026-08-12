import {
	afterNavigate,
	beforeNavigate,
	goto,
	onNavigate,
	pushState,
	replaceState as replace
} from '$app/navigation';

declare const state: App.PageState;
declare function getState(): App.PageState;
declare function cleanup(): void;

pushState('/foo', state);
pushState('/foo', {});
replace('/bar', getState());
goto('/unchanged');

beforeNavigate(() => {
	console.log('before navigation');
});

afterNavigate((navigation) => {
	console.log(navigation.to);
});

onNavigate(({ to }) => cleanup());
