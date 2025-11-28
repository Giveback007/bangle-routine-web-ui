import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		// VitePWA({
		// 	registerType: 'autoUpdate',
		// 	devOptions: {
		// 		enabled: true,
		// 	},
		// 	workbox: {
		// 		clientsClaim: true,
		// 		skipWaiting: true
		// 	}
		// }) as any,
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	]
});
