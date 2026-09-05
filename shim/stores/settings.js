/**
 * Settings store — languages, currencies, countries, page meta.
 *
 * Pure data: `fetchSettings` and `fetchCountries` have nothing to fetch, but stay
 * awaitable because Storefront.vue awaits both on mount.
 *
 * 🚨 Every lookup falls back to the first entry, and that is not tidiness — it is
 * the difference between a working kit and a blank page. PriceDisplay.vue does:
 *
 *     const { decimal_digits, code, rate } = settingsStore.selectedCurrencyObject;
 *
 * with no guard. Return `undefined` and that destructure throws, and PriceDisplay
 * is on nearly every page, so the whole storefront goes white. A developer only
 * has to set `default_currency` in theme-kit.config.json to a code the fixture
 * does not carry — an obvious thing to try — to trigger it.
 *
 * The lookup is kept rather than hardcoded so the currency switcher still does
 * something visible: pick EUR and the symbol changes. The fallback makes it safe;
 * the lookup makes it useful.
 */
import { defineStore } from 'pinia';
import setting from '../../fixtures/setting.json';
import countryList from '../../fixtures/countries.json';

const CURRENCIES = setting.currencies ?? [];
const LANGUAGES = setting.languages ?? [];
const COUNTRIES = countryList.countries ?? [];

/** USD and the United States, whatever the config asks for. */
const DEFAULT_CURRENCY = CURRENCIES[0];
const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.iso_code_2 === 'US') ?? COUNTRIES[0];

export const useSettingsStore = defineStore('settings', {
    state: () => ({
        currencies: CURRENCIES,
        languages: LANGUAGES,
        countries: COUNTRIES,
        metaTags: setting.meta ?? [],
        selectedCurrency: DEFAULT_CURRENCY?.code ?? 'USD',
        selectedLanguage: LANGUAGES[0]?.iso_code ?? 'en',
    }),

    getters: {
        languagePrefix: () => '',
        activeLanguage: () => LANGUAGES[0],

        selectedCurrencyObject: (s) => s.currencies.find((c) => c.code === s.selectedCurrency) ?? DEFAULT_CURRENCY,
        findCurrencyByCode: (s) => (code) => s.currencies.find((c) => c.code === code) ?? DEFAULT_CURRENCY,

        getCountryById: (s) => (id) => s.countries.find((c) => +c.id === +id) ?? DEFAULT_COUNTRY,
        getCountryByCode: (s) => (code) => s.countries.find((c) => c.iso_code_2 === code) ?? DEFAULT_COUNTRY,
        getZonesByCountryId: (s) => (id) => (s.countries.find((c) => +c.id === +id) ?? DEFAULT_COUNTRY)?.zones ?? [],

        // The one lookup left free to miss. Not every route has a meta row, on a
        // real store either, and MetaTags is written for that — so returning a
        // stand-in here would put the wrong <title> on pages that should have none.
        getMetatagsByName: (s) => (routeName) => s.metaTags.find((m) => m.pagename === routeName),
    },

    actions: {
        async fetchSettings() {},
        async fetchCountries() {},

        setSelectedCurrency(code) {
            this.selectedCurrency = code;
        },

        /**
         * The platform reloads the page at a new language prefix. Here it only
         * records the choice — a reload would drop the dev server's HMR session
         * and cost you your place for no benefit offline.
         */
        changeLanguage(currentPath, nextLocale) {
            this.selectedLanguage = nextLocale;
        },
    },
});
