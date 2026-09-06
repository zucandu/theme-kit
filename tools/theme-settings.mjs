/**
 * Theme settings — the `theme_config` block in theme-kit.config.json.
 *
 * One declaration, two consumers. The dev server seeds `zucConfig.theme_<slug>`
 * from the defaults here so a theme can read its own settings while you lay it
 * out, and `zuc-theme export` writes the same block out as the package's
 * `config/settings.json`. Declaring it in two places would be one more thing to
 * keep in step, and the copy that drifted would be found by a store rather than
 * by you.
 *
 * 🚨 The rules below are the STORE'S rules, reproduced. A store validates this
 * manifest in the first pass of an install — before a single file is written —
 * because the values end up inlined into every page it serves. A manifest it
 * rejects fails the whole install, after upload, with nothing runnable to show
 * for it. Checking here is the only chance to find that out while it is still
 * cheap to fix. Loosening a rule here buys nothing and costs a failed upload.
 */

export const SETTING_TYPES = ['boolean', 'number', 'select', 'text', 'color'];

/** Ceiling on what one theme can add to every page a store serves. */
export const MAX_VALUE_BYTES = 32768;
export const MAX_SETTINGS = 100;
export const DEFAULT_TEXT_MAXLENGTH = 500;

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const fail = (message) => {
    throw new Error(message);
};

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function validateOptions(options, key) {
    if (!Array.isArray(options) || options.length === 0) {
        fail(`Setting "${key}" is type select but declares no options.`);
    }

    const seen = new Set();

    return options.map((option) => {
        if (!option || typeof option !== 'object' || option.value === undefined || option.label === undefined) {
            fail(`Setting "${key}" has an option missing value or label.`);
        }
        if (typeof option.value !== 'string' && !Number.isInteger(option.value)) {
            fail(`Setting "${key}" has a non-scalar option value.`);
        }

        const value = String(option.value);
        if (seen.has(value)) fail(`Setting "${key}" has duplicate option value: ${value}.`);
        seen.add(value);

        if (typeof option.label !== 'string' || option.label.trim() === '') {
            fail(`Setting "${key}" has an option with an empty label.`);
        }

        return { value, label: option.label };
    });
}

function validateRange(setting, key) {
    const min = setting.min ?? null;
    const max = setting.max ?? null;

    for (const [name, bound] of [['min', min], ['max', max]]) {
        if (bound !== null && !isNumber(bound)) fail(`Setting "${key}" has a non-numeric ${name}.`);
    }
    if (min !== null && max !== null && min > max) fail(`Setting "${key}" has min greater than max.`);

    return [min, max];
}

function validateSetting(setting, index, seen) {
    if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
        fail(`Setting #${index} is not an object.`);
    }

    const { key } = setting;
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
        fail(`Setting #${index} has an invalid key. Keys must match ${KEY_PATTERN}.`);
    }
    if (seen.has(key)) fail(`Duplicate setting key: ${key}.`);
    seen.add(key);

    const { type } = setting;
    if (!SETTING_TYPES.includes(type)) {
        fail(`Setting "${key}" has unknown type ${JSON.stringify(type)}. Allowed: ${SETTING_TYPES.join(', ')}.`);
    }

    if (typeof setting.label !== 'string' || setting.label.trim() === '') {
        fail(`Setting "${key}" is missing a label.`);
    }
    if (!('default' in setting)) fail(`Setting "${key}" is missing a default value.`);

    // `group` splits a long form into sections in the store's admin. Forty
    // ungrouped settings render as one wall, so it gets a value rather than none.
    const normalized = {
        key,
        type,
        label: setting.label,
        group: typeof setting.group === 'string' && setting.group.trim() !== '' ? setting.group : 'General',
    };

    switch (type) {
        case 'boolean':
            if (typeof setting.default !== 'boolean') {
                fail(`Setting "${key}" is type boolean but its default is not true/false.`);
            }
            normalized.default = setting.default;
            break;

        case 'number': {
            if (!isNumber(setting.default)) {
                fail(`Setting "${key}" is type number but its default is not numeric.`);
            }
            const [min, max] = validateRange(setting, key);
            normalized.min = min;
            normalized.max = max;
            if (min !== null && setting.default < min) fail(`Setting "${key}" has a default below its own min.`);
            if (max !== null && setting.default > max) fail(`Setting "${key}" has a default above its own max.`);
            normalized.default = setting.default;
            break;
        }

        case 'select': {
            normalized.options = validateOptions(setting.options, key);

            if (typeof setting.default !== 'string' && !Number.isInteger(setting.default)) {
                fail(`Setting "${key}" is type select but its default is not a scalar.`);
            }

            // Option values are strings once normalized, so the default is compared
            // as one too. An all-integer declaration (default 4, value 4) is valid
            // and must not be reported as not being among its own options.
            const fallback = String(setting.default);
            if (!normalized.options.some((option) => option.value === fallback)) {
                fail(`Setting "${key}" has a default that is not one of its options.`);
            }
            normalized.default = fallback;
            break;
        }

        case 'color':
            if (typeof setting.default !== 'string' || !COLOR_PATTERN.test(setting.default)) {
                fail(`Setting "${key}" is type color but its default is not a #rrggbb value.`);
            }
            normalized.default = setting.default.toLowerCase();
            break;

        default: {
            if (typeof setting.default !== 'string') {
                fail(`Setting "${key}" is type text but its default is not a string.`);
            }

            const maxlength = setting.maxlength ?? DEFAULT_TEXT_MAXLENGTH;
            if (!Number.isInteger(maxlength) || maxlength < 1 || maxlength > MAX_VALUE_BYTES) {
                fail(`Setting "${key}" has an invalid maxlength.`);
            }
            if (setting.default.length > maxlength) {
                fail(`Setting "${key}" has a default longer than its own maxlength.`);
            }

            normalized.maxlength = maxlength;
            normalized.default = setting.default;
            break;
        }
    }

    return normalized;
}

/**
 * Validate a `theme_config` array and return it normalized.
 *
 * @param {unknown} value raw `theme_config` from theme-kit.config.json
 * @returns {Array<object>} normalized settings, in declaration order
 */
export function parseThemeConfig(value) {
    // An ARRAY, not an object: a settings form renders in order, and object key
    // order is not a contract worth resting a layout on.
    if (!Array.isArray(value)) fail('theme_config must be an array of settings.');
    if (value.length > MAX_SETTINGS) {
        fail(`theme_config declares ${value.length} settings; the limit is ${MAX_SETTINGS}.`);
    }

    const seen = new Set();
    const settings = value.map((setting, index) => validateSetting(setting, index, seen));

    const size = Buffer.byteLength(JSON.stringify(defaultsOf(settings)), 'utf8');
    if (size > MAX_VALUE_BYTES) {
        fail(`theme_config defaults serialize to ${size} bytes; the limit is ${MAX_VALUE_BYTES}.`);
    }

    return settings;
}

/**
 * Every setting's default, keyed by setting key — the object a theme reads as
 * `zucConfig.theme_<slug>`.
 *
 * Values keep their declared type, so a boolean is a real boolean and a number a
 * real number. `v-if="zucConfig.theme_x.show_map"` then behaves here the way it
 * does on a store, rather than being tripped by a truthy string "false".
 */
export function defaultsOf(settings) {
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.default]));
}

/** The package's `config/settings.json`, built from the same declaration. */
export function manifestFrom(settings) {
    return { manifest_version: 1, settings };
}
