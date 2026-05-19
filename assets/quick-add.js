import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { CartUpdateEvent, ThemeEvents, VariantSelectedEvent } from '@theme/events';
import { DialogComponent, DialogCloseEvent } from '@theme/dialog';
import { mediaQueryLarge, isMobileBreakpoint, getIOSVersion } from '@theme/utilities';

export class QuickAddComponent extends Component {
  /** @type {AbortController | null} */
  #abortController = null;
  /** @type {Map<string, Element>} */
  #cachedContent = new Map();
  /** @type {AbortController} */
  #cartUpdateAbortController = new AbortController();

  get productPageUrl() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    const hotspotProduct = /** @type {import('./product-hotspot').ProductHotspotComponent | null} */ (
      this.closest('product-hotspot-component')
    );
    const productLink = productCard?.getProductCardLink() || hotspotProduct?.getHotspotProductLink();

    if (!productLink?.href) return '';

    const url = new URL(productLink.href);

    if (url.searchParams.has('variant')) {
      return url.toString();
    }

    const selectedVariantId = this.#getSelectedVariantId();
    if (selectedVariantId) {
      url.searchParams.set('variant', selectedVariantId);
    }

    return url.toString();
  }

  /**
   * Gets the currently selected variant ID from the product card
   * @returns {string | null} The variant ID or null
   */
  #getSelectedVariantId() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    return productCard?.getSelectedVariantId() || null;
  }

  connectedCallback() {
    super.connectedCallback();

    mediaQueryLarge.addEventListener('change', this.#closeQuickAddModal);
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate, {
      signal: this.#cartUpdateAbortController.signal,
    });
    document.addEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    mediaQueryLarge.removeEventListener('change', this.#closeQuickAddModal);
    this.#abortController?.abort();
    this.#cartUpdateAbortController.abort();
    document.removeEventListener(ThemeEvents.variantSelected, this.#updateQuickAddButtonState.bind(this));
  }

  /**
   * Clears the cached content when cart is updated
   */
  #handleCartUpdate = () => {
    this.#cachedContent.clear();
  };

  /**
   * Handles quick add button click
   * @param {Event} event - The click event
   */
  handleClick = async (event) => {
    event.preventDefault();

    const quickAddMode = this.dataset.quickAddMode || 'popup';

    // Handle overlay mode
    if (quickAddMode === 'overlay') {
      const overlayPicker = this.querySelector('quick-add-overlay-variant-picker');
      if (overlayPicker instanceof QuickAddOverlayVariantPicker) {
        overlayPicker.show();
        return;
      }
    }

    // Default popup mode
    const currentUrl = this.productPageUrl;

    // Check if we have cached content for this URL
    let productGrid = this.#cachedContent.get(currentUrl);

    if (!productGrid) {
      // Fetch and cache the content
      const html = await this.fetchProductPage(currentUrl);
      if (html) {
        const gridElement = html.querySelector('[data-product-grid-content]');
        if (gridElement) {
          // Cache the cloned element to avoid modifying the original
          productGrid = /** @type {Element} */ (gridElement.cloneNode(true));
          this.#cachedContent.set(currentUrl, productGrid);
        }
      }
    }

    if (productGrid) {
      // Use a fresh clone from the cache
      const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
      await this.updateQuickAddModal(freshContent);
    }

    this.#openQuickAddModal();
  };

  /** @param {QuickAddDialog} dialogComponent */
  #stayVisibleUntilDialogCloses(dialogComponent) {
    this.toggleAttribute('stay-visible', true);

    dialogComponent.addEventListener(DialogCloseEvent.eventName, () => this.toggleAttribute('stay-visible', false), {
      once: true,
    });
  }

  #openQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    this.#stayVisibleUntilDialogCloses(dialogComponent);

    dialogComponent.showDialog();
  };

  #closeQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    dialogComponent.closeDialog();
  };

  /**
   * Fetches the product page content
   * @param {string} productPageUrl - The URL of the product page to fetch
   * @returns {Promise<Document | null>}
   */
  async fetchProductPage(productPageUrl) {
    if (!productPageUrl) return null;

    // We use this to abort the previous fetch request if it's still pending.
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      const response = await fetch(productPageUrl, {
        signal: this.#abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      return html;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      } else {
        throw error;
      }
    } finally {
      this.#abortController = null;
    }
  }

  /**
   * Re-renders the variant picker.
   * @param {Element} productGrid - The product grid element
   */
  async updateQuickAddModal(productGrid) {
    const modalContent = document.getElementById('quick-add-modal-content');

    if (!productGrid || !modalContent) return;

    if (isMobileBreakpoint()) {
      const productDetails = productGrid.querySelector('.product-details');
      const productFormComponent = productGrid.querySelector('product-form-component');
      const variantPicker = productGrid.querySelector('variant-picker');
      const productPrice = productGrid.querySelector('product-price');
      const productTitle = document.createElement('a');
      productTitle.textContent = this.dataset.productTitle || '';

      // Make product title as a link to the product page
      productTitle.href = this.productPageUrl;

      const productHeader = document.createElement('div');
      productHeader.classList.add('product-header');

      productHeader.appendChild(productTitle);
      if (productPrice) {
        productHeader.appendChild(productPrice);
      }
      productGrid.appendChild(productHeader);

      if (variantPicker) {
        productGrid.appendChild(variantPicker);
      }
      if (productFormComponent) {
        productGrid.appendChild(productFormComponent);
      }

      productDetails?.remove();
    }

    morph(modalContent, productGrid);

    this.#syncVariantSelection(modalContent);
  }

  /**
   * Updates the quick-add button state based on whether a swatch is selected
   * @param {VariantSelectedEvent} event - The variant selected event
   */
  #updateQuickAddButtonState(event) {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('product-card') !== this.closest('product-card')) return;
    const productOptionsCount = this.dataset.productOptionsCount;
    const quickAddButton = productOptionsCount === '1' ? 'add' : 'choose';
    this.setAttribute('data-quick-add-button', quickAddButton);
  }

  /**
   * Syncs the variant selection from the product card to the modal
   * @param {Element} modalContent - The modal content element
   */
  #syncVariantSelection(modalContent) {
    const selectedVariantId = this.#getSelectedVariantId();
    if (!selectedVariantId) return;

    // Find and check the corresponding input in the modal
    const modalInputs = modalContent.querySelectorAll('input[type="radio"][data-variant-id]');
    for (const input of modalInputs) {
      if (input instanceof HTMLInputElement && input.dataset.variantId === selectedVariantId && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

if (!customElements.get('quick-add-component')) {
  customElements.define('quick-add-component', QuickAddComponent);
}

class QuickAddDialog extends DialogComponent {
  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(ThemeEvents.cartUpdate, this.handleCartUpdate, { signal: this.#abortController.signal });
    this.addEventListener(ThemeEvents.variantUpdate, this.#updateProductTitleLink);

    this.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#abortController.abort();
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  /**
   * Closes the dialog
   * @param {CartUpdateEvent} event - The cart update event
   */
  handleCartUpdate = (event) => {
    if (event.detail.data.didError) return;
    this.closeDialog();
  };

  #updateProductTitleLink = (/** @type {CustomEvent} */ event) => {
    const anchorElement = /** @type {HTMLAnchorElement} */ (
      event.detail.data.html?.querySelector('.view-product-title a')
    );
    const viewMoreDetailsLink = /** @type {HTMLAnchorElement} */ (this.querySelector('.view-product-title a'));
    const mobileProductTitle = /** @type {HTMLAnchorElement} */ (this.querySelector('.product-header a'));

    if (!anchorElement) return;

    if (viewMoreDetailsLink) viewMoreDetailsLink.href = anchorElement.href;
    if (mobileProductTitle) mobileProductTitle.href = anchorElement.href;
  };

  #handleDialogClose = () => {
    const iosVersion = getIOSVersion();
    /**
     * This is a patch to solve an issue with the UI freezing when the dialog is closed.
     * To reproduce it, use iOS 16.0.
     */
    if (!iosVersion || iosVersion.major >= 17 || (iosVersion.major === 16 && iosVersion.minor >= 4)) return;

    requestAnimationFrame(() => {
      /** @type {HTMLElement | null} */
      const grid = document.querySelector('#ResultsList [product-grid-view]');
      if (grid) {
        const currentWidth = grid.getBoundingClientRect().width;
        grid.style.width = `${currentWidth - 1}px`;
        requestAnimationFrame(() => {
          grid.style.width = '';
        });
      }
    });
  };
}

if (!customElements.get('quick-add-dialog')) {
  customElements.define('quick-add-dialog', QuickAddDialog);
}

/**
 * Overlay variant picker component for sequential variant selection
 */
class QuickAddOverlayVariantPicker extends Component {
  /** @type {number} */
  #currentOptionIndex = 0;
  /** @type {Map<number, string>} */
  #selectedOptions = new Map();
  /** @type {Array<{id: string, options: string[]}>} */
  #variants = [];
  /** @type {HTMLElement | null} */
  #originalParent = null;
  /** @type {HTMLElement | null} */
  #quickAddComponent = null;
  /** @type {boolean} */
  #isSubmitting = false;

  connectedCallback() {
    super.connectedCallback();
    this.#loadVariantsData();
    this.#setupOptionButtons();
    
    // Add keyboard support (ESC to close)
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.hasAttribute('data-active')) {
        this.hide();
      }
    });
  }

  /**
   * Loads variants data from JSON script tag
   */
  #loadVariantsData() {
    const variantsDataElement = this.querySelector('.quick-add-overlay__variants-data');
    if (variantsDataElement) {
      try {
        const variantsData = JSON.parse(variantsDataElement.textContent || '[]');
        // Transform variants to include id and options array
        this.#variants = variantsData.map((variant) => ({
          id: variant.id?.toString() || '',
          options: variant.options || [],
          available: variant.available !== false,
        }));
      } catch (e) {
        console.error('Failed to parse variants data', e);
      }
    }
  }

  /**
   * Sets up event listeners for option buttons
   */
  #setupOptionButtons() {
    const optionGroups = this.querySelectorAll('.quick-add-overlay__option-group');
    optionGroups.forEach((group) => {
      const buttons = group.querySelectorAll('.quick-add-overlay__option-value');
      buttons.forEach((button) => {
        button.addEventListener('click', () => this.#handleOptionSelect(button));
      });
    });

    // Close overlay when clicking outside
    this.addEventListener('click', (e) => {
      // Only close if clicking directly on the overlay background, not on children
      if (e.target === this) {
        this.hide();
      }
    });
  }

  /**
   * Handles option selection
   * @param {HTMLElement} button - The clicked option button
   */
  #handleOptionSelect(button) {
    if (button.hasAttribute('disabled')) return;

    const optionGroup = button.closest('.quick-add-overlay__option-group');
    if (!optionGroup) return;

    const optionIndex = parseInt(optionGroup.dataset.optionIndex || '0', 10);
    const optionValue = button.dataset.optionValue || '';

    // Mark button as selected
    const allButtons = optionGroup.querySelectorAll('.quick-add-overlay__option-value');
    allButtons.forEach((btn) => {
      btn.setAttribute('data-selected', 'false');
    });
    button.setAttribute('data-selected', 'true');

    // Store selection
    this.#selectedOptions.set(optionIndex, optionValue);

    // Hide current option group
    optionGroup.setAttribute('data-active', 'false');

    // Check if we have more options
    const nextOptionIndex = optionIndex + 1;
    const nextOptionGroup = this.querySelector(
      `.quick-add-overlay__option-group[data-option-index="${nextOptionIndex}"]`
    );

    if (nextOptionGroup) {
      // Show next option group with available options based on current selections
      this.#showNextOptionGroup(nextOptionGroup, nextOptionIndex);
    } else {
      // All options selected - add to cart
      this.#addToCart();
    }
  }

  /**
   * Shows the next option group with filtered available options
   * @param {HTMLElement} optionGroup - The option group to show
   * @param {number} optionIndex - The index of the option
   */
  #showNextOptionGroup(optionGroup, optionIndex) {
    // Filter available options based on previous selections
    const availableOptions = this.#getAvailableOptionsForIndex(optionIndex);
    const buttons = optionGroup.querySelectorAll('.quick-add-overlay__option-value');

    buttons.forEach((button) => {
      const optionValue = button.dataset.optionValue || '';
      const isAvailable = availableOptions.includes(optionValue);
      button.toggleAttribute('disabled', !isAvailable);
    });

    optionGroup.setAttribute('data-active', 'true');
    this.#currentOptionIndex = optionIndex;
  }

  /**
   * Gets available option values for a given option index based on current selections
   * @param {number} optionIndex - The option index
   * @returns {string[]} Array of available option values
   */
  #getAvailableOptionsForIndex(optionIndex) {
    // Build selection array with current selections
    const selections = [];
    for (let i = 0; i < optionIndex; i++) {
      selections.push(this.#selectedOptions.get(i) || null);
    }

    // Find variants that match current selections and are available
    const matchingVariants = this.#variants.filter((variant) => {
      if (!variant.available) return false;
      return selections.every((selection, idx) => {
        if (selection === null) return true;
        // Compare option values (handle both string and number comparisons)
        const variantOption = variant.options[idx];
        return variantOption === selection || String(variantOption) === String(selection);
      });
    });

    // Extract unique option values for this index
    const availableOptions = new Set();
    matchingVariants.forEach((variant) => {
      if (variant.options[optionIndex]) {
        availableOptions.add(String(variant.options[optionIndex]));
      }
    });

    return Array.from(availableOptions);
  }

  /**
   * Adds selected variant to cart
   */
  async #addToCart() {
    // Prevent multiple submissions
    if (this.#isSubmitting) {
      return;
    }

    // Build selections array
    const selections = [];
    const optionGroups = this.querySelectorAll('.quick-add-overlay__option-group');
    optionGroups.forEach((group) => {
      const optionIndex = parseInt(group.dataset.optionIndex || '0', 10);
      selections[optionIndex] = this.#selectedOptions.get(optionIndex) || '';
    });

    // Find matching variant
    const matchingVariant = this.#variants.find((variant) => {
      return variant.options.every((option, idx) => {
        // Compare option values (handle both string and number comparisons)
        const selectedValue = selections[idx];
        return option === selectedValue || String(option) === String(selectedValue);
      });
    });

    if (!matchingVariant || !matchingVariant.available) {
      console.error('No matching variant found or variant unavailable');
      this.hide();
      return;
    }

    // Find the product form component - use stored reference if moved to body
    const quickAddComponent = this.#quickAddComponent || this.closest('quick-add-component');
    if (!quickAddComponent) {
      console.error('Quick add component not found');
      this.hide();
      return;
    }

    const productForm = quickAddComponent.querySelector('product-form-component');
    if (!productForm) {
      console.error('Product form component not found');
      this.hide();
      return;
    }

    // Set variant ID in hidden input
    const variantInput = quickAddComponent.querySelector('input[name="id"]');
    if (variantInput instanceof HTMLInputElement) {
      variantInput.value = matchingVariant.id;
      variantInput.removeAttribute('disabled');
    }

    // Submit the form
    const form = productForm.querySelector('form');
    if (form instanceof HTMLFormElement) {
      // Double check form isn't already submitting
      if (form.dataset.submitting === 'true') {
        return;
      }

      this.#isSubmitting = true;
      form.dataset.submitting = 'true';

      // Create and dispatch submit event to trigger product-form-component's handleSubmit
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Reset flag after a delay to allow form submission to complete
      setTimeout(() => {
        this.hide();
        this.#isSubmitting = false;
        delete form.dataset.submitting;
      }, 1000);
    }
  }

  /**
   * Shows the overlay and starts the selection process
   */
  show() {
    // Store reference to quick-add-component before moving
    if (!this.#quickAddComponent) {
      this.#quickAddComponent = this.closest('quick-add-component');
    }

    // On mobile, move to body to escape parent transform context (CSS-only doesn't work reliably)
    const isMobile = isMobileBreakpoint();
    if (isMobile && this.parentElement !== document.body) {
      this.#originalParent = this.parentElement;
      document.body.appendChild(this);
    }

    this.setAttribute('data-active', 'true');
    this.#currentOptionIndex = 0;
    this.#selectedOptions.clear();

    // Reset all option groups
    const optionGroups = this.querySelectorAll('.quick-add-overlay__option-group');
    optionGroups.forEach((group, index) => {
      group.setAttribute('data-active', index === 0 ? 'true' : 'false');
      const buttons = group.querySelectorAll('.quick-add-overlay__option-value');
      buttons.forEach((btn) => {
        btn.setAttribute('data-selected', 'false');
        // Enable all buttons in first group, filter others
        if (index === 0) {
          btn.removeAttribute('disabled');
        } else {
          // Will be filtered when shown
          btn.setAttribute('disabled', '');
        }
      });
    });

    // Focus the overlay for keyboard navigation
    this.focus();
  }

  /**
   * Hides the overlay
   */
  hide() {
    this.setAttribute('data-active', 'false');
    this.#currentOptionIndex = 0;
    this.#selectedOptions.clear();
    this.#isSubmitting = false;

    // Move back to original parent if it was moved to body
    if (this.#originalParent && this.parentElement === document.body) {
      this.#originalParent.appendChild(this);
      this.#originalParent = null;
      this.#quickAddComponent = null;
    }
  }
}

if (!customElements.get('quick-add-overlay-variant-picker')) {
  customElements.define('quick-add-overlay-variant-picker', QuickAddOverlayVariantPicker);
}
