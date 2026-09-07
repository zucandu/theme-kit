/**
 * Contact store. `sendMail` resolves without sending — there is no SMTP here,
 * and the point of the offline kit is that a theme's contact form can be styled
 * and its success state exercised without mail leaving the machine.
 */
import { defineStore } from 'pinia';
import { announce } from '../../services/announce.js';

export const useContactStore = defineStore('contact', {
    actions: {
        async sendMail() {
            announce('Send contact message');
            return { data: { message: 'Message sent (theme-kit offline)' } };
        },
    },
});
