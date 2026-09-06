/**
 * Blog store — article listing and article detail.
 *
 * The slug argument is ignored: one captured article is enough to lay out the
 * detail page, and resolving arbitrary slugs would mean shipping the store's
 * whole article set.
 *
 * 🚨 Both actions RETURN their payload and the theme reads the return value.
 * The `posts` / `article` state below is a convenience the platform store does
 * not have — do not build a theme on it, because on a live store it is not
 * there. What has to be right is the shape of what comes back.
 */
import { defineStore } from 'pinia';
import listing from '../../../fixtures/article-listing.json';
import details from '../../../fixtures/article-details.json';

const POSTS = listing.paginator?.data ?? [];

/**
 * `object` — who or what the listing is filtered BY.
 *
 * 🚨 It is `null` on an unfiltered listing, and that is exactly how the fixture
 * was captured, so returning the fixture as-is handed `null` to /blog/category
 * and /blog/author — where the default theme reads `res.object.name` and
 * `translateItemField(res.object, …)` and threw before rendering anything. The
 * live endpoint fills `object` in whenever `category` or `author` is set, so
 * the null was an artefact of how the fixture was taken, not the shape of the
 * answer.
 *
 * Both are derived from the fixture's own first post rather than invented, so
 * the heading agrees with the articles listed under it. Columns match what the
 * controller selects — an author is NOT translatable and a category is.
 */
const AUTHOR = {
    id: 1,
    name: POSTS[0]?.author ?? 'Staff Writer',
    introduce: '',
    avatar: null,
};

const CATEGORY = (() => {
    const first = POSTS[0]?.categories?.[0];
    return {
        id: first?.category_id ?? 1,
        image: first?.category_image ?? null,
        meta: [],
        translations: (first?.translations ?? []).map((t) => ({
            ...t,
            // The listing rows carry name+slug only; the detail endpoint selects
            // these two as well. Empty rather than absent, so a theme that lays
            // out a category description gets the empty state, not undefined.
            description: t.description ?? '',
            meta_title: t.meta_title ?? '',
            meta_description: t.meta_description ?? '',
        })),
    };
})();

export const usePostStore = defineStore('post', {
    state: () => ({ posts: [], article: {} }),
    actions: {
        async fetchPosts(params = {}) {
            this.posts = POSTS;

            // Same fixture page of articles either way — only `object` responds
            // to the filter, because that is the field a theme renders a header
            // from. Filtering the list itself would need the store's whole
            // article set, which this package does not ship.
            const object = params?.author ? AUTHOR : params?.category ? CATEGORY : null;

            return { ...listing, object };
        },

        async retrieveArticleDetails() {
            // 🚨 `.post`, not `.article`. The endpoint answers `{ post: {…} }`
            // and what reaches the theme is the POST itself —
            // `article.translations[0].title` and the rest.
            // Reading a non-existent `.article` key here fell back to the whole
            // wrapper, and every field the article page renders came out
            // undefined while the page itself looked like it had loaded.
            this.article = details.post ?? {};
            return this.article;
        },
    },
});
