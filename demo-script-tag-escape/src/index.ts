// Simple fake dedent function to demonstrate bundler behavior
// In real usage, this would be the dedent library, but here we use a simple version
function dedent(strings: TemplateStringsArray | string, ...values: any[]): string {
	if (typeof strings === 'string') {
		// Function call syntax: dedent("...")
		return strings.trim().replace(/^\n+|\n+$/g, '');
	}
	// Tagged template literal syntax: dedent`...`
	let result = strings[0];
	for (let i = 0; i < values.length; i++) {
		result += values[i] + strings[i + 1];
	}
	return result.trim().replace(/^\n+|\n+$/g, '');
}

// Test with tagged template literal syntax (dedent`...`)
export function testTaggedTemplateLiteral() {
	const result = dedent`
		<script lang="ts">
			console.log('Hello');
		</script>
	`;
	return result;
}

// Test with function call syntax (dedent(...))
export function testFunctionCall() {
	const result = dedent(`
		<script lang="ts">
			console.log('Hello');
		</script>
	`);
	return result;
}

// Export both to be used in test
export const taggedResult = testTaggedTemplateLiteral();
export const functionResult = testFunctionCall();
