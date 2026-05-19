class StickyAddToCart extends HTMLElement {

    constructor() {

      super();

      this.stickyClass = 'show';

      this.position = this.dataset.position || 'bottom';

      this.productVariants = null;

      

      // Bind handlers once to preserve context

      this.onScrollHandler = this.handleScroll.bind(this);

      this.addToCartHandler = this.handleAddToCart.bind(this);

      this.variantChangeHandler = this.handleVariantChange.bind(this);

      this.quantityChangeHandler = this.handleQuantityChange.bind(this);

      this.stickyVariantChangeHandler = this.handleStickyVariantChange.bind(this);

      this.variantUpdateHandler = this.handleVariantUpdate.bind(this);

    }

  

    connectedCallback() {

      // Add event listeners

      window.addEventListener('scroll', this.onScrollHandler, { passive: true });

      

      // Button click handler - updated selector

      const addToCartButton = this.querySelector('.sticky-add-button');

      if (addToCartButton) {

        addToCartButton.addEventListener('click', this.addToCartHandler);

      }

      

      // Listen for custom event

      document.addEventListener('sticky-add-to-cart:click', this.addToCartHandler);

      

      // Listen for variant:update event from the theme

      document.addEventListener('variant:update', this.variantUpdateHandler);

      

      // Set up variant listeners

      this.setupVariantObserver();

      this.setupVariantChangeListeners();

      this.setupStickyVariantChangeListeners();

      

      // Set up quantity sync

      this.setupQuantitySync();

      

      // Load product variants data

      this.loadProductVariants();

      

      // Initialize

      this.updateStickyBarVariant();

      this.handleScroll();

      

      // Debug: Log variant picker information

      setTimeout(() => {

        this.debugVariantPickers();

      }, 100);

    }

  

    disconnectedCallback() {

      // Remove scroll listener

      window.removeEventListener('scroll', this.onScrollHandler);

      

      // Remove button listener - updated selector

      const addToCartButton = this.querySelector('.sticky-add-button');

      if (addToCartButton) {

        addToCartButton.removeEventListener('click', this.addToCartHandler);

      }

      

      // Remove custom event listener

      document.removeEventListener('sticky-add-to-cart:click', this.addToCartHandler);

      

      // Remove variant:update listener

      document.removeEventListener('variant:update', this.variantUpdateHandler);

      

      // Remove variant listeners

      this.removeVariantListeners();

      this.removeStickyVariantListeners();

      

      // Remove quantity listeners

      this.removeQuantityListeners();

      

      // Disconnect observer

      if (this.variantObserver) {

        this.variantObserver.disconnect();

      }

    }



    /**

     * Load product variants from the page

     */

    loadProductVariants() {

      // Try to get variants from the product JSON in the page

      const productJson = document.querySelector('[data-product-json]');

      if (productJson) {

        try {

          const product = JSON.parse(productJson.textContent || '{}');

          this.productVariants = product.variants || null;

        } catch (e) {

          console.warn('Could not parse product JSON for sticky add-to-cart');

        }

      }

    }



    /**

     * Handle the variant:update event from the theme

     * @param {CustomEvent} event

     */

    handleVariantUpdate(event) {

      if (!event.detail || !event.detail.resource) return;

      

      const newVariantId = event.detail.resource.id;

      if (!newVariantId) return;

      

      // Update the sticky form's variant ID

      const stickyVariantIdInput = this.querySelector('[name="id"]');

      if (stickyVariantIdInput instanceof HTMLInputElement) {

        stickyVariantIdInput.value = String(newVariantId);

      }

      

      // Sync the sticky variant picker with the main picker

      this.syncStickyVariantPicker();

      

      // Update other elements

      this.updateVariantTitle();

      this.updateStickyBarPrice();

      

      // Update button state

      const mainForm = document.querySelector('product-form-component form') ||

                      document.querySelector('product-form form') ||

                      document.querySelector('form[data-type="add-to-cart-form"]');

      if (mainForm) {

        this.updateAvailabilityStatus(mainForm);

      }

    }

    

    setupVariantObserver() {

      // Use MutationObserver to watch variant ID changes

      const mainForm = document.querySelector('product-form-component form') ||

                      document.querySelector('product-form form') ||

                      document.querySelector('form[data-type="add-to-cart-form"]');

      

      if (!mainForm) return;

      

      const variantIdInput = mainForm.querySelector('[name="id"]');

      if (!variantIdInput) return;

      

      this.variantObserver = new MutationObserver((mutations) => {

        for (const mutation of mutations) {

          if (mutation.type === 'attributes' && mutation.attributeName === 'value') {

            this.updateStickyBarVariant();

            break;

          }

        }

      });

      

      this.variantObserver.observe(variantIdInput, { 

        attributes: true, 

        attributeFilter: ['value'] 

      });

    }

  

    setupVariantChangeListeners() {

      // Common selector for all variant inputs

      const variantInputSelectors = [

        '.product-form__input select',

        '.product-form__input input[type="radio"]',

        '.js-change-variant',

        '.swatch input',

        '.swatch-element',

        '.single-option-selector',

        'variant-picker select',

        'variant-picker input[type="radio"]'

      ].join(', ');

      

      // Add listeners to all variant controls

      document.querySelectorAll(variantInputSelectors).forEach(el => {

        el.addEventListener('change', this.variantChangeHandler);

        

        // Also listen for clicks on radios and swatches

        if ((el instanceof HTMLInputElement && el.type === 'radio') || 

            el.classList.contains('swatch-element') || 

            el.classList.contains('js-change-variant')) {

          el.addEventListener('click', this.variantChangeHandler);

        }

      });

      

      // Listen for common variant change events

      ['variant:change', 'variant:changed', 'property_select:change'].forEach(eventName => {

        document.addEventListener(eventName, this.variantChangeHandler);

      });

      

      // Listen for form changes

      const productForm = document.querySelector('product-form-component') ||

                         document.querySelector('product-form') || 

                         document.querySelector('.product-form');

      if (productForm) {

        productForm.addEventListener('change', this.variantChangeHandler);

      }

    }



    setupStickyVariantChangeListeners() {

      // Listen for changes in the sticky variant inputs (not wrapped in variant-picker)

      const stickyVariantInputs = this.querySelectorAll('.sticky-swatch-input, .sticky-variant-select');

      stickyVariantInputs.forEach(input => {

        input.addEventListener('change', this.stickyVariantChangeHandler);

      });

    }

    

    removeVariantListeners() {

      // Remove all variant control listeners

      const variantInputSelectors = [

        '.product-form__input select',

        '.product-form__input input[type="radio"]',

        '.js-change-variant',

        '.swatch input',

        '.swatch-element',

        '.single-option-selector',

        'variant-picker select',

        'variant-picker input[type="radio"]'

      ].join(', ');

      

      document.querySelectorAll(variantInputSelectors).forEach(el => {

        el.removeEventListener('change', this.variantChangeHandler);

        

        if ((el instanceof HTMLInputElement && el.type === 'radio') || 

            el.classList.contains('swatch-element') || 

            el.classList.contains('js-change-variant')) {

          el.removeEventListener('click', this.variantChangeHandler);

        }

      });

      

      // Remove event listeners

      ['variant:change', 'variant:changed', 'property_select:change'].forEach(eventName => {

        document.removeEventListener(eventName, this.variantChangeHandler);

      });

      

      // Remove form listeners

      const productForm = document.querySelector('product-form-component') ||

                         document.querySelector('product-form') || 

                         document.querySelector('.product-form');

      if (productForm) {

        productForm.removeEventListener('change', this.variantChangeHandler);

      }

    }



    removeStickyVariantListeners() {

      const stickyVariantInputs = this.querySelectorAll('.sticky-swatch-input, .sticky-variant-select');

      stickyVariantInputs.forEach(input => {

        input.removeEventListener('change', this.stickyVariantChangeHandler);

      });

    }

    

    setupQuantitySync() {

      const sectionId = this.dataset.sectionId;

      const mainQuantityInput = document.querySelector(`#Quantity-${sectionId}`) ||

                                document.querySelector('quantity-selector-component input[type="number"]') ||

                                document.querySelector('.quantity-selector input[type="number"]') ||

                                document.querySelector('input[name="quantity"]');

      const stickyQuantitySelector = this.querySelector('quantity-selector-component');

      const stickyQuantityInput = stickyQuantitySelector ? stickyQuantitySelector.querySelector('input[type="number"]') : null;

      

      if (!(mainQuantityInput instanceof HTMLInputElement) || !(stickyQuantityInput instanceof HTMLInputElement)) return;

      

      // Set initial value

      stickyQuantityInput.value = mainQuantityInput.value;

      

      // Main quantity changes -> update sticky

      mainQuantityInput.addEventListener('change', this.quantityChangeHandler);

      

      // Sticky quantity changes -> update main

      this.stickyQuantityChangeHandler = () => {

        if (mainQuantityInput instanceof HTMLInputElement && stickyQuantityInput instanceof HTMLInputElement) {

          mainQuantityInput.value = stickyQuantityInput.value;

          mainQuantityInput.dispatchEvent(new Event('change', { bubbles: true }));

        }

      };

      if (this.stickyQuantityChangeHandler) {

        stickyQuantityInput.addEventListener('change', this.stickyQuantityChangeHandler);

      }

      

      // Handle quantity buttons in sticky bar

      const stickyQuantityButtons = stickyQuantitySelector ? stickyQuantitySelector.querySelectorAll('button[name="minus"], button[name="plus"]') : [];

      this.stickyQuantityButtonHandler = () => {

        // Small delay to let the quantity input update

        setTimeout(() => {

          if (stickyQuantityInput instanceof HTMLInputElement && mainQuantityInput instanceof HTMLInputElement) {

            mainQuantityInput.value = stickyQuantityInput.value;

            mainQuantityInput.dispatchEvent(new Event('change', { bubbles: true }));

          }

        }, 10);

      };

      

      stickyQuantityButtons.forEach(button => {

        if (button instanceof HTMLElement && this.stickyQuantityButtonHandler) {

          button.addEventListener('click', this.stickyQuantityButtonHandler);

        }

      });

    }

    

    removeQuantityListeners() {

      const sectionId = this.dataset.sectionId;

      const mainQuantityInput = document.querySelector(`#Quantity-${sectionId}`) ||

                                document.querySelector('quantity-selector-component input[type="number"]') ||

                                document.querySelector('.quantity-selector input[type="number"]') ||

                                document.querySelector('input[name="quantity"]');

      const stickyQuantitySelector = this.querySelector('quantity-selector-component');

      const stickyQuantityInput = stickyQuantitySelector ? stickyQuantitySelector.querySelector('input[type="number"]') : null;

      

      if (mainQuantityInput instanceof HTMLInputElement) {

        mainQuantityInput.removeEventListener('change', this.quantityChangeHandler);

      }

      

      if (stickyQuantityInput instanceof HTMLInputElement && this.stickyQuantityChangeHandler) {

        stickyQuantityInput.removeEventListener('change', this.stickyQuantityChangeHandler);

      }

      

      // Remove button listeners

      const stickyQuantityButtons = stickyQuantitySelector ? stickyQuantitySelector.querySelectorAll('button[name="minus"], button[name="plus"]') : [];

      stickyQuantityButtons.forEach(button => {

        if (button instanceof HTMLElement && this.stickyQuantityButtonHandler) {

          button.removeEventListener('click', this.stickyQuantityButtonHandler);

        }

      });

    }

  

    /**

     * @param {Event} event

     */

    handleQuantityChange(event) {

      const stickyQuantitySelector = this.querySelector('quantity-selector-component');

      const stickyQuantityInput = stickyQuantitySelector ? stickyQuantitySelector.querySelector('input[type="number"]') : null;

      

      if (stickyQuantityInput instanceof HTMLInputElement && event && event.target && event.target instanceof HTMLInputElement) {

        stickyQuantityInput.value = event.target.value;

      }

    }



    /**

     * @param {Event} event

     */

    handleStickyVariantChange(event) {

      const changedElement = event.target;

      if (!changedElement || !(changedElement instanceof HTMLElement)) return;



      // Update the visual state for swatches

      if (changedElement.classList.contains('sticky-swatch-input')) {

        // Remove selected class from siblings

        const parent = changedElement.closest('.sticky-variant-swatches');

        if (parent) {

          parent.querySelectorAll('.sticky-swatch-label').forEach(label => {

            label.classList.remove('is-selected');

          });

        }

        // Add selected class to current

        const label = changedElement.closest('.sticky-swatch-label');

        if (label) {

          label.classList.add('is-selected');

        }

      }



      // Find the corresponding element in the main variant picker and trigger it

      const mainVariantPicker = this.findMainVariantPicker();

      if (!mainVariantPicker) {

        console.warn('Could not find main variant picker for sticky add-to-cart');

        return;

      }



      const optionValueId = changedElement instanceof HTMLSelectElement 

        ? changedElement.options[changedElement.selectedIndex]?.dataset?.optionValueId

        : changedElement.dataset.optionValueId;



      if (optionValueId) {

        // Find and trigger the corresponding input in the main picker

        const mainElement = mainVariantPicker.querySelector(`input[data-option-value-id="${optionValueId}"], option[data-option-value-id="${optionValueId}"]`);

        

        if (mainElement) {

          if (mainElement instanceof HTMLInputElement && mainElement.type === 'radio') {

            mainElement.checked = true;

            mainElement.dispatchEvent(new Event('change', { bubbles: true }));

          } else if (mainElement instanceof HTMLOptionElement) {

            const select = mainElement.closest('select');

            if (select) {

              select.value = mainElement.value;

              select.dispatchEvent(new Event('change', { bubbles: true }));

            }

          }

        }

      }

    }



    /**

     * Find the appropriate main variant picker when there are multiple ones

     * @returns {HTMLElement | null}

     */

    findMainVariantPicker() {

      // Look for variant pickers that are NOT in the sticky component

      // Horizon uses variant-picker with data-template-product-match="true"

      const mainPicker = document.querySelector('variant-picker[data-template-product-match="true"]');

      if (mainPicker) return mainPicker;

      

      const allVariantPickers = document.querySelectorAll('variant-picker');

      

      for (const picker of allVariantPickers) {

        if (picker instanceof HTMLElement && 

            !picker.closest('custom-sticky-add-to-cart') && // Exclude custom sticky picker

            !picker.closest('sticky-add-to-cart') && // Exclude Horizon sticky picker

            !picker.closest('product-card') && 

            !picker.closest('quick-add-dialog') &&

            !picker.closest('quick-add-modal')) {

          // Check if it has template-product-match or is in the main product section

          if (picker.dataset.templateProductMatch === 'true' ||

              picker.closest('.product-details') ||

              picker.closest('.product-information') ||

              picker.closest('[id*="shopify-section"]')) {

            return picker;

          }

        }

      }

      

      // Fallback: return any variant picker that's not in sticky/card/quick-add

      for (const picker of allVariantPickers) {

        if (picker instanceof HTMLElement && 

            !picker.closest('custom-sticky-add-to-cart') &&

            !picker.closest('sticky-add-to-cart') &&

            !picker.closest('product-card') && 

            !picker.closest('quick-add-dialog') &&

            !picker.closest('quick-add-modal')) {

          return picker;

        }

      }

      

      return null;

    }

  

    handleVariantChange() {

      // Update the sticky bar immediately and again after a short delay

      this.updateStickyBarVariant();

      this.syncStickyVariantPicker();

      

      setTimeout(() => {

        this.updateStickyBarVariant();

        this.syncStickyVariantPicker();

      }, 100);

    }



    syncStickyVariantPicker() {

      const mainVariantPicker = this.findMainVariantPicker();

      if (!mainVariantPicker) return;

      

      // Get all selected radio inputs from main picker and sync to sticky

      const mainSelectedRadios = mainVariantPicker.querySelectorAll('input[type="radio"]:checked');

      mainSelectedRadios.forEach(mainInput => {

        if (mainInput instanceof HTMLInputElement) {

          const optionValueId = mainInput.dataset.optionValueId;

          if (optionValueId) {

            // Find the corresponding sticky input

            const stickyInput = this.querySelector(`.sticky-swatch-input[data-option-value-id="${optionValueId}"]`);

            if (stickyInput instanceof HTMLInputElement) {

              stickyInput.checked = true;

              // Update visual state

              const parent = stickyInput.closest('.sticky-variant-swatches');

              if (parent) {

                parent.querySelectorAll('.sticky-swatch-label').forEach(label => {

                  label.classList.remove('is-selected');

                });

              }

              const label = stickyInput.closest('.sticky-swatch-label');

              if (label) {

                label.classList.add('is-selected');

              }

            }

          }

        }

      });

      

      // Get all selected values from main picker selects

      const mainSelects = mainVariantPicker.querySelectorAll('select');

      mainSelects.forEach(mainSelect => {

        if (mainSelect instanceof HTMLSelectElement) {

          const selectedOption = mainSelect.options[mainSelect.selectedIndex];

          const optionValueId = selectedOption?.dataset?.optionValueId;

          if (optionValueId) {

            // Find corresponding sticky select option

            const stickySelect = this.querySelector(`.sticky-variant-select option[data-option-value-id="${optionValueId}"]`)?.closest('select');

            if (stickySelect instanceof HTMLSelectElement) {

              stickySelect.value = mainSelect.value;

            }

          }

        }

      });

    }

  

    updateStickyBarVariant() {

      const mainForm = document.querySelector('product-form-component form') ||

                      document.querySelector('product-form form') ||

                      document.querySelector('form[data-type="add-to-cart-form"]');

      if (!mainForm) return;

      const variantIdInput = mainForm.querySelector('[name="id"]');

      if (!(variantIdInput instanceof HTMLInputElement)) return;

      

      // Update variant ID

      const stickyVariantIdInput = this.querySelector('[name="id"]');

      if (stickyVariantIdInput instanceof HTMLInputElement) {

        stickyVariantIdInput.value = variantIdInput.value;

      }

      

      this.updateVariantTitle();

      this.updateStickyBarPrice();

      this.updateAvailabilityStatus(mainForm);

    }

    

    updateVariantTitle() {

      const stickyFormVariantTitle = this.querySelector('.sticky-add-to-cart__variant');

      if (!stickyFormVariantTitle) return;

      

      // Reset previous content first

      stickyFormVariantTitle.textContent = '';

      

      // Try to get variant display from main product info

      const mainFormVariantTitle = document.querySelector('.product__variant-status');

      

      if (mainFormVariantTitle) {

        stickyFormVariantTitle.textContent = mainFormVariantTitle.textContent;

        return;

      }

      

      // Alternative: gather selected options from main variant picker

      const mainVariantPicker = this.findMainVariantPicker();

      if (!mainVariantPicker) return;

      

      /** @type {string[]} */

      const selectedOptions = [];

      

      // From dropdowns

      mainVariantPicker.querySelectorAll('select').forEach(select => {

        if (select instanceof HTMLSelectElement && select.value) {

          selectedOptions.push(select.value);

        }

      });

      

      // From radio buttons

      mainVariantPicker.querySelectorAll('input[type="radio"]:checked').forEach(radio => {

        if (radio instanceof HTMLInputElement) {

          selectedOptions.push(radio.value);

        }

      });

      

      // Display if we have options

      if (selectedOptions.length > 0) {

        const uniqueOptions = [...new Set(selectedOptions)];

        stickyFormVariantTitle.textContent = uniqueOptions.join(' / ');

      }

    }

    

    updateStickyBarPrice() {

      const mainPrice = document.querySelector('.price:not(.sticky-add-to-cart .price)');

      const stickyPrice = this.querySelector('.sticky-add-to-cart__price');

      

      if (mainPrice && stickyPrice) {

        // Clone price content to the sticky bar

        stickyPrice.innerHTML = '';

        const priceClone = mainPrice.cloneNode(true);

        stickyPrice.appendChild(priceClone);

      }

    }

    

    /**

     * @param {any} mainForm

     */

    updateAvailabilityStatus(mainForm) {

      const addToCartButton = mainForm.querySelector('[type="submit"], .add-to-cart-button');

      const stickyAddToCartButton = this.querySelector('.sticky-add-button');

      

      if (addToCartButton instanceof HTMLButtonElement && stickyAddToCartButton instanceof HTMLButtonElement) {

        // Update button state

        stickyAddToCartButton.disabled = addToCartButton.disabled;

        

        // Update button text

        const mainButtonText = addToCartButton.querySelector('span')?.textContent || addToCartButton.textContent;

        const stickySpan = stickyAddToCartButton.querySelector('span');

        if (mainButtonText && stickySpan) {

          stickySpan.textContent = mainButtonText.trim();

        }

      }

    }

  

    handleScroll() {

      const productForm = document.querySelector('product-form-component') ||

                          document.querySelector('product-form') || 

                          document.querySelector('.product-form');

      if (!(productForm instanceof HTMLElement)) return;

      

      // Find the add to cart button - this is what we need to scroll past
      const addToCartButton = productForm.querySelector('[ref="addToCartButton"]') ||
                              productForm.querySelector('.add-to-cart-button') ||
                              productForm.querySelector('button[type="submit"][name="add"]') ||
                              document.querySelector('.buy-buttons-block .add-to-cart-button') ||
                              document.querySelector('.product-form-buttons .add-to-cart-button');

      // Fallback: use buy buttons block or product form buttons if button not found
      const buyButtonsBlock = document.querySelector('.buy-buttons-block') ||
                              document.querySelector('.product-form-buttons') ||
                              productForm.querySelector('[ref="productFormButtons"]');

      const stickyHeight = this.offsetHeight;

      let shouldStick = false;

      

      // Different logic based on position (top or bottom)

      if (this.position === 'top') {

        // For top position, show when scrolled past the add to cart button
        if (addToCartButton instanceof HTMLElement) {
          const buttonRect = addToCartButton.getBoundingClientRect();
          const buttonBottom = window.scrollY + buttonRect.bottom;
          shouldStick = window.scrollY > buttonBottom;
        } else if (buyButtonsBlock instanceof HTMLElement) {
          const blockRect = buyButtonsBlock.getBoundingClientRect();
          const blockBottom = window.scrollY + blockRect.bottom;
          shouldStick = window.scrollY > blockBottom;
        } else {
          // Ultimate fallback: use product form
          shouldStick = window.scrollY > (productForm.offsetTop + productForm.offsetHeight);
        }

      } else {

        // For bottom position (default), show when scrolled past the add to cart button
        if (addToCartButton instanceof HTMLElement) {
          const buttonRect = addToCartButton.getBoundingClientRect();
          const buttonBottom = window.scrollY + buttonRect.bottom;
          shouldStick = window.scrollY > buttonBottom;
        } else if (buyButtonsBlock instanceof HTMLElement) {
          const blockRect = buyButtonsBlock.getBoundingClientRect();
          const blockBottom = window.scrollY + blockRect.bottom;
          shouldStick = window.scrollY > blockBottom;
        } else {
          // Ultimate fallback: use product form
          shouldStick = window.scrollY > (productForm.offsetTop + productForm.offsetHeight);
        }

      }

      

      const isSticky = this.classList.contains(this.stickyClass);

      

      // Add/remove sticky class based on scroll position

      if (shouldStick && !isSticky) {

        this.style.minHeight = `${stickyHeight}px`;

        this.classList.add(this.stickyClass);

      } else if (!shouldStick && isSticky) {

        this.style.removeProperty('min-height');

        this.classList.remove(this.stickyClass);

      }

    }

    

    /**

     * @param {Event} event

     */

    handleAddToCart(event) {

      if (event && event.preventDefault) {

        event.preventDefault();

      }

      

      // Find main form

      const mainForm = document.querySelector('product-form-component form') ||

                      document.querySelector('product-form form') ||

                      document.querySelector('form[data-type="add-to-cart-form"]');

      

      if (!mainForm) return;

      

      // Sync quantity and variant ID with main form

      this.syncFormData(mainForm);

      

      // Trigger main form submission

      const mainSubmitButton = mainForm.querySelector('[type="submit"]');

      if (mainSubmitButton instanceof HTMLElement && typeof mainSubmitButton.click === 'function') {

        mainSubmitButton.click();

      } else if (mainForm instanceof HTMLFormElement) {

        mainForm.submit();

      }

    }

    

    /**

     * @param {any} mainForm

     */

    syncFormData(mainForm) {

      const stickyQuantitySelector = this.querySelector('quantity-selector-component');

      const stickyQuantityInput = stickyQuantitySelector ? stickyQuantitySelector.querySelector('input[type="number"]') : null;

      const sectionId = this.dataset.sectionId;

      const mainQuantityInput = document.querySelector(`#Quantity-${sectionId}`) ||

                                document.querySelector('quantity-selector-component input[type="number"]') ||

                                document.querySelector('.quantity-selector input[type="number"]') ||

                                document.querySelector('input[name="quantity"]');

      

      if (stickyQuantityInput instanceof HTMLInputElement && mainQuantityInput instanceof HTMLInputElement) {

        mainQuantityInput.value = stickyQuantityInput.value;

        mainQuantityInput.dispatchEvent(new Event('change', { bubbles: true }));

      }

      

      // Sync variant ID - use the sticky form's value which should be updated by variant:update event

      const stickyVariantIdInput = this.querySelector('[name="id"]');

      const mainVariantIdInput = mainForm.querySelector('[name="id"]');

      

      if (stickyVariantIdInput instanceof HTMLInputElement && mainVariantIdInput instanceof HTMLInputElement) {

        // Make sure we have the correct variant ID from the main form

        // (in case the variant:update event already updated the main form)

        if (mainVariantIdInput.value) {

          stickyVariantIdInput.value = mainVariantIdInput.value;

        }

        // Then sync back to main form

        mainVariantIdInput.value = stickyVariantIdInput.value;

      }

    }



    /**

     * Debug method to log information about all variant pickers on the page

     */

    debugVariantPickers() {

      const allVariantPickers = document.querySelectorAll('variant-picker');

      

      console.log(`Total variant pickers found: ${allVariantPickers.length}`);

      console.log(`Sticky swatches found:`, this.querySelectorAll('.sticky-swatch-input').length);

      

      allVariantPickers.forEach((picker, index) => {

        if (picker instanceof HTMLElement) {

          console.log(`Variant picker ${index}:`, {

            productId: picker.dataset.productId,

            templateProductMatch: picker.dataset.templateProductMatch,

            inProductCard: !!picker.closest('product-card'),

            inQuickAddDialog: !!picker.closest('quick-add-dialog'),

            inStickyAddToCart: !!picker.closest('sticky-add-to-cart'),

            inCustomStickyAddToCart: !!picker.closest('custom-sticky-add-to-cart')

          });

        }

      });

    }

  }

  

  customElements.define('custom-sticky-add-to-cart', StickyAddToCart);

  

  // Handle header visibility changes

  window.addEventListener("scroll", function() {

    const stickyAddToCart = document.querySelector('custom-sticky-add-to-cart');

    if (!stickyAddToCart) return;

    

    // Handle header state

    const header = document.querySelector('#shopify-section-header') || document.querySelector('#header-group');

    const stickyInner = document.querySelector('.sticky-inner-container');

    

    if (header?.classList.contains('shopify-section-header-hidden')) {

      stickyInner?.classList.add('show-my-class');

    } else {

      stickyInner?.classList.remove('show-my-class');

    }

  });

