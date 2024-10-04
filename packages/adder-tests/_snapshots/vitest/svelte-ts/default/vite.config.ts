import { defineConfig } from "vitest/config";
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
})
