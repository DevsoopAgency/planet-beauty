import { OverflowList } from '@theme/overflow-list';
import VariantPicker from '@theme/variant-picker';
import { Component } from '@theme/component';
import { debounce, isDesktopBreakpoint, mediaQueryLarge, requestYieldCallback } from '@theme/utilities';
import { ThemeEvents, VariantSelectedEvent, VariantUpdateEvent, SlideshowSelectEvent } from '@theme/events';
import { morph } from '@theme/morph';

/**
 * A custom element that displays a product card.
 *
 * @typedef {object} Refs
 * @property {HTMLAnchorElement} productCardLink - The product card link element.
 * @property {import('slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {import('quick-add').QuickAddComponent} [quickAdd] - The quick add component.
 * @property {HTMLElement} [cardGallery] - The card gallery component.
 *
 * @extends {Component<Refs>}
 */
export class ProductCard extends Component {
  requiredRefs = ['productCardLink'];

  get productPageUrl() {
    return this.refs.productCardLink.href;
  }

  /**
   * Gets the currently selected variant ID from the product card
   * @returns {string | null} The variant ID or null if none selected
   */
  getSelectedVariantId() {
    const checkedInput = /** @type {HTMLInputElement | null} */ (
      this.querySelector('input[type="radio"]:checked[data-variant-id]')
    );

    return checkedInput?.dataset.variantId || null;
  }

  /**
   * Gets the product card link element
   * @returns {HTMLAnchorElement | null} The product card link or null
   */
  getProductCardLink() {
    return this.refs.productCardLink || null;
  }

