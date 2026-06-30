import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

import * as v from 'valibot';

const loginSchema = v.object({
	email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email format')),
	password: v.pipe(v.string(), v.nonEmpty('Password is required'), v.minLength(8, 'Password must be at least 8 characters'))
});

const registerSchema = v.object({
	...loginSchema.entries,
	name: v.pipe(v.string(), v.nonEmpty('Name is required'))
});

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/better-auth');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
	const parsed = v.safeParse(loginSchema, Object.fromEntries(formData));

		if (!parsed.success) {
			const flat = v.flatten(parsed.issues);
			const messages = Object.entries(flat.nested ?? {}).flatMap(([key, value]) =>
				value ? value.map((v) => `${key}: ${v}`) : []
			);
			return fail(400, { message: messages.join(', ') || 'Validation failed' });
		}

		const { email, password } = parsed.output;

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
	const parsed = v.safeParse(registerSchema, Object.fromEntries(formData));

		if (!parsed.success) {
			const flat = v.flatten(parsed.issues);
			const messages = Object.entries(flat.nested ?? {}).flatMap(([key, value]) =>
				value ? value.map((v) => `${key}: ${v}`) : []
			);
			return fail(400, { message: messages.join(', ') || 'Validation failed' });
		}

		const { email, password, name } = parsed.output;

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
	const socialSchema = v.object({
			provider: v.picklist(['github', 'google'], 'Invalid provider'),
			callbackURL: v.optional(v.pipe(v.string(), v.url()), '/demo/better-auth')
		});

		const parsed = v.safeParse(socialSchema, Object.fromEntries(formData));
		if (!parsed.success) {
			const flat = v.flatten(parsed.issues);
			const messages = Object.entries(flat.nested ?? {}).flatMap(([key, value]) =>
				value ? value.map((v) => `${key}: ${v}`) : []
			);
			return fail(400, { message: messages.join(', ') || 'Validation failed' });
		}

		const { provider, callbackURL } = parsed.output;

		const result = await auth.api.signInSocial({
			body: {
				provider: provider,
				callbackURL
			}
		});

		if (result.url) {
			return redirect(302, result.url);
		}
		return fail(400, { message: 'Social sign-in failed' });
},
};
