import { ThemeEvents } from '@theme/events';

/**
 * Live-theme parity: fetch pickup-availability section per variant and toggle store list.
 */
class StorePickupAvailability {
  /** @type {HTMLElement | null} */
  #target = null;

  /** @type {((event: Event) => void) | null} */
  #toggleHandler = null;

  init() {
    this.#target = document.querySelector('[data-store-availability-container]');
    if (!this.#target) return;

    const initialVariantId = this.#target.dataset.initialVariantId;
    if (initialVariantId) {
      this.#checkAvailability(initialVariantId);
    }

    document.addEventListener(ThemeEvents.variantUpdate, (event) => {
      const variantId = event.detail?.resource?.id;
      if (variantId) {
        this.#checkAvailability(String(variantId));
      }
    });
  }

  /**
   * @param {string} variantId
   */
  #checkAvailability(variantId) {
    if (!this.#target) return;

    fetch(`/variants/${variantId}/?section_id=pickup-availability`)
      .then((response) => response.text())
      .then((html) => {
        if (!this.#target) return;

        const section = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
        if (!section) return;

        const list = section.querySelector('[data-pickup-availability-list]');
        if (list) {
          const items = Array.from(list.querySelectorAll('li')).map((item) => item.innerHTML);
          items.sort();
          list.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
        }

        this.#target.innerHTML = '';
        this.#target.appendChild(section);
        this.#bindToggle();
      })
      .catch((error) => {
        console.error(error);
      });
  }

  #bindToggle() {
    const button = document.querySelector('[data-view-more]');
    const list = document.querySelector('[data-pickup-availability-list]');

    if (!button || !list || button.disabled) return;

    if (this.#toggleHandler) {
      button.removeEventListener('click', this.#toggleHandler);
    }

    this.#toggleHandler = () => {
      if (button.classList.contains('active')) {
        button.classList.remove('active');
        list.style.maxHeight = '';
        button.setAttribute('aria-expanded', 'false');
      } else {
        button.classList.add('active');
        list.style.maxHeight = `${list.scrollHeight}px`;
        button.setAttribute('aria-expanded', 'true');
      }
    };

    button.addEventListener('click', this.#toggleHandler);
  }
}

new StorePickupAvailability().init();
