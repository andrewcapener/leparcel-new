/*
 * Symmetry's own boot script, from mermademarket.com.
 *
 * `window.theme` is the theme's configuration object: main.js reads it for
 * breakpoints, device capabilities and strings. The cart and search routes it
 * carries are Shopify's; nothing on this site calls them, and they are kept
 * only so main.js finds the shape it expects.
 *
 * `inlineNavigationCheck` is what decides whether the nav fits beside the
 * logo (adding pageheader--layout-inline-permitted) or has to fall back to
 * the row underneath. `setInitialHeaderHeightProperty` publishes the header
 * height that the transparent-header offset is calculated from. Both are
 * theirs, unedited.
 */
document.documentElement.className = document.documentElement.className.replace('no-js', 'js');

    
/*
 * main.js's PageHeader element reads window.Shopify.designMode in its
 * constructor. There is no Shopify here, so give it the object to read: an
 * undefined designMode is exactly the "not in the theme editor" answer it
 * wants, and a missing window.Shopify would throw and leave the header
 * unwired.
 */
window.Shopify = window.Shopify || {};

window.theme = {
      info: {
        name: 'Symmetry',
        version: '7.1.2'
      },
      device: {
        hasTouch: window.matchMedia('(any-pointer: coarse)').matches,
        hasHover: window.matchMedia('(hover: hover)').matches
      },
      mediaQueries: {
        md: '(min-width: 768px)',
        productMediaCarouselBreak: '(min-width: 1041px)'
      },
      routes: {
        base: window.location.origin,
        cart: '/cart',
        cartAdd: '/cart/add.js',
        cartUpdate: '/cart/update.js',
        predictiveSearch: '/search/suggest'
      },
      strings: {
        cartTermsConfirmation: "You must agree to the terms and conditions before continuing.",
        cartItemsQuantityError: "You can only add [QUANTITY] of this item to your cart.",
        generalSearchViewAll: "View all search results",
        noStock: "Sold out",
        noVariant: "Unavailable",
        productsProductChooseA: "Choose a",
        generalSearchPages: "Pages",
        generalSearchNoResultsWithoutTerms: "Sorry, we couldnʼt find any results",
        shippingCalculator: {
          singleRate: "There is one shipping rate for this destination:",
          multipleRates: "There are multiple shipping rates for this destination:",
          noRates: "We do not ship to this destination."
        }
      },
      settings: {
        moneyWithCurrencyFormat: "${{amount}} USD",
        cartType: "drawer",
        afterAddToCart: "drawer",
        quickbuyStyle: "button",
        externalLinksNewTab: true,
        internalLinksSmoothScroll: true
      }
    }

    theme.inlineNavigationCheck = function() {
      var pageHeader = document.querySelector('.pageheader'),
          inlineNavContainer = pageHeader.querySelector('.logo-area__left__inner'),
          inlineNav = inlineNavContainer.querySelector('.navigation--left');
      if (inlineNav && getComputedStyle(inlineNav).display != 'none') {
        var inlineMenuCentered = document.querySelector('.pageheader--layout-inline-menu-center'),
            logoContainer = document.querySelector('.logo-area__middle__inner');
        if(inlineMenuCentered) {
          var rightWidth = document.querySelector('.logo-area__right__inner').clientWidth,
              middleWidth = logoContainer.clientWidth,
              logoArea = document.querySelector('.logo-area'),
              computedLogoAreaStyle = getComputedStyle(logoArea),
              logoAreaInnerWidth = logoArea.clientWidth - Math.ceil(parseFloat(computedLogoAreaStyle.paddingLeft)) - Math.ceil(parseFloat(computedLogoAreaStyle.paddingRight)),
              availableNavWidth = logoAreaInnerWidth - Math.max(rightWidth, middleWidth) * 2 - 40;
          inlineNavContainer.style.maxWidth = availableNavWidth + 'px';
        }

        var firstInlineNavLink = inlineNav.querySelector('.navigation__item:first-child'),
            lastInlineNavLink = inlineNav.querySelector('.navigation__item:last-child');
        if (lastInlineNavLink) {
          var inlineNavWidth = null;
          if(document.querySelector('html[dir=rtl]')) {
            inlineNavWidth = firstInlineNavLink.offsetLeft - lastInlineNavLink.offsetLeft + firstInlineNavLink.offsetWidth;
          } else {
            inlineNavWidth = lastInlineNavLink.offsetLeft - firstInlineNavLink.offsetLeft + lastInlineNavLink.offsetWidth;
          }
          if (inlineNavContainer.offsetWidth >= inlineNavWidth) {
            pageHeader.classList.add('pageheader--layout-inline-permitted');
            var tallLogo = logoContainer.clientHeight > lastInlineNavLink.clientHeight + 20;
            if (tallLogo) {
              inlineNav.classList.add('navigation--tight-underline');
            } else {
              inlineNav.classList.remove('navigation--tight-underline');
            }
          } else {
            pageHeader.classList.remove('pageheader--layout-inline-permitted');
          }
        }
      }
    };

    theme.setInitialHeaderHeightProperty = () => {
      const section = document.querySelector('.section-header');
      if (section) {
        document.documentElement.style.setProperty('--theme-header-height', Math.ceil(section.clientHeight) + 'px');
      }
    };
