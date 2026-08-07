import { redirect, redirect as go } from '@sveltejs/kit';
import * as kit from '@sveltejs/kit';

declare const path: string;

redirect(307, 'https://example.com', { external: true });
go(308, `https://example.com/${path}`, { external: true });
redirect(302, '//example.com/path', { external: true });
redirect(302, 'mailto:hello@example.com', { external: true });
redirect(302, 'https://example.com/' + path, { external: true });
redirect(307, '/internal');
redirect(307, path);
redirect(307, `/${path}`);
redirect(307, 'javascript:alert(1)', { external: 'javascript:' });
redirect(307, 'https://example.com', { external: ['https://example.com'] });
kit.redirect(307, 'https://example.com/namespace', { external: true });
redirect(307, `https://${path}`, { external: true });
