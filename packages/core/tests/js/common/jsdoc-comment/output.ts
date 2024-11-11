/**
 * @param {import("$lib/paraglide/runtime").AvailableLanguageTag} newLanguage
 */
function switchToLanguage(newLanguage) {
	const canonicalPath = i18n.route($page.url.pathname);
	const localisedPath = i18n.resolveRoute(canonicalPath, newLanguage);
	goto(localisedPath);
}
