/**
 * Post-login / post-action redirect helper. The platform resolves a stored
 * `redirect` target; here it just navigates, so a theme's "continue" buttons
 * still move the developer around the site.
 */
import { useRouter } from 'vue-router';

export function useRedirect() {
    const router = useRouter();
    const redirectTo = (target) => (target ? router.push(target) : router.push({ name: 'index' }));
    return { redirectTo };
}
