import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/better-auth');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = typeof formData.get('email') === 'string' ? formData.get('email') : '';
		const password = typeof formData.get('password') === 'string' ? formData.get('password') : '';

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Signin failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/demo/better-auth');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = typeof formData.get('email') === 'string' ? formData.get('email') : '';
		const password = typeof formData.get('password') === 'string' ? formData.get('password') : '';
		const name = typeof formData.get('name') === 'string' ? formData.get('name') : '';

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/demo/better-auth');
	},
	signInSocial: async (event) => {
		const formData = await event.request.formData();
         
		const provider = typeof formData.get('provider') === 'string' ? formData.get('provider') : 'github';
		const callbackURL = typeof formData.get('callbackURL') === 'string' ? formData.get('callbackURL') : '/demo/better-auth';

		const result = await auth.api.signInSocial({
			body: {
				provider: provider as "github",
				callbackURL
			}
		});

		if (result.url) {
			return redirect(302, result.url);
		}
		return fail(400, { message: 'Social sign-in failed' });
	},
};
