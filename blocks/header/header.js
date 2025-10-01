import { getMetadata } from '../../scripts/aem.js';
import { fetchSpreadsheetData, loadFragment } from '../../scripts/scripts.js';
import decorateKoAssetsSearch from '../koassets-search/koassets-search.js';
import showProfileModal from './profile.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

async function createNavBar() {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  const tools = nav.querySelector('.nav-tools');

  // add shopping cart and download icons to nav-tools
  if (tools) {
    // Create wrapper div with flex layout
    const iconsWrapper = document.createElement('div');
    iconsWrapper.classList.add('nav-icons-wrapper');

    // Create cart icon
    const cartIcon = document.createElement('div');
    cartIcon.classList.add('nav-cart-icon');
    cartIcon.innerHTML = `
      <button type="button" aria-label="Shopping Cart">
        <img src="/icons/shopping-cart-icon.svg" alt="Shopping Cart" />
        <span class="cart-badge" style="display: none;"></span>
      </button>
    `;

    // Add click handler for cart icon
    cartIcon.addEventListener('click', () => {
      if (window.openCart && typeof window.openCart === 'function') {
        window.openCart();
      } else {
        console.log('Cart panel functionality not available');
      }
    });

    // Create download icon
    const downloadIcon = document.createElement('div');
    downloadIcon.classList.add('nav-download-icon');
    downloadIcon.innerHTML = `
      <button type="button" aria-label="Download">
        <img src="/icons/download-icon.svg" alt="Download" />
        <span class="download-badge" style="display: none;"></span>
      </button>
    `;

    // Add click handler for download icon
    downloadIcon.addEventListener('click', () => {
      if (window.openDownloadPanel && typeof window.openDownloadPanel === 'function') {
        window.openDownloadPanel();
      } else {
        console.log('Download functionality not available');
      }
    });

    // Append icons to wrapper (download icon first, then cart icon)
    iconsWrapper.appendChild(downloadIcon);
    iconsWrapper.appendChild(cartIcon);

    // Append wrapper to tools
    tools.appendChild(iconsWrapper);

    // Expose function to update cart badge
    window.updateCartBadge = function (numCartAssetItems) {
      const badge = cartIcon.querySelector('.cart-badge');
      if (badge) {
        if (numCartAssetItems && numCartAssetItems > 0) {
          badge.textContent = numCartAssetItems;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    };

    // Expose function to update download badge
    window.updateDownloadBadge = function (numDownloadAssetItems) {
      const badge = downloadIcon.querySelector('.download-badge');
      if (badge) {
        if (numDownloadAssetItems && numDownloadAssetItems > 0) {
          badge.textContent = numDownloadAssetItems;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    };

    // Update cart badge from localStorage
    try {
      const cartAssetItems = JSON.parse(localStorage.getItem('cartAssetItems') || '[]');
      window.updateCartBadge(cartAssetItems.length);
    } catch (error) {
      console.error('Error reading cart items from localStorage:', error);
      window.updateCartBadge(0);
    }

    // Update download badge from sessionStorage
    try {
      const downloadAssetItems = JSON.parse(sessionStorage.getItem('downloadArchives') || '[]');
      window.updateDownloadBadge(downloadAssetItems.length);
    } catch (error) {
      console.error('Error reading download items from sessionStorage:', error);
      window.updateDownloadBadge(0);
    }
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  return navWrapper;
}

function getUserInitials() {
  if (!window.user || !window.user.name) {
    return '';
  }
  return window.user.name.split(' ').map((name) => name.charAt(0)).join('').toUpperCase();
}

async function createHeaderBar() {
  // Create TCCC primary header bar
  const headerBar = document.createElement('div');
  headerBar.className = 'header-bar';

  // Create language section
  const languageSection = document.createElement('div');
  languageSection.className = 'language-selector';

  const languageButton = document.createElement('div');
  languageButton.className = 'language-selector-button';
  languageButton.innerHTML = `
    <span class="language-icon country-flag-usa"></span>
    <span class="country-name">EN-US</span>
    <span class="down-arrow-icon"></span>
  `;
  languageSection.appendChild(languageButton);

  // Create upload button
  const uploadButton = document.createElement('div');
  uploadButton.className = 'header-upload-button';
  uploadButton.innerHTML = `
    <a class="upload-icon">Upload</a>
  `;

  // Create help section with dropdown
  const helpSection = document.createElement('div');
  helpSection.className = 'help-section';

  const helpButton = document.createElement('div');
  helpButton.className = 'help-section-button';
  helpButton.innerHTML = `
    Help
    <span class="down-arrow-icon"></span>
  `;

  const helpMenu = document.createElement('div');
  helpMenu.className = 'help-menu dropdown-menu';
  helpMenu.innerHTML = `
    <ul></ul>
  `;

  // Fetch help menu items
  async function loadHelpMenu() {
    try {
      const configs = await fetchSpreadsheetData('configs', 'help-menu');
      const menuItems = configs?.data || [];

      const helpMenuList = helpMenu.querySelector('ul');

      // Populate menu with items
      helpMenuList.innerHTML = '';
      menuItems.forEach((item) => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${item.link}">${item.title}</a>`;
        helpMenuList.appendChild(li);
      });
    } catch (error) {
      console.error('Error loading help menu:', error);
    }
  }

  // Load help menu items
  loadHelpMenu();

  helpButton.addEventListener('click', (e) => {
    e.stopPropagation();
    // Only show dropdown if there are menu items
    const helpMenuList = helpMenu.querySelector('ul');
    if (!helpMenuList || helpMenuList.children.length === 0) {
      return;
    }
    // Close any other open dropdowns first
    const myAccountMenu = document.querySelector('.my-account-menu');
    if (myAccountMenu && myAccountMenu.style.display === 'block') {
      myAccountMenu.style.display = 'none';
      document.querySelector('.my-account-button').classList.remove('active');
    }
    // toggle display
    helpMenu.style.display = helpMenu.style.display === 'block' ? 'none' : 'block';
    helpButton.classList.toggle('active');
  });

  helpSection.appendChild(helpButton);
  helpSection.appendChild(helpMenu);

  headerBar.append(languageSection, uploadButton, helpSection);

  // Create user button (user dropdown)
  // Note: window.user not defined aka logged out should normally not happen
  //       as the user agent should be redirected to the login page before
  if (window.user) {
    const myAccount = document.createElement('div');
    myAccount.className = 'my-account';
    const myAccountButton = document.createElement('div');
    myAccountButton.className = 'my-account-button';
    myAccountButton.innerHTML = `
      <div class="avatar">${getUserInitials()}</div>
      My Account
      <span class="down-arrow-icon"></span>
    `;

    const myAccountMenu = document.createElement('div');
    myAccountMenu.className = 'my-account-menu dropdown-menu';
    myAccountMenu.innerHTML = `
      <ul>
        <li><a href="#" id="my-profile-link">My Profile</a></li>
        <li><a href="#">My Rights Requests</a></li>
        <li><a href="#">My Saved Templates</a></li>
        <li><a href="#">My Print Jobs</a></li>
        <li><a href="/my-collections">My Collections</a></li>
        <li><a href="/my-saved-search">My Saved Searches</a></li>
        <li><a href="/auth/logout">Log Out</a></li>
      </ul>
    `;
    myAccountButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any other open dropdowns first
      const openHelpMenu = document.querySelector('.help-menu');
      if (openHelpMenu && openHelpMenu.style.display === 'block') {
        openHelpMenu.style.display = 'none';
        document.querySelector('.help-section-button').classList.remove('active');
      }
      // toggle display
      myAccountMenu.style.display = myAccountMenu.style.display === 'block' ? 'none' : 'block';
      myAccountButton.classList.toggle('active');
    });
    myAccount.appendChild(myAccountButton);
    myAccount.appendChild(myAccountMenu);

    // Add event listener for My Profile link
    const profileLink = myAccountMenu.querySelector('#my-profile-link');
    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      showProfileModal();
      // Close the account menu
      myAccountMenu.style.display = 'none';
      myAccountButton.classList.remove('active');
    });

    headerBar.append(myAccount);
  }

  // Centralized click outside handler for all dropdowns
  document.addEventListener('click', (e) => {
    // Close help menu if clicking outside
    const helpSectionElement = headerBar.querySelector('.help-section');
    const helpMenuElement = helpSectionElement?.querySelector('.help-menu');
    const helpButtonElement = helpSectionElement?.querySelector('.help-section-button');

    if (helpSectionElement && !helpSectionElement.contains(e.target)
      && helpMenuElement && helpButtonElement) {
      helpMenuElement.style.display = 'none';
      helpButtonElement.classList.remove('active');
    }

    // Close my account menu if clicking outside
    const myAccountElement = headerBar.querySelector('.my-account');
    const myAccountMenuElement = myAccountElement?.querySelector('.my-account-menu');
    const myAccountButtonElement = myAccountElement?.querySelector('.my-account-button');

    if (myAccountElement && !myAccountElement.contains(e.target)
      && myAccountMenuElement && myAccountButtonElement) {
      myAccountMenuElement.style.display = 'none';
      myAccountButtonElement.classList.remove('active');
    }
  });

  return headerBar;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  block.textContent = '';

  if (getMetadata('header') === 'no') {
    // quick hack for welcome page
    block.parentElement.style.height = '60px';
    return;
  }

  block.append(await createHeaderBar());
  block.append(await createNavBar());

  // Create and render koassets-search block
  const searchBlock = document.createElement('div');
  searchBlock.className = 'koassets-search-hidden';

  // Set empty HTML - koassets-search.js now handles optional configuration
  searchBlock.innerHTML = '';

  // Decorate the search block
  try {
    await decorateKoAssetsSearch(searchBlock);
  } catch (error) {
    console.error('Error decorating searchBlock:', error);
  }

  // Clean up
  setTimeout(() => {
    searchBlock.remove();
  }, 1000);

  // Append the search block to the header (always hidden)
  block.append(searchBlock);
}
