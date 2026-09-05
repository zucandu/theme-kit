/**
 * Blog store — article listing and article detail.
 *
 * The slug argument is ignored: one captured article is enough to lay out the
 * detail page, and resolving arbitrary slugs would mean shipping the store's
 * whole article set.
 */
import { defineStore } from 'pinia';
import listing from '../../../fixtures/article-listing.json';
import details from '../../../fixtures/article-details.json';

export const usePostStore = defineStore('post', {
    state: () => ({ posts: [], article: {} }),
    actions: {
        async fetchPosts() {
            this.posts = listing.paginator?.data ?? [];
            return listing;
        },
        async retrieveArticleDetails() {
            this.article = details.article ?? details;
            return this.article;
        },
    },
});
