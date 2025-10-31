//#region src/index.ts
function dedent(strings, ...values) {
	if (typeof strings === "string") return strings.trim().replace(/^\n+|\n+$/g, "");
	let result = strings[0];
	for (let i = 0; i < values.length; i++) result += values[i] + strings[i + 1];
	return result.trim().replace(/^\n+|\n+$/g, "");
}
function testTaggedTemplateLiteral() {
	return dedent`
		<script lang="ts">
			console.log('Hello');
		<\/script>
	`;
}
function testFunctionCall() {
	return dedent(`
		<script lang="ts">
			console.log('Hello');
		<\/script>
	`);
}
const taggedResult = testTaggedTemplateLiteral();
const functionResult = testFunctionCall();

//#endregion
export { functionResult, taggedResult, testFunctionCall, testTaggedTemplateLiteral };