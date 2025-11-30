// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';

export default [
  prettier,
  ...svelte.configs.prettier,
  ...storybook.configs["flat/recommended"]
];
