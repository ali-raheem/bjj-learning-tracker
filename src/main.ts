import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { installPrompt } from './lib/ui/install.svelte';
import { persistentStorage } from './lib/ui/storage.svelte';
import './app.css';

registerSW({ immediate: true });
void persistentStorage.start();
installPrompt.start();

mount(App, { target: document.getElementById('app')! });
