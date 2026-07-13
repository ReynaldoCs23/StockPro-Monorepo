import Echo from 'laravel-echo';
import windowPusher from 'pusher-js';

window.Pusher = windowPusher;

export const echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    
    // --- 3 BARIS INI YANG MEMAKSA REACT PAKAI HTTP BIASA ---
    forceTLS: false,
    encrypted: false,
    enabledTransports: ['ws'],
});