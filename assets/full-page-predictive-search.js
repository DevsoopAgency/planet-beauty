import { debounce } from '@theme/utilities';
import { morph } from '@theme/morph';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * Full-page predictive search hub.
 * - Empty query: show curated content rendered server-side.
 * - Active query: fetch section-rendered predictive content and replace only results containers.
 */
class FullPagePredictiveSearch extends HTMLElement {
  /**
   * @type {AbortController | null}
   */
  #activeFetch = null;

  /**
   * @type {HTMLInputElement | null}
   */
  searchInput = null;

  /**
   * @type {HTMLButtonElement | null}
   */
  resetButton = null;

  /**
   * @type {HTMLElement | null}
   */
  keywordsContainer = null;

  /**
   * @type {HTMLElement | null}
   */
  productsContainer = null;

  /**
   * @type {HTMLElement | null}
   */
  articlesContainer = null;

  /**
   * @type {HTMLElement | null}
   */
  resultsContainer = null;

  /**
   * @type {HTMLElement | null}
   */
  #initialResultsNode = null;

  connectedCallback() {
    this.searchInput = /** @type {HTMLInputElement | null} */ (this.querySelector('[data-full-page-search-input]'));
    this.resetButton = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-full-page-search-reset]'));
    this.keywordsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-keywords]'));
    this.productsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-products]'));
    this.articlesContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-articles]'));
    this.resultsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-results]'));

    if (!this.searchInput || !this.resultsContainer) return;
    this.#initialResultsNode = /** @type {HTMLElement | null} */ (this.resultsContainer.cloneNode(true));

    this.addEventListener('click', this.#onKeywordClick);
    this.searchInput.addEventListener('input', this.#onInputChange);
    this.searchInput.addEventListener('keydown', this.#onInputKeyDown);

    if (this.resetButton) {
      this.resetButton.addEventListener('click', this.#onReset);
      this.#syncResetButton();
    }

    const initialTerm = this.searchInput.value.trim();
    if (initialTerm.length > 0) {
      this.#renderForTerm(initialTerm);
    }
  }

  disconnectedCallback() {
    this.#abortActiveFetch();
    this.removeEventListener('click', this.#onKeywordClick);
    this.searchInput?.removeEventListener('input', this.#onInputChange);
    this.searchInput?.removeEventListener('keydown', this.#onInputKeyDown);
    this.resetButton?.removeEventListener('click', this.#onReset);
  }

  #syncResetButton() {
    if (!this.resetButton || !this.searchInput) return;
    this.resetButton.hidden = this.searchInput.value.trim().length === 0;
  }

  /**
   * @param {Event} event
   */
  #onReset = (event) => {
    event.preventDefault();
    if (!this.searchInput) return;

    this.searchInput.value = '';
    this.#syncResetButton();
    this.searchInput.focus();
    this.#resetToInitialResults();
  };

  /**
   * @param {MouseEvent} event
   */
  #onKeywordClick = (event) => {
    const keywordButton = event.target instanceof HTMLElement
      ? event.target.closest('.predictive-search-keyword, .full-page-search-hub__query-button')
      : null;

    if (!keywordButton || !(keywordButton instanceof HTMLElement) || !this.searchInput) return;

    const keyword = keywordButton.dataset.keyword;
    if (!keyword) return;

    event.preventDefault();
    this.searchInput.value = keyword.trim();
    this.#syncResetButton();
    this.searchInput.focus();
    this.#renderForTerm(this.searchInput.value.trim());
  };

  /**
   * @param {KeyboardEvent} event
   */
  #onInputKeyDown = (event) => {
    if (event.key !== 'Enter' || !this.searchInput) return;

    event.preventDefault();
    const term = this.searchInput.value.trim();
    const url = new URL(Theme.routes.search_url, window.location.origin);
    url.searchParams.set('q', term);
    url.searchParams.set('type', 'product');
    window.location.href = url.toString();
  };

  #onInputChange = debounce(() => {
    if (!this.searchInput) return;
    const term = this.searchInput.value.trim();
    this.#syncResetButton();
    if (!term.length) {
      this.#resetToInitialResults();
      return;
    }
    this.#renderForTerm(term);
  }, 220);

  /**
   * @param {string} term
   */
  async #renderForTerm(term) {
    const sectionId = this.dataset.sectionId;
    if (!sectionId) return;

    const url = new URL(Theme.routes.predictive_search_url, window.location.origin);
    url.searchParams.set('q', term);
    url.searchParams.set('resources[limit_scope]', 'each');
    url.searchParams.set('resources[type]', 'product,article,query');
    url.searchParams.set('resources[limit]', '8');

    const controller = new AbortController();
    this.#abortActiveFetch();
    this.#activeFetch = controller;

    try {
      const html = await sectionRenderer.getSectionHTML(sectionId, false, url);
      if (controller.signal.aborted) return;
      if (!html) return;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextResults = doc.querySelector('[data-full-page-search-results]');
      const nextKeywords = doc.querySelector('[data-full-page-search-keywords]');
      const nextProducts = doc.querySelector('[data-full-page-search-products]');
      const nextArticles = doc.querySelector('[data-full-page-search-articles]');

      // Prefer morphing the single shared results container to stay in sync with section-rendered markup.
      if (nextResults && this.resultsContainer) {
        morph(this.resultsContainer, nextResults);
        this.keywordsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-keywords]'));
        this.productsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-products]'));
        this.articlesContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-articles]'));
        this.resultsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-results]'));
        return;
      }

      if (nextKeywords && this.keywordsContainer) morph(this.keywordsContainer, nextKeywords);
      if (nextProducts && this.productsContainer) morph(this.productsContainer, nextProducts);
      if (nextArticles && this.articlesContainer) morph(this.articlesContainer, nextArticles);
    } catch (error) {
      if (controller.signal.aborted) return;
      // Fail quietly to avoid breaking typing interactions if predictive endpoint fails.
      console.warn('Full page predictive search failed', error);
    }
  }

  #abortActiveFetch() {
    if (this.#activeFetch) {
      this.#activeFetch.abort();
      this.#activeFetch = null;
    }
  }

  #resetToInitialResults() {
    this.#abortActiveFetch();
    if (!this.resultsContainer || !this.#initialResultsNode) return;

    const nextInitial = /** @type {HTMLElement} */ (this.#initialResultsNode.cloneNode(true));
    morph(this.resultsContainer, nextInitial);

    this.keywordsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-keywords]'));
    this.productsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-products]'));
    this.articlesContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-articles]'));
    this.resultsContainer = /** @type {HTMLElement | null} */ (this.querySelector('[data-full-page-search-results]'));
  }
}

if (!customElements.get('full-page-predictive-search')) {
  customElements.define('full-page-predictive-search', FullPagePredictiveSearch);
}
