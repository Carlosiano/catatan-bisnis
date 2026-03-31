// stores.js
import { writable } from 'svelte/store';

export const page = writable('dashboard');

export const showAddPurchases = writable(false)