/**
 * Contact store. `sendMail` resolves without sending — there is no SMTP here,
 * and the point of the offline kit is that a theme's contact form can be styled
 * and its success state exercised without mail leaving the machine.
 */
import { defineStore } from 'pinia';

export const useContactStore = defineStore('contact', {
    actions: {
        async sendMail() {
            return { data: { message: 'Message sent (theme-kit offline)' } };
        },
    },
});
