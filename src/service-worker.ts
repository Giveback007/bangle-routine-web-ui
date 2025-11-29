/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="../.svelte-kit/ambient.d.ts" />

import { build, files, version } from "$service-worker"
import { dev } from '$app/environment';

// if (!dev) {
    const CACHE_NAME = `cache-${version}`;
    const ASSETS = [
        '/',                           // root HTML
        // '/manifest.webmanifest',       // PWA manifest
        ...build,
        ...files
    ];
    
    console.log('SERVICE-WORKER:', { build, files, version });
    
    // install service worker
    self.addEventListener('install', (event: any) => {
        async function addFilesToCache() {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(ASSETS);
        }
    
        console.log('installing service worker for version', version);
        console.log('caching assets', ASSETS);
        console.log('caching build', build);
    
        event.waitUntil(addFilesToCache())
    });
    
    self.addEventListener('activate', (event: any) => {
        async function deleteOldCaches() {
            for (const key of await caches.keys()) {
                if (key !== CACHE_NAME) await caches.delete(key);
            }
        }
    
        event.waitUntil(deleteOldCaches())
    });
    
    self.addEventListener('fetch', (event: any) => {
        if (event.request.method !== 'GET') return;
    
        async function respond() {
            const url = new URL(event.request.url);
            const cache = await caches.open(CACHE_NAME);
    
            // serve build files from the cache
            if (ASSETS.includes(url.pathname)) {
                const cachedResponse = await cache.match(url.pathname)
                if (cachedResponse) return cachedResponse;
            }
    
            let response: Response | undefined = undefined;
            try {
                response = await fetch(event.request);
                const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    
                if (isHttp && response.status === 200) {
                    cache.put(event.request, response.clone());
                }
            } catch(err) {
                response = await cache.match(event.request);
                if (!response) console.log(err);
            }
    
            return response ?? new Response("Not Found", { status: 404 });
            
        }
    
        event.respondWith(respond())
    })
// }
