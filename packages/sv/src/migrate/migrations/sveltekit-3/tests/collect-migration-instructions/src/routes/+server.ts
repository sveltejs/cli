import { redirect } from '@sveltejs/kit';

export const GET = ({ url }) => {
	const returnTo = url.searchParams.get('returnTo') ?? '/';
	throw redirect(307, returnTo);
};
