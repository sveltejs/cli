import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== Script Tag Escaping Demo ===\n');

// Read the built files
const rolldownPath = path.join(__dirname, 'dist-rolldown', 'index.js');
const tsdownPath = path.join(__dirname, 'dist-tsdown', 'index.js');

if (!fs.existsSync(rolldownPath)) {
	console.log('❌ Rolldown build not found. Run: npm run build:rolldown');
	process.exit(1);
}

if (!fs.existsSync(tsdownPath)) {
	console.log('❌ Tsdown build not found. Run: npm run build:tsdown');
	process.exit(1);
}

const rolldownCode = fs.readFileSync(rolldownPath, 'utf-8');
const tsdownCode = fs.readFileSync(tsdownPath, 'utf-8');

console.log('📦 ROLLDOWN BUNDLED CODE (excerpt):');
console.log('─'.repeat(80));
// Find script tags in the rolldown output
const rolldownScriptMatches = [
	...rolldownCode.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g),
	...rolldownCode.matchAll(/<\\\/script>/g)
];
if (rolldownScriptMatches.length > 0) {
	const match = rolldownScriptMatches[0][0];
	console.log(match.substring(0, 150) + (match.length > 150 ? '...' : ''));
} else {
	// Show a snippet around dedent or script tag
	const scriptIndex = rolldownCode.indexOf('</script>');
	const escapedIndex = rolldownCode.indexOf('<\\/script>');
	const searchIndex = scriptIndex !== -1 ? scriptIndex : escapedIndex !== -1 ? escapedIndex : -1;
	if (searchIndex !== -1) {
		const snippet = rolldownCode.substring(Math.max(0, searchIndex - 50), searchIndex + 20);
		console.log(snippet);
	} else {
		console.log('No script tag found');
	}
}

console.log('\n');

console.log('📦 TSDOWN BUNDLED CODE (excerpt):');
console.log('─'.repeat(80));
// Find script tags in the tsdown output
const tsdownScriptMatches = [
	...tsdownCode.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g),
	...tsdownCode.matchAll(/<\\\/script>/g)
];
if (tsdownScriptMatches.length > 0) {
	const match = tsdownScriptMatches[0][0];
	console.log(match.substring(0, 150) + (match.length > 150 ? '...' : ''));
} else {
	// Show a snippet around script tag
	const scriptIndex = tsdownCode.indexOf('</script>');
	const escapedIndex = tsdownCode.indexOf('<\\/script>');
	const searchIndex = scriptIndex !== -1 ? scriptIndex : escapedIndex !== -1 ? escapedIndex : -1;
	if (searchIndex !== -1) {
		const snippet = tsdownCode.substring(Math.max(0, searchIndex - 50), searchIndex + 20);
		console.log(snippet);
	} else {
		console.log('No script tag found');
	}
}

console.log('\n');

// Check for escaped script tags
console.log('🔍 CHECKING FOR ESCAPED SCRIPT TAGS IN BUNDLED CODE:');
console.log('─'.repeat(80));

const rolldownHasEscaped =
	rolldownCode.includes('<\\/script>') || rolldownCode.includes('</script>'.replace('/', '\\/'));
const tsdownHasEscaped =
	tsdownCode.includes('<\\/script>') || tsdownCode.includes('</script>'.replace('/', '\\/'));

console.log(
	`Rolldown: ${rolldownHasEscaped ? '❌ HAS ESCAPED </script> (found <\\/script>)' : '✅ No escaping detected'}`
);
console.log(
	`Tsdown:   ${tsdownHasEscaped ? '❌ HAS ESCAPED </script> (found <\\/script>)' : '✅ No escaping detected'}`
);

console.log('\n');

// Try to run the actual code
console.log('🚀 RUNTIME BEHAVIOR:');
console.log('─'.repeat(80));

try {
	const rolldownModule = await import(path.join(__dirname, 'dist-rolldown', 'index.js'));
	const tsdownModule = await import(path.join(__dirname, 'dist-tsdown', 'index.js'));

	console.log(
		'\nRolldown taggedResult:',
		rolldownModule.taggedResult.includes('<\\/script>') ? '❌ ESCAPED' : '✅ Not escaped'
	);
	console.log(
		'Rolldown functionResult:',
		rolldownModule.functionResult.includes('<\\/script>') ? '❌ ESCAPED' : '✅ Not escaped'
	);
	console.log(
		'\nTsdown taggedResult:',
		tsdownModule.taggedResult.includes('<\\/script>') ? '❌ ESCAPED' : '✅ Not escaped'
	);
	console.log(
		'Tsdown functionResult:',
		tsdownModule.functionResult.includes('<\\/script>') ? '❌ ESCAPED' : '✅ Not escaped'
	);

	if (
		rolldownModule.taggedResult.includes('<\\/script>') ||
		tsdownModule.taggedResult.includes('<\\/script>')
	) {
		console.log('\n💡 DEMONSTRATION: Tagged template literal syntax causes escaping!');
	}
	if (
		!rolldownModule.functionResult.includes('<\\/script>') &&
		!tsdownModule.functionResult.includes('<\\/script>')
	) {
		console.log('✅ Function call syntax prevents escaping!');
	}
} catch (e) {
	console.log('Could not execute built code:', e.message);
	console.log('(This is okay - we can still see the difference in the bundled code above)');
}

console.log('\n');
console.log('💡 CONCLUSION:');
console.log('─'.repeat(80));
console.log(
	'When bundlers process tagged template literals (dedent`...`), they may escape </script>'
);
console.log('Using function call syntax (dedent(...)) avoids this escaping behavior.');
