import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: { adapter: adapter({
		// ! NOTE:
		/** DO NOT NAME THIS index.html (it will override the pre-rendered index.html) */
		fallback: "CSR.html",
	}) }
};

export default config;
