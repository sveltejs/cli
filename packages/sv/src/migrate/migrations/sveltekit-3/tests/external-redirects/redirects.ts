import { redirect, redirect as go } from '@sveltejs/kit';
import * as kit from '@sveltejs/kit';

declare const path: string;

redirect(307, 'https://example.com');
go(308, `https://example.com/${path}`);
redirect(302, '//example.com/path');
redirect(302, 'mailto:hello@example.com');
redirect(302, 'https://example.com/' + path);
redirect(307, '/internal');
redirect(307, path);
redirect(307, `/${path}`);
redirect(307, 'javascript:alert(1)');
redirect(307, 'https://example.com', { external: ['https://example.com'] });
kit.redirect(307, 'https://example.com/namespace');
redirect(307, `https://${path}`);