  #fetchProductPageHandler = () => {
    this.refs.quickAdd?.fetchProductPage(this.productPageUrl);
  };

  /**
   * Navigates to a URL link. Respects modifier keys for opening in new tab/window.
   * @param {Event} event - The event that triggered the navigation.
   * @param {URL} url - The URL to navigate to.
   */
  #navigateToURL = (event, url) => {
    // Check for modifier keys that should open in new tab/window (only for mouse events)
    const shouldOpenInNewTab =
      event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1);

    if (shouldOpenInNewTab) {
      event.preventDefault();
      window.open(url.href, '_blank');
      return;
    } else {
      window.location.href = url.href;
    }
  };

  connectedCallback() {
    super.connectedCallback();

    const link = this.refs.productCardLink;
    if (!(link instanceof HTMLAnchorElement)) throw new Error('Product card link not found');
    this.#handleQuickAdd();

    this.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate);
    this.addEventListener(ThemeEvents.variantSelected, this.#handleVariantSelected);
    this.addEventListener(SlideshowSelectEvent.eventName, this.#handleSlideshowSelect);
    mediaQueryLarge.addEventListener('change', this.#handleQuickAdd);

    this.addEventListener('click', this.navigateToProduct);

    // Preload the next image on the slideshow to avoid white flashes on previewImage
    setTimeout(() => {
      if (this.refs.slideshow?.isNested) {
        this.#preloadNextPreviewImage();
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.navigateToProduct);
  }

  #preloadNextPreviewImage() {
    const currentSlide = this.refs.slideshow?.slides?.[this.refs.slideshow?.current];
    currentSlide?.nextElementSibling?.querySelector('img[loading="lazy"]')?.removeAttribute('loading');
  }

  /**
   * Handles the quick add event.
   */
  #handleQuickAdd = () => {
    this.removeEventListener('pointerenter', this.#fetchProductPageHandler);
    this.removeEventListener('focusin', this.#fetchProductPageHandler);

    if (isDesktopBreakpoint()) {
      this.addEventListener('pointerenter', this.#fetchProductPageHandler);
      this.addEventListener('focusin', this.#fetchProductPageHandler);
    }
  };

  /**
   * Gets the button variant picker component.
   * @returns {VariantPicker | null} The button variant picker component.
   */
  get buttonVariantPicker() {
    return this.querySelector('product-card-variant-picker');
  }

  /**
   * Handles the variant selected event.
   * @param {VariantSelectedEvent} event - The variant selected event.
   */
  #handleVariantSelected = (event) => {
    if (event.target !== this.variantPicker) {
      this.variantPicker?.updateSelectedOption(event.detail.resource.id);
    }
    // Sync button picker when swatch changes
    if (event.target === this.variantPicker && this.buttonVariantPicker) {
      const optionId = event.detail.resource.id;
      const buttonInput = this.buttonVariantPicker.querySelector(`[data-option-value-id="${optionId}"]`);
      if (buttonInput) {
        this.buttonVariantPicker.updateSelectedOption(optionId);
      }
    }
    // Sync swatch picker when button changes
    if (event.target === this.buttonVariantPicker && this.variantPicker) {
      const optionId = event.detail.resource.id;
      const swatchInput = this.variantPicker.querySelector(`[data-option-value-id="${optionId}"]`);
      if (swatchInput) {
        this.variantPicker.updateSelectedOption(optionId);
      }
    }
  };

  /**
   * Handles the variant update event.
   * Updates price, checks for unavailable variants, and updates product URL.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    // Stop the event from bubbling up to the section, variant updates triggered from product cards are fully handled
    // by this component and should not affect anything outside the card.
    event.stopPropagation();

    this.updatePrice(event);
    this.#isUnavailableVariantSelected(event);
    this.#updateProductUrl(event);
    this.refs.quickAdd?.fetchProductPage(this.productPageUrl);

    if (event.target !== this.variantPicker) {
      this.variantPicker?.updateVariantPicker(event.detail.data.html);
    }

    this.#updateVariantImages();
    this.#previousSlideIndex = null;

    // Remove attribute after re-rendering since a variant selection has been made
    this.removeAttribute('data-no-swatch-selected');

    // Force overflow list to reflow after variant update
    // This fixes an issue where the overflow counter doesn't update properly in some browsers
    this.#updateOverflowList();
  };

  /**
   * Forces the overflow list to recalculate by dispatching a reflow event.
   * This ensures the overflow counter displays correctly after variant updates.
   */
  #updateOverflowList() {
    // Find the overflow list in the variant picker
    const overflowList = this.querySelector('swatches-variant-picker-component overflow-list');
    const isActiveOverflowList = overflowList?.querySelector('[slot="overflow"]') ? true : false;
    if (!overflowList || !isActiveOverflowList) return;

    // Use requestAnimationFrame to ensure DOM has been updated
    requestAnimationFrame(() => {
      // Dispatch a reflow event to trigger recalculation
      overflowList.dispatchEvent(
        new CustomEvent('reflow', {
          bubbles: true,
          detail: {},
        })
      );
    });
  }

  /**
   * Updates the DOM with a new price.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updatePrice(event) {
    const priceContainer = this.querySelectorAll(`product-price [ref='priceContainer']`)[1];
    const newPriceElement = event.detail.data.html.querySelector(`product-price [ref='priceContainer']`);

    if (newPriceElement && priceContainer) {
      morph(priceContainer, newPriceElement);
    }
  }

  /**
   * Updates the product URL based on the variant update event.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #updateProductUrl(event) {
    const anchorElement = event.detail.data.html?.querySelector('product-card a');
    const featuredMediaUrl = event.detail.data.html
      ?.querySelector('product-card-link')
      ?.getAttribute('data-featured-media-url');

    // If the product card is inside a product link, update the product link's featured media URL
    if (featuredMediaUrl && this.closest('product-card-link'))
      this.closest('product-card-link')?.setAttribute('data-featured-media-url', featuredMediaUrl);

    if (anchorElement instanceof HTMLAnchorElement) {
      // If the href is empty, don't update the product URL eg: unavailable variant
      if (anchorElement.getAttribute('href')?.trim() === '') return;

      const productUrl = anchorElement.href;
      const { productCardLink, productTitleLink, cardGalleryLink } = this.refs;

      productCardLink.href = productUrl;
      if (cardGalleryLink instanceof HTMLAnchorElement) {
        cardGalleryLink.href = productUrl;
      }
      if (productTitleLink instanceof HTMLAnchorElement) {
        productTitleLink.href = productUrl;
      }
    }
  }

  /**
   * Checks if an unavailable variant is selected.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #isUnavailableVariantSelected(event) {
    const allVariants = /** @type {NodeListOf<HTMLInputElement>} */ (
      event.detail.data.html.querySelectorAll('input:checked')
    );

    for (const variant of allVariants) {
      this.#toggleAddToCartButton(variant.dataset.optionAvailable === 'true');
    }
  }

  /**
   * Toggles the add to cart button state.
   * @param {boolean} enable - Whether to enable or disable the button.
   */
  #toggleAddToCartButton(enable) {
    const addToCartButton = this.querySelector('.add-to-cart__button button');

    if (addToCartButton instanceof HTMLButtonElement) {
      addToCartButton.disabled = !enable;
    }
  }

  /**
   * Hide the variant images that are not for the selected variant.
   */
  #updateVariantImages() {
    const { slideshow } = this.refs;
    if (!this.variantPicker?.selectedOption) {
      return;
    }

    const selectedImageId = this.variantPicker?.selectedOption.dataset.optionMediaId;

    if (slideshow && selectedImageId) {
      const { slides = [] } = slideshow.refs;

      for (const slide of slides) {
        if (slide.getAttribute('variant-image') == null) continue;

        slide.hidden = slide.getAttribute('slide-id') !== selectedImageId;
      }

      slideshow.select({ id: selectedImageId }, undefined, { animate: false });
    }
  }

  /**
   * Gets all variant inputs.
   * @returns {NodeListOf<HTMLInputElement>} All variant input elements.
   */
  get allVariants() {
    return this.querySelectorAll('input[data-variant-id]');
  }

  /**
   * Gets the variant picker component.
   * @returns {VariantPicker | null} The variant picker component.
   */
  get variantPicker() {
    return this.querySelector('swatches-variant-picker-component');
  }
  /** @type {number | null} */
  #previousSlideIndex = null;

  /**
   * Handles the slideshow select event.
   * @param {SlideshowSelectEvent} event - The slideshow select event.
   */
  #handleSlideshowSelect = (event) => {
    if (event.detail.userInitiated) {
      this.#previousSlideIndex = event.detail.index;
    }
  };

  /**
   * Previews a variant.
   * @param {string} id - The id of the variant to preview.
   */
  previewVariant(id) {
    const { slideshow } = this.refs;

    if (!slideshow) return;

    this.resetVariant.cancel();
    slideshow.select({ id }, undefined, { animate: false });
  }

  /**
   * Previews the next image.
   * @param {PointerEvent} event - The pointer event.
   */
  previewImage(event) {
    if (event.pointerType !== 'mouse') return;

    const { slideshow } = this.refs;

    if (!slideshow) return;

    this.resetVariant.cancel();

    if (this.#previousSlideIndex != null && this.#previousSlideIndex > 0) {
      slideshow.select(this.#previousSlideIndex, undefined, { animate: false });
    } else {
      slideshow.next(undefined, { animate: false });
      setTimeout(() => this.#preloadNextPreviewImage());
    }
  }

  /**
   * Resets the image to the variant image.
   * @param {PointerEvent} event - The pointer event.
   */
  resetImage(event) {
    if (event.pointerType !== 'mouse') return;

    const { slideshow } = this.refs;

    if (!this.variantPicker) {
      if (!slideshow) return;
      slideshow.previous(undefined, { animate: false });
    } else {
      this.#resetVariant();
    }
  }

  /**
   * Resets the image to the variant image.
   */
  #resetVariant = () => {
    const { slideshow } = this.refs;

    if (!slideshow) return;

    // If we have a selected variant, always use its image
    if (this.variantPicker?.selectedOption) {
      const id = this.variantPicker.selectedOption.dataset.optionMediaId;
      if (id) {
        slideshow.select({ id }, undefined, { animate: false });
        return;
      }
    }

    // No variant selected - use initial slide if it's valid
    const initialSlide = slideshow.initialSlide;
    const slideId = initialSlide?.getAttribute('slide-id');
    if (initialSlide && slideshow.slides?.includes(initialSlide) && slideId) {
      slideshow.select({ id: slideId }, undefined, { animate: false });
      return;
    }

    // No valid initial slide or selected variant - go to previous
    slideshow.previous(undefined, { animate: false });
  };

  /**
   * Intercepts the click event on the product card anchor, we want
   * to use this to add an intermediate state to the history.
   * This intermediate state captures the page we were on so that we
   * navigate back to the same page when the user navigates back.
   * In addition to that, it captures the product card anchor so that we
   * have the specific product card in view.
   *
   * A product card can have other interactive elements like variant picker,
   * so we do not navigate if the click was on one of those elements.
   *
   * @param {Event} event
   */
  navigateToProduct = (event) => {
    if (!(event.target instanceof Element)) return;

    // Don't navigate if this product card is marked as no-navigation (e.g., in theme editor)
    if (this.hasAttribute('data-no-navigation')) return;

    const interactiveElement = event.target.closest('button, input, label, select, [tabindex="1"]');

    // If the click was on an interactive element, do nothing.
    if (interactiveElement) {
      return;
    }

    const link = this.refs.productCardLink;
    if (!link.href) return;
    const linkURL = new URL(link.href);

    const productCardAnchor = link.getAttribute('id');
    if (!productCardAnchor) return;

    const infiniteResultsList = this.closest('results-list[infinite-scroll="true"]');
    if (!window.Shopify.designMode && infiniteResultsList) {
      const url = new URL(window.location.href);
      const parent = this.closest('li');
      url.hash = productCardAnchor;
      if (parent && parent.dataset.page) {
        url.searchParams.set('page', parent.dataset.page);
      }

      requestYieldCallback(() => {
        history.replaceState({}, '', url.toString());
      });
    }

    const targetLink = event.target.closest('a');
    // Let the native navigation handle the click if it was on a link.
    if (!targetLink) {
      this.#navigateToURL(event, linkURL);
    }
  };

  /**
   * Resets the variant.
   */
  resetVariant = debounce(this.#resetVariant, 100);
}

if (!customElements.get('product-card')) {
  customElements.define('product-card', ProductCard);
}

/**
 * A custom element that displays a variant picker with swatches.
 * @typedef {import('@theme/variant-picker').VariantPickerRefs & {overflowList: HTMLElement}} SwatchesRefs
 */

/**
 * @extends {VariantPicker<SwatchesRefs>}
 */
class SwatchesVariantPickerComponent extends VariantPicker {
  connectedCallback() {
    super.connectedCallback();

    // Cache the parent product card
    this.parentProductCard = this.closest('product-card');

    // Listen for variant updates to apply pending URL changes
    this.addEventListener(ThemeEvents.variantUpdate, this.#handleCardVariantUrlUpdate.bind(this));
  }

  /**
   * Updates the card URL when a variant is selected.
   */
  #handleCardVariantUrlUpdate() {
    if (this.pendingVariantId && this.parentProductCard instanceof ProductCard) {
      const currentUrl = new URL(this.parentProductCard.refs.productCardLink.href);
      currentUrl.searchParams.set('variant', this.pendingVariantId);
      this.parentProductCard.refs.productCardLink.href = currentUrl.toString();
      this.pendingVariantId = null;
    }
  }

  /**
   * Override the variantChanged method to handle unavailable swatches with available alternatives.
   * @param {Event} event - The variant change event.
   */
  variantChanged(event) {
    if (!(event.target instanceof HTMLElement)) return;

    // Check if this is a swatch input
    const isSwatchInput = event.target instanceof HTMLInputElement && event.target.name?.includes('-swatch');
    const clickedSwatch = event.target;
    const availableCount = parseInt(clickedSwatch.dataset.availableCount || '0');
    const firstAvailableVariantId = clickedSwatch.dataset.firstAvailableOrFirstVariantId;

    // For swatch inputs, check if we need special handling
    if (isSwatchInput && availableCount > 0 && firstAvailableVariantId) {
      // If this is an unavailable variant but there are available alternatives
      // Prevent the default handling
      event.stopPropagation();

      // Update the selected option visually
      this.updateSelectedOption(clickedSwatch);

      // Build request URL with the first available variant
      const productUrl = this.dataset.productUrl?.split('?')[0];

      if (!productUrl) return;

      const url = new URL(productUrl, window.location.origin);
      url.searchParams.set('variant', firstAvailableVariantId);
      url.searchParams.set('section_id', 'section-rendering-product-card');

      const requestUrl = url.href;

      // Store the variant ID we want to apply to the URL
      this.pendingVariantId = firstAvailableVariantId;

      // Use parent's fetch method
      this.fetchUpdatedSection(requestUrl);
      return;
    }

    // Check if we have a button picker to combine with
    const buttonPicker = this.parentProductCard instanceof ProductCard ? this.parentProductCard.buttonVariantPicker : null;
    
    if (buttonPicker) {
      // Combine swatch selection with button selections
      const selectedOption = event.target instanceof HTMLSelectElement 
        ? event.target.options[event.target.selectedIndex] 
        : event.target;
      if (!selectedOption) return;

      this.updateSelectedOption(event.target);
      this.dispatchEvent(new VariantSelectedEvent({ id: selectedOption.dataset.optionValueId ?? '' }));

      // Build URL with combined selections
      const productUrl = this.dataset.productUrl?.split('?')[0];
      if (!productUrl) return;
      
      const url = new URL(productUrl, window.location.origin);
      const optionValues = [];
      
      // Add swatch selection
      if (selectedOption.dataset.optionValueId) {
        optionValues.push(selectedOption.dataset.optionValueId);
      }
      
      // Add button selections
      const buttonSelections = Array.from(buttonPicker.querySelectorAll('input:checked'))
        .map(input => input instanceof HTMLElement ? input.dataset.optionValueId : null)
        .filter(Boolean);
      
      optionValues.push(...buttonSelections);
      
      // Set option_values or variant
      if (optionValues.length > 0) {
        url.searchParams.set('option_values', optionValues.join(','));
      } else if (selectedOption.dataset.variantId) {
        url.searchParams.set('variant', selectedOption.dataset.variantId);
      }
      
      url.searchParams.set('section_id', 'section-rendering-product-card');
      this.fetchUpdatedSection(url.href);
      return;
    }

    // For all other cases, use the default behavior
    super.variantChanged(event);
  }

  /**
   * Shows all swatches.
   * @param {Event} [event] - The event that triggered the show all swatches.
   */
  showAllSwatches(event) {
    event?.preventDefault();

    const { overflowList } = this.refs;

    if (overflowList instanceof OverflowList) {
      overflowList.showAll();
    }
  }
}

if (!customElements.get('swatches-variant-picker-component')) {
  customElements.define('swatches-variant-picker-component', SwatchesVariantPickerComponent);
}

/**
 * ProductCardVariantPicker - extends VariantPicker for button-style variant selection
 * Integrates with swatches and syncs selections
 */
class ProductCardVariantPicker extends VariantPicker {
  connectedCallback() {
    super.connectedCallback();
    this.parentProductCard = this.closest('product-card');
  }

  variantChanged(/** @type {Event} */ event) {
    if (!(event.target instanceof HTMLElement)) return;
    
    const selectedOption = event.target instanceof HTMLSelectElement 
      ? event.target.options[event.target.selectedIndex] 
      : event.target;
    if (!selectedOption) return;

    // Update visual state
    this.updateSelectedOption(event.target);
    this.dispatchEvent(new VariantSelectedEvent({ id: selectedOption.dataset.optionValueId ?? '' }));

    // Get swatch picker if exists
    const swatchPicker = this.parentProductCard instanceof ProductCard ? this.parentProductCard.variantPicker : null;
    
    // Build URL with combined selections
    const productUrl = this.dataset.productUrl?.split('?')[0];
    if (!productUrl) return;
    
    const url = new URL(productUrl, window.location.origin);
    const optionValues = [];
    
    // Add swatch selection if exists
    if (swatchPicker) {
      const swatchSelections = Array.from(swatchPicker.querySelectorAll('input:checked'))
        .map(input => input instanceof HTMLElement ? input.dataset.optionValueId : null)
        .filter(Boolean);
      optionValues.push(...swatchSelections);
    }
    
    // Add button selections
    const buttonSelections = Array.from(this.querySelectorAll('input:checked'))
      .map(input => input instanceof HTMLElement ? input.dataset.optionValueId : null)
      .filter(Boolean);
    
    optionValues.push(...buttonSelections);
    
    // Set option_values or variant
    if (optionValues.length > 0) {
      url.searchParams.set('option_values', optionValues.join(','));
    } else if (selectedOption.dataset.variantId) {
      url.searchParams.set('variant', selectedOption.dataset.variantId);
    }
    
    url.searchParams.set('section_id', 'section-rendering-product-card');
    
    // Fetch and dispatch VariantUpdateEvent properly
    this.fetchUpdatedSection(url.href);
  }

  /**
   * Override fetchUpdatedSection to handle product card response format and dispatch VariantUpdateEvent
   * @param {string} requestUrl - The request URL
   * @param {string} [morphElementSelector] - The selector of the element to be morphed
   */
  fetchUpdatedSection(requestUrl, morphElementSelector) {
    // Call parent to abort previous request
    super.fetchUpdatedSection(requestUrl, morphElementSelector);
    
    // We need to intercept the fetch to handle product card format
    // Since we can't access private #abortController, we'll use our own
    const abortController = new AbortController();

    fetch(requestUrl, { signal: abortController.signal })
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        html.querySelector('overflow-list[defer]')?.removeAttribute('defer');

        // Get variant data from product card response format
        const variantScript = html.querySelector('product-card variant-picker script[type="application/json"]') ||
                             html.querySelector('product-card-variant-picker script[type="application/json"]') ||
                             html.querySelector('variant-picker script[type="application/json"]') ||
                             html.querySelector('script[type="application/json"]');
        
        const variant = variantScript ? JSON.parse(variantScript.textContent || '{}') : null;

        // Check for new product (combined listings)
        const newProductCard = html.querySelector('product-card');
        let newProduct = undefined;
        if (newProductCard instanceof HTMLElement) {
          const newProductId = newProductCard.dataset.productId;
          const productLink = newProductCard.querySelector('a[ref="productCardLink"]');
          const newProductUrl = productLink instanceof HTMLAnchorElement ? productLink.href : undefined;
          if (newProductId && newProductUrl && this.dataset.productId !== newProductId) {
            newProduct = { id: newProductId, url: newProductUrl };
          }
        }

        // Update variant picker visually
        const newVariantPicker = html.querySelector('product-card-variant-picker');
        if (newVariantPicker) {
          morph(this, newVariantPicker);
        }

        // Dispatch VariantUpdateEvent so buy buttons can update
        if (this.selectedOptionId) {
          this.dispatchEvent(
            new VariantUpdateEvent(variant, this.selectedOptionId, {
              html,
              productId: this.dataset.productId ?? '',
              newProduct,
            })
          );
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.warn('Fetch aborted by user');
        } else {
          console.error('Error fetching variant update:', error);
          // Dispatch event with null variant to disable button on error
          if (this.selectedOptionId) {
            this.dispatchEvent(
              new VariantUpdateEvent(null, this.selectedOptionId, {
                html: new DOMParser().parseFromString('', 'text/html'),
                productId: this.dataset.productId ?? '',
              })
            );
          }
        }
      });
  }
}

if (!customElements.get('product-card-variant-picker')) {
  customElements.define('product-card-variant-picker', ProductCardVariantPicker);
}
