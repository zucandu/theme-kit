/**
 * Menu store. `fetchMenuByType(type)` returns the captured menu for that type.
 *
 * The six types are the ones the default theme asks for by name — primary,
 * tertiary, home-top, footer-middle, footer-bottom, account. An unknown type
 * returns null, exactly as the platform does for a menu a store has not built,
 * so a theme that assumes a menu always exists fails here rather than on a
 * customer's screen.
 */
import { defineStore } from 'pinia';
import menus from '../../../fixtures/menus.json';

export const useMenuStore = defineStore('menu', {
    state: () => ({ menu: menus }),
    actions: {
        async fetchMenuByType(type) {
            return menus[type] ?? null;
        },
    },
});
