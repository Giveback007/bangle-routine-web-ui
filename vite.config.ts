import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		// VitePWA({
		// 	registerType: 'autoUpdate',
		// 	injectRegister: 'auto',
		// 	devOptions: {
		// 		enabled: true,
		// 	}
		// }) as any,
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	]
});
