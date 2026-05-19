class ProductComparison {
    constructor() {
      this.selectedProducts = new Set();
      this.maxProducts = 4;
      this.init();
      this.loadState();
    }

    init() {
      this.toggleButton = document.querySelector('.toggle-comparison');
      this.productGrid = document.querySelector('.product-grid');
      this.stickyBar = document.querySelector('.comparison-sticky-bar');
      this.productsContainer = document.querySelector('.comparison-products');
      this.compareButton = document.querySelector('.compare-button');
      this.modal = document.querySelector('.comparison-modal');
      this.modalClose = document.querySelector('.comparison-modal-close');
      this.comparisonTable = document.querySelector('.comparison-table');
      
      this.bindEvents();
    }

    bindEvents() {
      this.toggleButton.addEventListener('click', () => this.toggleComparisonMode());
      
      document.querySelectorAll('.product-comparison-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => this.handleProductSelection(e));
      });

      this.compareButton.addEventListener('click', () => this.showComparison());
      this.modalClose.addEventListener('click', () => this.hideComparison());
      
      // Close modal when clicking outside
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.hideComparison();
        }
      });

      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.saveState();
        }
      });

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        this.saveState();
      });
    }

    saveState() {
      const state = {
        isComparing: this.productGrid.classList.contains('comparison-mode'),
        selectedProducts: Array.from(this.selectedProducts)
      };
      sessionStorage.setItem('productComparisonState', JSON.stringify(state));
    }

    loadState() {
      try {
        const savedState = sessionStorage.getItem('productComparisonState');
        if (savedState) {
          const state = JSON.parse(savedState);
          
          // Restore comparison mode
          if (state.isComparing) {
            this.toggleComparisonMode();
          }

          // Restore selected products
          state.selectedProducts.forEach(productId => {
            const checkbox = document.querySelector(`.product-comparison-checkbox[data-product-id="${productId}"]`);
            if (checkbox) {
              checkbox.checked = true;
              this.selectedProducts.add(productId);
              this.addToComparisonBar(checkbox.dataset);
            }
          });

          this.updateStickyBarVisibility();
        }
      } catch (error) {
        console.error('Error loading comparison state:', error);
        this.clearComparison();
      }
    }

    toggleComparisonMode() {
      this.productGrid.classList.toggle('comparison-mode');
      this.toggleButton.classList.toggle('active');
      
      if (!this.toggleButton.classList.contains('active')) {
        this.clearComparison();
      }

      this.saveState();
    }

    handleProductSelection(event) {
      const checkbox = event.target;
      const productId = checkbox.dataset.productId;
      
      if (checkbox.checked) {
        if (this.selectedProducts.size >= this.maxProducts) {
          checkbox.checked = false;
          alert('You can compare up to 4 products at a time');
          return;
        }
        this.selectedProducts.add(productId);
        this.addToComparisonBar(checkbox.dataset);
      } else {
        this.selectedProducts.delete(productId);
        this.removeFromComparisonBar(productId);
      }
      
      this.updateStickyBarVisibility();
    }

    addToComparisonBar(productData) {
      const productElement = document.createElement('div');
      productElement.className = 'comparison-product';
      productElement.dataset.productId = productData.productId;
      
      productElement.innerHTML = `
        <img src="${productData.productImage}" alt="${productData.productTitle}">
        <button type="button" class="remove" onclick="productComparison.removeProduct('${productData.productId}')">&times;</button>
        <div class="product-title">${productData.productTitle}</div>
      `;
      
      this.productsContainer.appendChild(productElement);
    }

    removeProduct(productId) {
      this.selectedProducts.delete(productId);
      const checkbox = document.querySelector(`.product-comparison-checkbox[data-product-id="${productId}"]`);
      if (checkbox) checkbox.checked = false;
      this.removeFromComparisonBar(productId);
      this.updateStickyBarVisibility();
    }

    removeFromComparisonBar(productId) {
      const productElement = this.productsContainer.querySelector(`[data-product-id="${productId}"]`);
      if (productElement) productElement.remove();
    }

    updateStickyBarVisibility() {
      this.stickyBar.classList.toggle('active', this.selectedProducts.size > 0);
    }

    clearComparison() {
      this.selectedProducts.clear();
      this.productsContainer.innerHTML = '';
      document.querySelectorAll('.product-comparison-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      this.updateStickyBarVisibility();
      this.hideComparison();
    }

    showComparison() {
      if (this.selectedProducts.size < 2) {
        alert('Please select at least 2 products to compare');
        return;
      }

      // Clear existing content
      const tableHeader = this.modal.querySelector('.comparison-details-table thead tr');
      const tableRows = this.modal.querySelectorAll('.comparison-details-table tbody tr');
      
      // Clear all cells except feature labels
      tableHeader.querySelectorAll('th:not(.feature-label)').forEach(th => th.remove());
      tableRows.forEach(row => {
        row.querySelectorAll('td').forEach(td => td.remove());
      });

      // Add selected products to the comparison
      document.querySelectorAll('.product-comparison-checkbox:checked').forEach(checkbox => {
        const data = checkbox.dataset;
        
        // Add column header
        const headerCell = document.createElement('th');
        headerCell.dataset.productId = data.productId;
        headerCell.textContent = data.productTitle;
        tableHeader.appendChild(headerCell);

        // Add product image cell
        const imageCell = document.createElement('td');
        imageCell.dataset.productId = data.productId;
        imageCell.innerHTML = `
          <div class="product-image-cell">
            <button type="button" class="remove-product" onclick="productComparison.removeFromComparison('${data.productId}')">&times;</button>
            <img src="${data.productImage}" alt="${data.productTitle}">
            <div class="product-title">${data.productTitle}</div>
            <a href="${data.productUrl}" class="view-details button button-primary">View Details</a>
          </div>
        `;
        tableRows[0].appendChild(imageCell);

        // Add data to each row
        const descriptionCell = document.createElement('td');
        descriptionCell.dataset.productId = data.productId;
        descriptionCell.textContent = data.productDescription || 'No description available';
        tableRows[1].appendChild(descriptionCell);

        const priceCell = document.createElement('td');
        priceCell.dataset.productId = data.productId;
        priceCell.textContent = data.productPrice;
        tableRows[2].appendChild(priceCell);

        const vendorCell = document.createElement('td');
        vendorCell.dataset.productId = data.productId;
        vendorCell.textContent = data.productVendor;
        tableRows[3].appendChild(vendorCell);

        const typeCell = document.createElement('td');
        typeCell.dataset.productId = data.productId;
        typeCell.textContent = data.productType;
        tableRows[4].appendChild(typeCell);

        const variantsCell = document.createElement('td');
        variantsCell.dataset.productId = data.productId;
        variantsCell.textContent = data.productVariants;
        variantsCell.style.color = data.productVariants === 'N/A' ? '#666' : 'inherit';
        tableRows[5].appendChild(variantsCell);
      });

      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    removeFromComparison(productId) {
      // Remove from selected products
      this.selectedProducts.delete(productId);
      
      // Uncheck the checkbox
      const checkbox = document.querySelector(`.product-comparison-checkbox[data-product-id="${productId}"]`);
      if (checkbox) checkbox.checked = false;

      // Remove from sticky bar
      this.removeFromComparisonBar(productId);

      // Remove from comparison table
      const headerCell = this.modal.querySelector(`.comparison-details-table th[data-product-id="${productId}"]`);
      if (headerCell) headerCell.remove();

      this.modal.querySelectorAll(`.comparison-details-table td[data-product-id="${productId}"]`).forEach(cell => {
        cell.remove();
      });

      // Update sticky bar visibility
      this.updateStickyBarVisibility();

      // If less than 2 products remain, close the modal
      if (this.selectedProducts.size < 2) {
        this.hideComparison();
      }
    }

    hideComparison() {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Initialize the comparison functionality
  const productComparison = new ProductComparison();