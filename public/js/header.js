import { api } from './api.js';
import { escapeHtml, toast } from './ui.js';

let userPromise;

// pages import this too (for example to disable "Add to cart" on your own listings), so the request is shared
export function getCurrentUser() {
  // treat any failure as logged out so a broken /auth/me never breaks the whole page
  userPromise ??= api('/auth/me', { redirectOn401: false }).catch(() => null);
  return userPromise;
}

function renderHeader() {
  const q = new URLSearchParams(location.search).get('q') || '';
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="site-header__inner page-width">
      <a class="brand" href="/">
        <span class="brand__mark" aria-hidden="true">B</span>
        <span class="brand__name">Bookmarket</span>
      </a>
      <form class="site-search" action="/catalog.html" role="search">
        <label class="visually-hidden" for="site-search-q">Search books</label>
        <input id="site-search-q" type="search" name="q" placeholder="Title, author or ISBN" value="${escapeHtml(q)}">
        <button class="btn btn--ink" type="submit">Search</button>
      </form>
      <nav class="site-nav" aria-label="Account"></nav>
    </div>`;

  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#main';
  skip.textContent = 'Skip to content';

  document.body.prepend(skip, header);
  return header.querySelector('.site-nav');
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer__inner page-width">
      <p><span class="site-footer__brand">Bookmarket</span> · new and used books from real readers</p>
      <nav aria-label="Footer">
        <a href="/catalog.html">Browse books</a>
        <a href="/sell.html">Sell a book</a>
      </nav>
    </div>`;
  document.body.append(footer);
}

function renderNav(nav, user) {
  if (!user) {
    nav.innerHTML = `
      <a href="/login.html">Log in</a>
      <a class="btn btn--small" href="/register.html">Register</a>`;
    return;
  }

  const cartCount = user.cartCount || 0;
  nav.innerHTML = `
    <a class="btn btn--primary btn--small" href="/sell.html">Sell a book</a>
    <a class="site-nav__cart" href="/cart.html">
      Cart <span class="count-badge" data-cart-count ${cartCount ? '' : 'hidden'}>${cartCount}</span>
    </a>
    <details class="account-menu">
      <summary>${escapeHtml(user.name)}</summary>
      <div class="account-menu__list">
        <a href="/orders.html">My orders</a>
        <a href="/seller/listings.html">My listings</a>
        <a href="/seller/sales.html">Sales</a>
        <a href="/profile.html">Profile</a>
        <button type="button" data-logout>Log out</button>
      </div>
    </details>`;

  nav.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      location.href = '/';
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  });
}

function setCartCount(count) {
  const badge = document.querySelector('[data-cart-count]');
  if (!badge) {
    return;
  }
  badge.textContent = count;
  badge.hidden = !count;
}

const nav = renderHeader();
renderFooter();
// don't await here, because pages importing this module would then wait for /auth/me before rendering
getCurrentUser().then((user) => renderNav(nav, user));

// pages fire cart:change after editing the cart, so the badge stays right without a reload
window.addEventListener('cart:change', async () => {
  userPromise = null;
  const user = await getCurrentUser();
  setCartCount(user?.cartCount || 0);
});

// close the account menu on an outside click, which <details> doesn't do by itself
document.addEventListener('click', (event) => {
  const menu = document.querySelector('.account-menu[open]');
  if (menu && !menu.contains(event.target)) {
    menu.open = false;
  }
});

document.addEventListener('keydown', (event) => {
  const menu = document.querySelector('.account-menu[open]');
  if (event.key === 'Escape' && menu) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
