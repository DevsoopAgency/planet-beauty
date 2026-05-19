class MegaMenu {
    constructor() {
      this.menus = document.querySelectorAll('header-menu');
      this.sliderMap = new Map(); // Track sliders for each menu
      console.log('MegaMenu: Found', this.menus.length, 'header menus');
      this.addStyles();
      this.addCloseButtons();
      this.init();
    }
  
    addStyles() {
      const styles = `
        /* Override existing grid layout for slider */
        .mega-menu__slider {
          display: block !important;
          grid-template-columns: none !important;
          grid: none !important;
          position: relative !important;
        }

        .mega-menu__slider .featured-collection__item {
          grid-column: unset !important;
          grid-row: unset !important;
        }

        /* Ensure proper spacing for Swiper */
        .mega-menu__slider .swiper-slide {
          padding: 0;
          height: auto;
        }

        .mega-menu__slider .swiper-wrapper {
          display: flex;
        }

        /* Fix arrow visibility and positioning for Swiper */
        .mega-menu__slider .swiper-button-next,
        .mega-menu__slider .swiper-button-prev {
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          z-index: 10 !important;
          width: 40px !important;
          height: 40px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
          margin-top: 0 !important;
        }

        .mega-menu__slider .swiper-button-next:hover,
        .mega-menu__slider .swiper-button-prev:hover {
          background: rgba(255, 255, 255, 1) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        .mega-menu__slider .swiper-button-prev {
          left: -20px !important;
        }

        .mega-menu__slider .swiper-button-next {
          right: -20px !important;
        }

        /* Hide default Swiper arrow icons and style custom SVG */
        .mega-menu__slider .swiper-button-next::after,
        .mega-menu__slider .swiper-button-prev::after {
          display: none !important;
        }

        .mega-menu__slider .swiper-button-next svg,
        .mega-menu__slider .swiper-button-prev svg {
          width: 20px !important;
          height: 20px !important;
          display: block !important;
        }

        .mega-menu__slider .swiper-button-next svg path,
        .mega-menu__slider .swiper-button-prev svg path {
          fill: currentColor !important;
          color: #333 !important;
        }

        /* Ensure slider container has proper positioning */
        .featured-collection {
          position: relative !important;
          overflow: visible !important;
        }

        /* Hide arrows on mobile if needed */
        @media (max-width: 768px) {
          .mega-menu__slider .swiper-button-next,
          .mega-menu__slider .swiper-button-prev {
            width: 35px !important;
            height: 35px !important;
          }
          
          .mega-menu__slider .swiper-button-prev {
            left: -15px !important;
          }
          
          .mega-menu__slider .swiper-button-next {
            right: -15px !important;
          }
        }
      `;
  
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  
    addCloseButtons() {
      // For header-menu elements, close buttons are not needed
      // as they use hover/focus events handled by the header-menu.js
      console.log('MegaMenu: Skipping close buttons for header-menu elements');
    }
  
    init() {
      this.menus.forEach(menu => {
        this.setupSlider(menu);
        this.bindEvents(menu);
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target instanceof HTMLElement && !target.closest('.mega-menu') && !target.closest('.header__menu-item')) {
          this.closeAllMenus();
        }
      });
      
      // Handle escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAllMenus();
        }
      });
    }
  
    setupSlider(menu) {
      const slider = menu.querySelector('.mega-menu__slider');
      if (!slider) {
        console.log('MegaMenu: No slider found in menu');
        return;
      }
  
      console.log('MegaMenu: Found slider', slider);
      const productsPerRow = parseInt(slider.dataset.productsPerRow) || 3;
      const items = slider.querySelectorAll('.featured-collection__item');
      
      console.log('MegaMenu: Found', items.length, 'items, productsPerRow:', productsPerRow);
      
      if (items.length === 0) return;
  
      // Wait for Swiper to be available
      const initSlider = () => {
        console.log('MegaMenu: Checking for Swiper...');
        console.log('MegaMenu: typeof Swiper:', typeof Swiper);
        
        if (typeof Swiper === 'undefined') {
          console.log('MegaMenu: Swiper not ready, retrying...');
          setTimeout(initSlider, 100);
          return;
        }
  
        console.log('MegaMenu: Initializing Swiper slider...');
        
        // Destroy existing slider if it exists
        const existingSwiper = slider.swiper;
        if (existingSwiper) {
          console.log('MegaMenu: Destroying existing slider');
          existingSwiper.destroy(true, true);
        }
        
        // Create navigation buttons if they don't exist
        const container = slider.closest('.featured-collection');
        let prevButton = container?.querySelector('.swiper-button-prev');
        let nextButton = container?.querySelector('.swiper-button-next');
        
        if (!prevButton || !nextButton) {
          if (!container) {
            console.error('MegaMenu: Could not find container for navigation buttons');
            return;
          }
          
          prevButton = document.createElement('div');
          prevButton.className = 'swiper-button-prev';
          prevButton.setAttribute('aria-label', 'Previous slide');
          prevButton.innerHTML = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fill-rule="evenodd" d="M9.354.646a.5.5 0 0 0-.708 0L5 4.293 1.354.646a.5.5 0 0 0-.708.708l4 4a.5.5 0 0 0 .708 0l4-4a.5.5 0 0 0 0-.708" clip-rule="evenodd"/></svg>';
          
          nextButton = document.createElement('div');
          nextButton.className = 'swiper-button-next';
          nextButton.setAttribute('aria-label', 'Next slide');
          nextButton.innerHTML = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fill-rule="evenodd" d="M.646.646a.5.5 0 0 1 .708 0L5 4.293 8.646.646a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708" clip-rule="evenodd"/></svg>';
          
          container.appendChild(prevButton);
          container.appendChild(nextButton);
        }
        
        // Temporarily show menu for proper initialization
        const wasHidden = menu.style.display === 'none';
        const originalDisplay = menu.style.display;
        menu.style.display = 'block';
        
        try {
          // Ensure swiper class is on container (already added in HTML, but check anyway)
          slider.classList.add('swiper');
          
          // Check if wrapper already exists (from HTML)
          let wrapper = slider.querySelector('.swiper-wrapper');
          if (!wrapper) {
            // Fallback: wrap items if wrapper doesn't exist
            wrapper = document.createElement('div');
            wrapper.className = 'swiper-wrapper';
            while (slider.firstChild) {
              wrapper.appendChild(slider.firstChild);
            }
            slider.appendChild(wrapper);
          }
          
          // Ensure swiper-slide class is on each item (already added in HTML, but check anyway)
          items.forEach(item => {
            item.classList.add('swiper-slide');
          });
          
          // Initialize Swiper
          const swiperInstance = new Swiper(slider, {
            slidesPerView: productsPerRow,
            spaceBetween: 10,
            speed: 300,
            loop: items.length > productsPerRow,
            slideClass: 'swiper-slide',
            wrapperClass: 'swiper-wrapper',
            navigation: {
              nextEl: nextButton,
              prevEl: prevButton,
            },
            breakpoints: {
              0: {
                slidesPerView: 1,
                spaceBetween: 10,
              },
              480: {
                slidesPerView: 1,
                spaceBetween: 10,
              },
              769: {
                slidesPerView: Math.min(productsPerRow - 1, 2),
                spaceBetween: 10,
              },
              990: {
                slidesPerView: productsPerRow,
                spaceBetween: 10,
              },
            },
          });
          
          console.log('MegaMenu: Swiper slider initialized successfully');
          
          // Store slider reference
          this.sliderMap.set(menu, swiperInstance);
        } catch (error) {
          console.error('MegaMenu: Error initializing Swiper slider:', error);
        }
        
        // Restore original display
        if (wasHidden) {
          menu.style.display = originalDisplay;
        }
      };
  
      // Initial initialization
      initSlider();
  
      // Handle resize events
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (menu.hasAttribute('open')) {
            const currentSwiper = this.sliderMap.get(menu);
            if (currentSwiper && currentSwiper.update) {
              currentSwiper.update();
            }
          }
        }, 250);
      });
  
      // Refresh slider when menu opens
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'open') {
            const currentSwiper = this.sliderMap.get(menu);
            if (currentSwiper && menu.hasAttribute('open')) {
              requestAnimationFrame(() => {
                if (currentSwiper.update) {
                  currentSwiper.update();
                }
              });
            }
          }
        });
      });
  
      observer.observe(menu, { attributes: true });
    }
  
    bindEvents(menu) {
      // For header-menu elements, we don't need to bind click events
      // as they use hover/focus events handled by the header-menu.js
      console.log('MegaMenu: Binding events for menu', menu);
    }
  
    openMenu(menu) {
      // For header-menu elements, opening is handled by the header-menu.js
      console.log('MegaMenu: Opening menu', menu);
    }
  
    closeMenu(menu) {
      // For header-menu elements, closing is handled by the header-menu.js
      console.log('MegaMenu: Closing menu', menu);
    }
  
    closeAllMenus() {
      // For header-menu elements, this is handled by the header-menu.js
      console.log('MegaMenu: Closing all menus');
    }
  }
  
  // Initialize mega menu
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MegaMenu: DOMContentLoaded, initializing...');
    window.megaMenuInstance = new MegaMenu();
  });

  // Also initialize on window load to ensure all dependencies are loaded
  window.addEventListener('load', () => {
    console.log('MegaMenu: Window load, checking for sliders...');
    // Re-initialize sliders if they weren't initialized before
    const existingMegaMenu = window.megaMenuInstance;
    if (existingMegaMenu) {
      existingMegaMenu.menus.forEach(menu => {
        const slider = menu.querySelector('.mega-menu__slider');
        if (slider && !slider.swiper) {
          existingMegaMenu.setupSlider(menu);
        }
      });
    }
  });
  