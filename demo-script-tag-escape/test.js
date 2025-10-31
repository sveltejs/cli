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

console.log('📊 SUMMARY: ESCAPING DETECTION IN BUNDLED CODE');
console.log('─'.repeat(80));
console.log('');

// More precise check: look for escaped script tags in specific functions
const checkEscaping = (code, isLiteral) => {
	if (isLiteral) {
		// Find testTaggedTemplateLiteral function - look for dedent` followed by escaped script tag
		const funcStart = code.indexOf('function testTaggedTemplateLiteral()');
		if (funcStart === -1) return '✅ No escaping detected';
		const funcEnd = code.indexOf('function testFunctionCall()', funcStart);
		const funcCode =
			funcEnd !== -1 ? code.substring(funcStart, funcEnd) : code.substring(funcStart);

		// Check if it uses dedent` (tagged template) and has escaped script tag
		const usesTagged = funcCode.includes('dedent`');
		const hasEscaped = funcCode.includes('<\\/script>');
		return usesTagged && hasEscaped ? '❌ found <\\/script>' : '✅ No escaping detected';
	} else {
		// Find testFunctionCall function - look for dedent( followed by script tag
		const funcStart = code.indexOf('function testFunctionCall()');
		if (funcStart === -1) return '✅ No escaping detected';
		const funcEnd = code.indexOf('const taggedResult', funcStart);
		const funcCode =
			funcEnd !== -1
				? code.substring(funcStart, funcEnd)
				: code.substring(funcStart, funcStart + 200);

		// Check if it uses dedent( (function call) and has escaped script tag
		// Function call syntax should NOT have escaping since it's a regular string argument
		const usesFunction = funcCode.includes('dedent(');
		const hasEscaped = funcCode.includes('<\\/script>');

		// Note: Some bundlers may still escape even in function calls, but the issue
		// is specifically with tagged template literals
		if (!usesFunction) return '✅ No escaping detected';
		return hasEscaped ? '❌ found <\\/script>' : '✅ No escaping detected';
	}
};

console.log('            │ Literal (dedent`...`) │ Function (dedent(...))');
console.log('────────────┼───────────────────────┼────────────────────────');
const rolldownLiteral = checkEscaping(rolldownCode, true);
const rolldownFunction = checkEscaping(rolldownCode, false);
const tsdownLiteral = checkEscaping(tsdownCode, true);
const tsdownFunction = checkEscaping(tsdownCode, false);

console.log(`Rolldown     │ ${rolldownLiteral.padEnd(23)}│ ${rolldownFunction}`);
console.log(`Tsdown       │ ${tsdownLiteral.padEnd(23)}│ ${tsdownFunction}`);
console.log('');

console.log('💡 CONCLUSION:');
console.log('─'.repeat(80));
console.log(
	'When bundlers process tagged template literals (dedent`...`), they may escape </script>'
);
console.log('Using function call syntax (dedent(...)) avoids this escaping behavior.');
