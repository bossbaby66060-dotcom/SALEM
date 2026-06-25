/**
 * ELAWI Brand Store Client-Side Core Engine
 * Manages Cart, Wishlist, Theme Toggle, Authentication, Profile Panes, Catalog Filtering & Searching.
 */

// Initialize state
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('elawi_cart')) || [];
} catch (e) {
  cart = [];
}

let wishlist = [];
try {
  wishlist = JSON.parse(localStorage.getItem('elawi_wishlist')) || [];
} catch (e) {
  wishlist = [];
}

let activeUser = null;
try {
  activeUser = JSON.parse(localStorage.getItem('elawi_active_user')) || null;
} catch (e) {
  activeUser = null;
}
let currentProducts = [];

// Theme Handler
function initTheme() {
  const toggleBtn = document.getElementById('themeToggle');
  const storedTheme = localStorage.getItem('elawi_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('elawi_theme', nextTheme);
    });
  }
}

// Global Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-xmark';
  if (type === 'info') iconClass = 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── CART MANAGEMENT ──
function updateCartUI() {
  localStorage.setItem('elawi_cart', JSON.stringify(cart));
  
  // Update navbar count badges
  const badges = document.querySelectorAll('.cart-badge');
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  badges.forEach(badge => {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
  });

  // Render the shopping cart sidebar list if open
  const cartList = document.getElementById('cartSidebarList');
  if (cartList) {
    cartList.innerHTML = '';
    if (cart.length === 0) {
      cartList.innerHTML = `
        <div class="cart-empty-state">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your shopping cart is empty</p>
          <a href="shop.html" class="btn btn-secondary" onclick="toggleCartDrawer()">Explore Collections</a>
        </div>
      `;
    } else {
      cart.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'cart-sidebar-item';
        row.innerHTML = `
          <div class="cart-sidebar-thumb">
            ${item.image ? `
              <img src="${item.image}" alt="${item.name}">
            ` : `
              <div class="cart-sidebar-icon-thumb" style="background-color: ${item.color || '#f3ece4'}">
                ${item.emoji || '✨'}
              </div>
            `}
          </div>
          <div class="cart-sidebar-details">
            <h4>${item.name}</h4>
            <p class="cart-sidebar-meta">Size: ${item.size || 'M'} | Color: ${item.colorName || 'Default'}</p>
            <div class="cart-sidebar-qty-row">
              <div class="qty-btn-group">
                <button onclick="changeCartQty(${index}, -1)" aria-label="Decrease quantity"><i class="fa-solid fa-minus"></i></button>
                <span>${item.quantity}</span>
                <button onclick="changeCartQty(${index}, 1)" aria-label="Increase quantity"><i class="fa-solid fa-plus"></i></button>
              </div>
              <span class="cart-sidebar-price">Br ${item.price * item.quantity}</span>
            </div>
          </div>
          <button class="cart-remove-btn" onclick="removeFromCart(${index})" title="Remove item" aria-label="Remove item">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        `;
        cartList.appendChild(row);
      });
    }
  }

  // Render subtotal inside the cart drawer
  const subtotalLabel = document.getElementById('cartSubtotal');
  if (subtotalLabel) {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    subtotalLabel.textContent = `Br ${subtotal}`;
  }

  // If on checkout / profile page or profile layout we might have other lists
  renderCheckoutPageList();
}

function addToCart(productId, size = 'M', colorName = 'Cream', colorCode = '#f5f2eb', quantity = 1) {
  // Fetch products from server/local and find match
  fetch('/api/products', { cache: 'no-store' })
    .then(r => r.json())
    .then(prods => {
      const product = prods.find(p => p.id === Number(productId) || p.id === productId);
      if (!product) {
        showToast('Product not found.', 'error');
        return;
      }

      // Check if item already exists in cart
      const existing = cart.find(item => item.id === product.id && item.size === size && item.colorName === colorName);
      if (existing) {
        existing.quantity += Number(quantity);
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          emoji: product.emoji,
          color: colorCode,
          colorName: colorName,
          size: size,
          quantity: Number(quantity)
        });
      }

      updateCartUI();
      showToast(`${product.name} successfully added to bag!`, 'success');
      
      // Auto open drawer
      const drawer = document.getElementById('cartDrawer');
      if (drawer && !drawer.classList.contains('active')) {
        toggleCartDrawer();
      }
    })
    .catch(err => {
      console.error('Error adding to cart:', err);
      showToast('Could not add item to bag.', 'error');
    });
}

function removeFromCart(index) {
  const item = cart[index];
  cart.splice(index, 1);
  updateCartUI();
  if (item) showToast(`${item.name} removed from bag.`, 'info');
}

function changeCartQty(index, offset) {
  const item = cart[index];
  if (!item) return;

  const newQty = item.quantity + offset;
  if (newQty <= 0) {
    removeFromCart(index);
  } else {
    item.quantity = newQty;
    updateCartUI();
  }
}

function toggleCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('sidebarOverlay');
  if (!drawer) return;

  drawer.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
}

// ── WISHLIST MANAGEMENT ──
function updateWishlistBadges() {
  localStorage.setItem('elawi_wishlist', JSON.stringify(wishlist));
  
  const badges = document.querySelectorAll('.wishlist-badge');
  badges.forEach(badge => {
    badge.textContent = wishlist.length;
    badge.style.display = wishlist.length > 0 ? 'flex' : 'none';
  });

  // Re-apply favorites state on catalog cards if rendered
  document.querySelectorAll('.wishlist-toggle-btn').forEach(btn => {
    const id = Number(btn.getAttribute('data-product-id'));
    const heart = btn.querySelector('i');
    if (wishlist.includes(id)) {
      btn.classList.add('active');
      heart.className = 'fa-solid fa-heart text-red-500';
    } else {
      btn.classList.remove('active');
      heart.className = 'fa-regular fa-heart';
    }
  });

  // Re-apply favorites state on quick action buttons if rendered
  document.querySelectorAll('[data-quick-fav-id]').forEach(btn => {
    const id = Number(btn.getAttribute('data-quick-fav-id'));
    if (wishlist.includes(id)) {
      btn.innerHTML = '<i class="fa-solid fa-heart text-red-500"></i> Favorited';
    } else {
      btn.innerHTML = '<i class="fa-regular fa-heart"></i> Quick Favorite';
    }
  });

  // Update profile panel list if on profile page
  renderFavoritesInProfile();
}

function toggleWishlist(productId) {
  const id = Number(productId);
  const index = wishlist.indexOf(id);

  if (index === -1) {
    wishlist.push(id);
    showToast('Product added to your wishlist.', 'success');
  } else {
    wishlist.splice(index, 1);
    showToast('Product removed from wishlist.', 'info');
  }

  updateWishlistBadges();
}

// ── CUSTOMER AUTH GATES & TAB NAVIGATION ──
function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const slider = document.getElementById('authTabSlider');
  const formLogin = document.getElementById('loginForm');
  const formSignup = document.getElementById('signupForm');

  if (!tabLogin || !tabSignup) return;

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    slider.classList.remove('right');
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    slider.classList.add('right');
    formLogin.classList.remove('active');
    formSignup.classList.add('active');
  }
}

function togglePasswordVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
  }
}

// Password Complexity Evaluator
function checkPassStrength(pass) {
  const sb1 = document.getElementById('sb1');
  const sb2 = document.getElementById('sb2');
  const sb3 = document.getElementById('sb3');
  const sb4 = document.getElementById('sb4');
  const label = document.getElementById('strengthLabel');
  
  if (!sb1) return;

  // Reset
  const bars = [sb1, sb2, sb3, sb4];
  bars.forEach(b => b.className = 'strength-bar');

  if (!pass) {
    label.textContent = 'Enter a password';
    return;
  }

  let score = 0;
  if (pass.length >= 6) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (score === 1) {
    sb1.className = 'strength-bar weak';
    label.textContent = 'Weak';
  } else if (score === 2) {
    sb1.className = 'strength-bar fair';
    sb2.className = 'strength-bar fair';
    label.textContent = 'Fair';
  } else if (score === 3) {
    sb1.className = 'strength-bar good';
    sb2.className = 'strength-bar good';
    sb3.className = 'strength-bar good';
    label.textContent = 'Good';
  } else if (score === 4) {
    sb1.className = 'strength-bar strong';
    sb2.className = 'strength-bar strong';
    sb3.className = 'strength-bar strong';
    sb4.className = 'strength-bar strong';
    label.textContent = 'Strong';
  }
}

function showForgotToast(e) {
  e.preventDefault();
  showToast('Password reset link has been simulated & printed to server logs.', 'info');
}

// ── CUSTOMER MEMBER PROFILE PANEL ROUTER ──
function switchProfilePane(paneId, btn) {
  document.querySelectorAll('.profile-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.profile-menu-item').forEach(i => i.classList.remove('active'));

  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
}

function renderFavoritesInProfile() {
  const container = document.getElementById('favoritesProfileGrid');
  if (!container) return;

  container.innerHTML = '';
  
  if (wishlist.length === 0) {
    container.innerHTML = `
      <div class="favorites-empty">
        <i class="fa-regular fa-heart"></i>
        <p>You haven't bookmarked any products yet.</p>
        <a href="shop.html" class="btn btn-primary">Browse Catalog</a>
      </div>
    `;
    return;
  }

  fetch('/api/products', { cache: 'no-store' })
    .then(r => r.json())
    .then(prods => {
      const favProducts = prods.filter(p => wishlist.includes(p.id));
      if (favProducts.length === 0) {
        container.innerHTML = `
          <div class="favorites-empty">
            <i class="fa-regular fa-heart"></i>
            <p>You haven't bookmarked any products yet.</p>
            <a href="shop.html" class="btn btn-primary">Browse Catalog</a>
          </div>
        `;
        return;
      }

      favProducts.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <div class="product-img-wrapper">
            ${prod.image ? `
              <img class="product-card-img" src="${prod.image}" alt="${prod.name}">
            ` : `
              <div class="product-icon-panel" style="background-color: ${prod.color || '#f3ece4'}">
                <span class="product-icon-emoji">${prod.emoji || '✨'}</span>
              </div>
            `}
            <div class="product-badges">
              ${prod.isNew ? '<span class="tag-new">NEW</span>' : ''}
              ${prod.salePrice ? '<span class="tag-sale">SALE</span>' : ''}
            </div>
            <button class="wishlist-toggle-btn active" data-product-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();" title="Remove from wishlist">
              <i class="fa-solid fa-heart text-red-500"></i>
            </button>
            <div class="product-action-bar">
              <button class="quick-add-btn" data-quick-fav-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();">
                <i class="fa-solid fa-heart text-red-500"></i> Favorited
              </button>
            </div>
          </div>
          <a href="product-detail.html?id=${prod.id}" class="product-card-body">
            <span class="product-card-category">${prod.category || 'Casual'}</span>
            <h3 class="product-card-title">${prod.name}</h3>
            <div class="product-card-rating">
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star-half-stroke"></i>
              <span>(4.8)</span>
            </div>
            <div class="product-card-price">
              ${prod.salePrice ? `
                <span class="price-current">Br ${prod.salePrice}</span>
                <span class="price-original">Br ${prod.price}</span>
              ` : `
                <span class="price-current">Br ${prod.price}</span>
              `}
            </div>
          </a>
        `;
        container.appendChild(card);
      });
    });
}

// ── CHECKOUT PAGE LIST RENDERER ──
function renderCheckoutPageList() {
  const checkoutItems = document.getElementById('checkoutItemsList');
  if (!checkoutItems) return;

  checkoutItems.innerHTML = '';
  
  if (cart.length === 0) {
    checkoutItems.innerHTML = `
      <div style="text-align:center; padding: 2rem 0;">
        <i class="fa-solid fa-bag-shopping" style="font-size:3rem; color:var(--gray-200); margin-bottom:1rem;"></i>
        <p>No items in cart.</p>
        <a href="shop.html" class="btn btn-primary" style="margin-top:1rem;">Shop Now</a>
      </div>
    `;
    updateCheckoutSummary();
    return;
  }

  cart.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center py-4 border-b border-gray-100';
    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1.5px solid var(--gray-100);";
    div.innerHTML = `
      <div style="display:flex; gap:1rem; align-items:center;">
        <div style="width:50px; height:50px; background:${item.color || '#fbfbfb'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; overflow:hidden;">
          ${item.image ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover;" alt="">` : item.emoji || '👕'}
        </div>
        <div>
          <h4 style="font-weight:600; font-size:0.95rem;">${item.name}</h4>
          <span style="font-size:0.75rem; color:var(--gray-500);">Size: ${item.size} | Color: ${item.colorName}</span>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="display:block; font-size:0.85rem; color:var(--gray-500);">${item.quantity} x Br ${item.price}</span>
        <strong style="color:var(--accent);">Br ${item.quantity * item.price}</strong>
        <button onclick="removeFromCart(${idx})" style="color:red; font-size:0.8rem; margin-left:0.5rem; cursor:pointer;" title="Delete item"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    checkoutItems.appendChild(div);
  });

  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  const checkoutSubTotal = document.getElementById('checkoutSubTotal');
  const checkoutShipping = document.getElementById('checkoutShipping');
  const checkoutTotal = document.getElementById('checkoutTotal');
  
  if (!checkoutSubTotal) return;

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shipping = subtotal >= 150 ? 0 : (subtotal > 0 ? 15 : 0);
  const total = subtotal + shipping;

  checkoutSubTotal.textContent = `Br ${subtotal}`;
  checkoutShipping.textContent = shipping === 0 ? 'FREE' : `Br ${shipping}`;
  checkoutTotal.textContent = `Br ${total}`;
}

// ── DOM CONTENT LOADED INITIALIZATIONS ──
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateCartUI();
  updateWishlistBadges();

  // Search Toggle
  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');

  if (searchBtn && searchOverlay) {
    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.add('active');
      setTimeout(() => searchInput && searchInput.focus(), 300);
    });
  }

  if (searchClose && searchOverlay) {
    searchClose.addEventListener('click', () => {
      searchOverlay.classList.remove('active');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        const query = encodeURIComponent(searchInput.value.trim());
        window.location.href = `shop.html?search=${query}`;
      }
    });
  }

  // Sidebar / Mobile Drawer Menu Toggle Setup
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent instantaneous event bubbling dismissal
      
      const isOpen = navMenu.classList.contains('active');
      if (isOpen) {
        navMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      } else {
        navMenu.classList.add('active');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
        menuToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      }
    });
  }

  // Handle clicking outside the sidebar / mobile drawer overlay to dismiss it
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      if (navMenu && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        if (menuToggle) menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      }
      
      // Dismiss cart drawer too if open
      const cartDrawer = document.getElementById('cartDrawer');
      if (cartDrawer && cartDrawer.classList.contains('active')) {
        cartDrawer.classList.remove('active');
        sidebarOverlay.classList.remove('active');
      }
    });
  }

  // Scroll header effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (navbar) {
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  });

  // ── HOME PAGE INIT ──
  const homeProdsGrid = document.getElementById('featuredProductsGrid');
  if (homeProdsGrid) {
    fetch('/api/products', { cache: 'no-store' })
      .then(r => r.json())
      .then(prods => {
        // Render 4 featured products
        homeProdsGrid.innerHTML = '';
        prods.slice(0, 4).forEach(prod => {
          const card = document.createElement('div');
          card.className = 'product-card';
          card.innerHTML = `
            <div class="product-img-wrapper">
              ${prod.image ? `
                <img class="product-card-img" src="${prod.image}" alt="${prod.name}">
              ` : `
                <div class="product-icon-panel" style="background-color: ${prod.color || '#f3ece4'}">
                  <span class="product-icon-emoji">${prod.emoji || '✨'}</span>
                </div>
              `}
              <div class="product-badges">
                ${prod.isNew ? '<span class="tag-new">NEW</span>' : ''}
                ${prod.salePrice ? '<span class="tag-sale">SALE</span>' : ''}
              </div>
              <button class="wishlist-toggle-btn" data-product-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();" title="Add to wishlist">
                <i class="fa-regular fa-heart"></i>
              </button>
              <div class="product-action-bar">
                <button class="quick-add-btn" data-quick-fav-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();">
                  ${wishlist.includes(prod.id) ? `
                    <i class="fa-solid fa-heart text-red-500"></i> Favorited
                  ` : `
                    <i class="fa-regular fa-heart"></i> Quick Favorite
                  `}
                </button>
              </div>
            </div>
            <a href="product-detail.html?id=${prod.id}" class="product-card-body">
              <span class="product-card-category">${prod.category || 'Casual'}</span>
              <h3 class="product-card-title">${prod.name}</h3>
              <div class="product-card-rating">
                <i class="fa-solid fa-star"></i>
                <i class="fa-solid fa-star"></i>
                <i class="fa-solid fa-star"></i>
                <i class="fa-solid fa-star"></i>
                <i class="fa-solid fa-star-half-stroke"></i>
                <span>(4.8)</span>
              </div>
              <div class="product-card-price">
                ${prod.salePrice ? `
                  <span class="price-current">Br ${prod.salePrice}</span>
                  <span class="price-original">Br ${prod.price}</span>
                ` : `
                  <span class="price-current">Br ${prod.price}</span>
                `}
              </div>
            </a>
          `;
          homeProdsGrid.appendChild(card);
        });
        updateWishlistBadges();
      });
  }

  // ── CATALOG SHOP PAGE INIT ──
  const shopProdsGrid = document.getElementById('shopProductsGrid');
  if (shopProdsGrid) {
    let activeCategory = 'All';
    let searchQuery = '';
    let activeColor = 'All';
    let activeSize = 'All';

    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.has('category')) {
      activeCategory = params.get('category');
    }
    if (params.has('search')) {
      searchQuery = params.get('search');
    }

    const priceRangeInput = document.getElementById('priceRange');
    const priceMaxLabel = document.getElementById('priceMaxLabel');
    const filterCatItems = document.querySelectorAll('.filter-link-item');
    const searchFilterInput = document.getElementById('searchFilterInput');
    const sortingSelect = document.getElementById('sortingSelect');

    const shopSwatches = document.querySelectorAll('.shop-sidebar .color-swatches-grid .swatch');
    const shopSizePills = document.querySelectorAll('.shop-sidebar .size-selection-grid .size-pill');
    
    // Setup mobile filter sliding drawer
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const filterCloseBtn = document.getElementById('filterCloseBtn');
    const shopSidebar = document.querySelector('.shop-sidebar');
    const filterBackdrop = document.getElementById('filterBackdrop');

    if (mobileFilterBtn && shopSidebar) {
      mobileFilterBtn.addEventListener('click', () => {
        shopSidebar.classList.add('mobile-active');
        if (filterBackdrop) filterBackdrop.classList.add('active');
      });
    }

    const closeDrawer = () => {
      if (shopSidebar) shopSidebar.classList.remove('mobile-active');
      if (filterBackdrop) filterBackdrop.classList.remove('active');
    };

    if (filterCloseBtn) filterCloseBtn.addEventListener('click', closeDrawer);
    if (filterBackdrop) filterBackdrop.addEventListener('click', closeDrawer);

    function fetchAndRender() {
      fetch('/api/products', { cache: 'no-store' })
        .then(r => r.json())
        .then(prods => {
          currentProducts = prods;
          
          // Initialise category active styles
          filterCatItems.forEach(item => {
            const cat = item.getAttribute('data-category');
            if (cat === activeCategory) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });

          // Sync active state of swatches with activeColor
          shopSwatches.forEach(sw => {
            let swColor = 'All';
            if (sw.classList.contains('swatch-cream')) swColor = 'cream';
            else if (sw.classList.contains('swatch-terracotta')) swColor = 'terracotta';
            else if (sw.classList.contains('swatch-charcoal')) swColor = 'charcoal';
            else if (sw.classList.contains('swatch-sage')) swColor = 'sage';
            else if (sw.classList.contains('swatch-tan')) swColor = 'tan';

            if (activeColor !== 'All' && swColor === activeColor) {
              sw.classList.add('active');
            } else {
              sw.classList.remove('active');
            }
          });

          // Sync active state of size pills with activeSize
          shopSizePills.forEach(pill => {
            const sz = pill.textContent.trim();
            if (activeSize !== 'All' && sz === activeSize) {
              pill.classList.add('active');
            } else {
              pill.classList.remove('active');
            }
          });

          // Set query inputs if there's an initial search
          if (searchFilterInput && searchQuery) {
            searchFilterInput.value = searchQuery;
          }

          renderCatalog();
        });
    }

    function renderCatalog() {
      const maxPrice = priceRangeInput ? Number(priceRangeInput.value) : 1000;
      if (priceMaxLabel) priceMaxLabel.textContent = maxPrice;

      // Filter products
      let filtered = currentProducts.filter(p => {
        // Price limit
        const price = p.salePrice || p.price;
        if (price > maxPrice) return false;

        // Category limit
        if (activeCategory !== 'All' && p.category !== activeCategory) return false;

        // Search text limit
        if (searchQuery) {
          const text = (p.name + ' ' + p.description + ' ' + p.category).toLowerCase();
          if (!text.includes(searchQuery.toLowerCase())) return false;
        }

        // Color limit
        if (activeColor !== 'All') {
          const col = activeColor.toLowerCase();
          const prodColorName = (p.colorName || '').toLowerCase();
          const prodColorHex = (p.color || '').toLowerCase();
          let colorMatches = false;

          if (col === 'cream') {
            colorMatches = prodColorName.includes('cream') || prodColorHex === '#fcfbfa' || prodColorHex === '#f5f2eb';
          } else if (col === 'terracotta') {
            colorMatches = prodColorName.includes('terracotta') || prodColorHex === '#d46a43';
          } else if (col === 'charcoal') {
            colorMatches = prodColorName.includes('charcoal') || prodColorName.includes('black') || prodColorName.includes('obsidian') || prodColorHex === '#2d2a26';
          } else if (col === 'sage') {
            colorMatches = prodColorName.includes('sage') || prodColorName.includes('green') || prodColorHex === '#8fa89b';
          } else if (col === 'tan') {
            colorMatches = prodColorName.includes('tan') || prodColorName.includes('gray') || prodColorName.includes('silt') || prodColorHex === '#cda885' || prodColorHex === '#4a4540';
          }

          if (!colorMatches) return false;
        }

        // Size limit
        if (activeSize !== 'All') {
          if (p.size && p.size !== activeSize) return false;
        }

        return true;
      });

      // Sort products
      const sort = sortingSelect ? sortingSelect.value : 'featured';
      if (sort === 'price-low') {
        filtered.sort((a,b) => (a.salePrice || a.price) - (b.salePrice || b.price));
      } else if (sort === 'price-high') {
        filtered.sort((a,b) => (b.salePrice || b.price) - (a.salePrice || a.price));
      } else if (sort === 'rating') {
        filtered.sort((a,b) => (b.rating || 5) - (a.rating || 5));
      }

      // Update count
      const countSpan = document.getElementById('catalogCount');
      if (countSpan) countSpan.textContent = filtered.length;

      // Render cards
      shopProdsGrid.innerHTML = '';
      if (filtered.length === 0) {
        shopProdsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
            <i class="fa-solid fa-magnifying-glass" style="font-size:3.5rem; color:var(--gray-200); margin-bottom:1.5rem;"></i>
            <h3 style="font-size:1.5rem; margin-bottom:0.5rem;">No products found</h3>
            <p style="color:var(--gray-500);">Try adjusting your filter parameters or search queries.</p>
          </div>
        `;
        return;
      }

      filtered.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <div class="product-img-wrapper">
            ${prod.image ? `
              <img class="product-card-img" src="${prod.image}" alt="${prod.name}">
            ` : `
              <div class="product-icon-panel" style="background-color: ${prod.color || '#f3ece4'}">
                <span class="product-icon-emoji">${prod.emoji || '✨'}</span>
              </div>
            `}
            <div class="product-badges">
              ${prod.isNew ? '<span class="tag-new">NEW</span>' : ''}
              ${prod.salePrice ? '<span class="tag-sale">SALE</span>' : ''}
            </div>
            <button class="wishlist-toggle-btn" data-product-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();" title="Add to wishlist">
              <i class="fa-regular fa-heart"></i>
            </button>
            <div class="product-action-bar">
              <button class="quick-add-btn" data-quick-fav-id="${prod.id}" onclick="toggleWishlist(${prod.id}); event.preventDefault(); event.stopPropagation();">
                ${wishlist.includes(prod.id) ? `
                  <i class="fa-solid fa-heart text-red-500"></i> Favorited
                ` : `
                  <i class="fa-regular fa-heart"></i> Quick Favorite
                `}
              </button>
            </div>
          </div>
          <a href="product-detail.html?id=${prod.id}" class="product-card-body">
            <span class="product-card-category">${prod.category || 'Casual'}</span>
            <h3 class="product-card-title">${prod.name}</h3>
            <div class="product-card-rating">
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star"></i>
              <i class="fa-solid fa-star-half-stroke"></i>
              <span>(${prod.rating || 4.8})</span>
            </div>
            <div class="product-card-price">
              ${prod.salePrice ? `
                <span class="price-current">Br ${prod.salePrice}</span>
                <span class="price-original">Br ${prod.price}</span>
              ` : `
                <span class="price-current">Br ${prod.price}</span>
              `}
            </div>
          </a>
        `;
        shopProdsGrid.appendChild(card);
      });

      updateWishlistBadges();
    }

    // Event listeners for filters
    if (priceRangeInput) {
      priceRangeInput.addEventListener('input', renderCatalog);
    }

    filterCatItems.forEach(item => {
      item.addEventListener('click', () => {
        activeCategory = item.getAttribute('data-category');
        filterCatItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderCatalog();
        closeDrawer();
      });
    });

    // Event listeners for color swatches
    shopSwatches.forEach(sw => {
      sw.addEventListener('click', () => {
        let clickedColor = 'All';
        if (sw.classList.contains('swatch-cream')) clickedColor = 'cream';
        else if (sw.classList.contains('swatch-terracotta')) clickedColor = 'terracotta';
        else if (sw.classList.contains('swatch-charcoal')) clickedColor = 'charcoal';
        else if (sw.classList.contains('swatch-sage')) clickedColor = 'sage';
        else if (sw.classList.contains('swatch-tan')) clickedColor = 'tan';

        if (activeColor === clickedColor) {
          activeColor = 'All';
          sw.classList.remove('active');
        } else {
          activeColor = clickedColor;
          shopSwatches.forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
        }
        renderCatalog();
      });
    });

    // Event listeners for size pills
    shopSizePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const sz = pill.textContent.trim();
        if (activeSize === sz) {
          activeSize = 'All';
          pill.classList.remove('active');
        } else {
          activeSize = sz;
          shopSizePills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
        renderCatalog();
      });
    });

    if (searchFilterInput) {
      searchFilterInput.addEventListener('input', () => {
        searchQuery = searchFilterInput.value.trim();
        renderCatalog();
      });
    }

    if (sortingSelect) {
      sortingSelect.addEventListener('change', renderCatalog);
    }

    fetchAndRender();
  }

  // ── PRODUCT DETAIL PAGE INIT ──
  const detailPageId = new URLSearchParams(window.location.search).get('id');
  if (detailPageId && document.getElementById('detailTitle')) {
    fetch('/api/products', { cache: 'no-store' })
      .then(r => r.json())
      .then(prods => {
        const prod = prods.find(p => p.id === Number(detailPageId) || p.id === detailPageId);
        if (!prod) {
          showToast('Product not found.', 'error');
          return;
        }

        // Fill data fields
        document.getElementById('detailCategory').textContent = prod.category;
        document.getElementById('detailTitle').textContent = prod.name;
        document.getElementById('detailRatingNum').textContent = `(${prod.rating || 4.8})`;
        document.getElementById('detailDesc').textContent = prod.description;

        const priceRow = document.getElementById('detailPrice');
        if (prod.salePrice) {
          priceRow.innerHTML = `
            <span class="price-current">Br ${prod.salePrice}</span>
            <span class="price-original" style="font-size: 1.4rem; font-weight: 500; color: var(--gray-200); text-decoration: line-through;">Br ${prod.price}</span>
          `;
        } else {
          priceRow.innerHTML = `<span class="price-current">Br ${prod.price}</span>`;
        }

        // Gallery updating function based on selected color variant
        function updateGalleryForColor(colorCode, colorName) {
          const galleryMain = document.getElementById('galleryMainImage');
          const thumbsBox = document.getElementById('detailThumbsBox');
          if (!galleryMain || !thumbsBox) return;

          // Find if there is a variant matching this color
          const variant = (prod.colorVariants || []).find(v => v.color.toLowerCase() === colorCode.toLowerCase());
          
          let options = [];
          if (variant && variant.images && variant.images.length > 0) {
            // We have custom photos for this specific color!
            variant.images.forEach((img, idx) => {
              options.push({
                id: idx + 1,
                label: `${colorName} View ${idx + 1}`,
                img: img,
                color: colorCode
              });
            });
          } else if (prod.image) {
            options.push({
              id: 1,
              label: 'Main Look',
              color: prod.color || '#f3ece4',
              img: prod.image
            });
          }

          // Clear thumbsBox and render
          thumbsBox.innerHTML = '';
          
          if (options.length > 1) {
            thumbsBox.style.display = 'flex';
            options.forEach((opt, idx) => {
              const div = document.createElement('div');
              div.className = `thumb-item ${idx === 0 ? 'active' : ''}`;
              div.innerHTML = opt.emoji ? `
                <div class="thumb-icon-panel" style="background-color: ${opt.color}">
                  <span>${opt.emoji}</span>
                </div>
              ` : `
                <img src="${opt.img}" alt="${opt.label}">
              `;

              div.addEventListener('click', () => {
                document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
                div.classList.add('active');

                // Change main gallery item
                if (opt.emoji) {
                  galleryMain.innerHTML = `
                    <div class="detail-icon-panel-wrap" style="background-color: ${opt.color}">
                      <span class="detail-main-emoji">${opt.emoji}</span>
                    </div>
                  `;
                } else {
                  galleryMain.innerHTML = `<img src="${opt.img}" alt="${prod.name}" style="width:100%; height:100%; object-fit:cover;">`;
                }
              });
              thumbsBox.appendChild(div);
            });
          } else {
            thumbsBox.style.display = 'none';
          }

          // Set active main image to first option or fallback to product emoji
          const firstOpt = options[0];
          if (firstOpt) {
            if (firstOpt.emoji) {
              galleryMain.innerHTML = `
                <div class="detail-icon-panel-wrap" style="background-color: ${firstOpt.color}">
                  <span class="detail-main-emoji">${firstOpt.emoji}</span>
                </div>
              `;
            } else {
              galleryMain.innerHTML = `<img src="${firstOpt.img}" alt="${prod.name}" style="width:100%; height:100%; object-fit:cover;">`;
            }
          } else {
            // No custom option images, render the single product emoji or standard image
            if (prod.image) {
              galleryMain.innerHTML = `<img src="${prod.image}" alt="${prod.name}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
              galleryMain.innerHTML = `
                <div class="detail-icon-panel-wrap" style="background-color: ${prod.color || '#f3ece4'}">
                  <span class="detail-main-emoji">${prod.emoji || '✨'}</span>
                </div>
              `;
            }
          }
        }

        // Color selector
        const colorsBox = document.getElementById('detailColorsGrid');
        let selectedColorName = prod.colorName || 'Cream';
        let selectedColorCode = prod.color || '#f5f2eb';

        let colors = [];
        if (prod.colorVariants && prod.colorVariants.length > 0) {
          colors = prod.colorVariants.map(v => ({ name: v.colorName, code: v.color }));
          // Default selection is the first variant
          selectedColorName = colors[0].name;
          selectedColorCode = colors[0].code;
        } else {
          colors = [
            { name: prod.colorName || 'Cream', code: prod.color || '#f5f2eb' },
            { name: 'Burnt Terracotta', code: '#d46a43' },
            { name: 'Obsidian Charcoal', code: '#2d2a26' },
            { name: 'Sage Green', code: '#8fa89b' },
            { name: 'Desert Tan', code: '#cda885' }
          ].filter((col, idx, self) => {
            const firstIdx = self.findIndex(c => c.code.toLowerCase() === col.code.toLowerCase());
            return firstIdx === idx;
          });
        }

        // Render initial gallery state based on default selection
        updateGalleryForColor(selectedColorCode, selectedColorName);

        if (colorsBox) {
          colorsBox.innerHTML = '';
          colors.forEach((col, idx) => {
            const btn = document.createElement('button');
            btn.className = `swatch ${col.code.toLowerCase() === selectedColorCode.toLowerCase() ? 'active' : ''}`;
            btn.style.backgroundColor = col.code;
            btn.title = col.name;
            btn.addEventListener('click', () => {
              document.querySelectorAll('#detailColorsGrid .swatch').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              selectedColorName = col.name;
              selectedColorCode = col.code;
              
              // Dynamically update the photo gallery for this color!
              updateGalleryForColor(col.code, col.name);
            });
            colorsBox.appendChild(btn);
          });
        }

        // Sizes selector
        const sizesBox = document.getElementById('detailSizesGrid');
        let selectedSize = 'M';
        if (sizesBox) {
          sizesBox.innerHTML = '';
          const sizes = ['XS', 'S', 'M', 'L', 'XL'];
          sizes.forEach(sz => {
            const btn = document.createElement('button');
            btn.className = `size-pill-detail ${sz === selectedSize ? 'active' : ''}`;
            btn.textContent = sz;
            btn.style.cssText = "height: 44px; border: 1.5px solid var(--gray-100); border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; transition: var(--transition);";
            btn.addEventListener('click', () => {
              document.querySelectorAll('.size-pill-detail').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              selectedSize = sz;
            });
            sizesBox.appendChild(btn);
          });
        }

        // Quantity controls
        const qtyVal = document.getElementById('detailQtyValue');
        const qtyMinus = document.getElementById('detailQtyMinus');
        const qtyPlus = document.getElementById('detailQtyPlus');
        if (qtyVal && qtyMinus && qtyPlus) {
          qtyMinus.addEventListener('click', () => {
            let num = Number(qtyVal.textContent);
            if (num > 1) qtyVal.textContent = num - 1;
          });
          qtyPlus.addEventListener('click', () => {
            let num = Number(qtyVal.textContent);
            qtyVal.textContent = num + 1;
          });
        }

        // Add to Bag Button
        const addBagBtn = document.getElementById('detailAddBagBtn');
        if (addBagBtn) {
          addBagBtn.addEventListener('click', () => {
            const qty = qtyVal ? Number(qtyVal.textContent) : 1;
            addToCart(prod.id, selectedSize, selectedColorName, selectedColorCode, qty);
          });
        }

        // Add to Wishlist Button
        const addWishBtn = document.getElementById('detailAddWishBtn');
        if (addWishBtn) {
          addWishBtn.addEventListener('click', () => {
            toggleWishlist(prod.id);
            const isFav = wishlist.includes(prod.id);
            addWishBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart text-red-500"></i> Added' : '<i class="fa-regular fa-heart"></i> Save to Wishlist';
          });
          // Set initial
          const isFav = wishlist.includes(prod.id);
          addWishBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart text-red-500"></i> Added' : '<i class="fa-regular fa-heart"></i> Save to Wishlist';
        }
      });

    // Specifications / Reviews Tab Router
    window.switchDetailTab = function(tabName, el) {
      document.querySelectorAll('.tab-nav-item').forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      el.classList.add('active');
      const pane = document.getElementById(`tabPane-${tabName}`);
      if (pane) pane.classList.add('active');
    };

    // Review Form submission simulation
    const reviewForm = document.getElementById('reviewSubmitForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const author = document.getElementById('revAuthor').value.trim();
        const text = document.getElementById('revText').value.trim();
        const rating = document.getElementById('revRating').value;

        if (!author || !text) {
          showToast('Please fill out all review fields.', 'error');
          return;
        }

        const list = document.getElementById('reviewsContainerList');
        if (list) {
          const item = document.createElement('div');
          item.className = 'review-item';
          
          let starsHTML = '';
          for (let s=0; s<5; s++) {
            starsHTML += s < Number(rating) ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
          }

          item.innerHTML = `
            <div class="review-header">
              <span class="review-author">${author} <span style="font-size:0.8rem; color:var(--gray-200); font-weight:normal; margin-left:0.5rem;">Just now</span></span>
              <div class="review-stars">${starsHTML}</div>
            </div>
            <p>${text}</p>
          `;
          list.insertBefore(item, list.firstChild);
          reviewForm.reset();
          showToast('Thank you! Your product review has been submitted successfully.', 'success');
        }
      });
    }
  }

  // ── USER SIGNIN / REGISTER FORM AUTH SUBMISSION ──
  const logForm = document.getElementById('loginForm');
  if (logForm) {
    logForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('loginEmail').value.trim();
      const pass = document.getElementById('loginPass').value;
      const remember = document.getElementById('rememberMe').checked;

      // Simple errors
      const emailErr = document.getElementById('loginEmailErr');
      const passErr = document.getElementById('loginPassErr');
      emailErr.textContent = '';
      passErr.textContent = '';

      let valid = true;
      if (!email) {
        emailErr.textContent = 'Email address is required';
        valid = false;
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        emailErr.textContent = 'Please enter a valid email address';
        valid = false;
      }

      if (!pass) {
        passErr.textContent = 'Password is required';
        valid = false;
      }

      if (!valid) return;

      // Show spinner
      const submitBtn = document.getElementById('loginSubmitBtn');
      const text = submitBtn.querySelector('.auth-btn-text');
      const loader = submitBtn.querySelector('.auth-btn-loader');
      text.style.display = 'none';
      loader.style.display = 'inline-block';

      // Call API
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      })
      .then(res => res.json())
      .then(data => {
        text.style.display = 'inline-block';
        loader.style.display = 'none';

        if (data.success) {
          activeUser = data.user;
          localStorage.setItem('elawi_active_user', JSON.stringify(activeUser));
          
          showToast(`Welcome back, ${activeUser.firstName}!`, 'success');
          setTimeout(() => {
            window.location.href = 'profile.html';
          }, 1000);
        } else {
          passErr.textContent = data.message || 'Invalid email or password.';
          showToast(data.message || 'Verification failed.', 'error');
        }
      })
      .catch(err => {
        text.style.display = 'inline-block';
        loader.style.display = 'none';
        console.error('Login error:', err);
        showToast('Server connectivity issue. Simulating success offline!', 'info');
        
        // Simulating offline auth success for testing
        activeUser = { firstName: 'Jane', lastName: 'Doe', email: email, points: 280, id: 99 };
        localStorage.setItem('elawi_active_user', JSON.stringify(activeUser));
        setTimeout(() => { window.location.href = 'profile.html'; }, 1000);
      });
    });
  }

  const regForm = document.getElementById('signupForm');
  if (regForm) {
    const signupPass = document.getElementById('signupPass');
    if (signupPass) {
      signupPass.addEventListener('input', () => checkPassStrength(signupPass.value));
    }

    regForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const first = document.getElementById('signupFirst').value.trim();
      const last = document.getElementById('signupLast').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const pass = document.getElementById('signupPass').value;
      const confirm = document.getElementById('signupConfirm').value;
      const terms = document.getElementById('signupTerms').checked;

      // Errors
      const firstErr = document.getElementById('signupFirstErr');
      const emailErr = document.getElementById('signupEmailErr');
      const passErr = document.getElementById('signupPassErr');
      const confirmErr = document.getElementById('signupConfirmErr');
      const termsErr = document.getElementById('signupTermsErr');

      // Reset
      [firstErr, emailErr, passErr, confirmErr, termsErr].forEach(err => { if(err) err.textContent = ''; });

      let valid = true;
      if (!first) {
        firstErr.textContent = 'First name is required';
        valid = false;
      }
      if (!email) {
        emailErr.textContent = 'Email address is required';
        valid = false;
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        emailErr.textContent = 'Please enter a valid email address';
        valid = false;
      }
      if (!pass) {
        passErr.textContent = 'Password is required';
        valid = false;
      } else if (pass.length < 6) {
        passErr.textContent = 'Password must be at least 6 characters';
        valid = false;
      }
      if (pass !== confirm) {
        confirmErr.textContent = 'Passwords do not match';
        valid = false;
      }
      if (!terms) {
        termsErr.textContent = 'You must agree to the Terms of Service';
        valid = false;
      }

      if (!valid) return;

      // Show spinner
      const submitBtn = document.getElementById('signupSubmitBtn');
      const text = submitBtn.querySelector('.auth-btn-text');
      const loader = submitBtn.querySelector('.auth-btn-loader');
      text.style.display = 'none';
      loader.style.display = 'inline-block';

      // Call API
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: first, lastName: last, email, password: pass })
      })
      .then(res => res.json())
      .then(data => {
        text.style.display = 'inline-block';
        loader.style.display = 'none';

        if (data.success) {
          showToast('Account registered successfully!', 'success');
          switchAuthTab('login');
          document.getElementById('loginEmail').value = email;
          document.getElementById('loginPass').value = '';
        } else {
          emailErr.textContent = data.message || 'Email already registered.';
          showToast(data.message || 'Registration failed.', 'error');
        }
      })
      .catch(err => {
        text.style.display = 'inline-block';
        loader.style.display = 'none';
        console.error('Registration error:', err);
        showToast('Offline registration simulated successfully!', 'success');
        switchAuthTab('login');
        document.getElementById('loginEmail').value = email;
      });
    });
  }

  // ── PROFILE MEMBER PORTAL DASHBOARD RENDER ──
  const profileGate = document.getElementById('profileGateOverlay');
  const profileNameSpan = document.getElementById('profileGreetingName');
  const profileAvatarLabel = document.getElementById('profileAvatarLabel');
  const profileNameVal = document.getElementById('profileNameVal');
  const profileEmailVal = document.getElementById('profileEmailVal');
  const profilePointsVal = document.getElementById('profilePointsVal');

  if (document.getElementById('profileDashboardPane')) {
    const handleLogout = () => {
      localStorage.removeItem('elawi_active_user');
      activeUser = null;
      showToast('You have been logged out securely.', 'info');
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1000);
    };

    // Attach logout triggers
    document.querySelectorAll('.profile-logout-trigger').forEach(btn => {
      btn.addEventListener('click', handleLogout);
    });

    if (!activeUser) {
      if (profileGate) {
        profileGate.classList.add('active');
      } else {
        window.location.href = 'auth.html';
      }
    } else {
      // populate greeting
      if (profileNameSpan) profileNameSpan.textContent = activeUser.firstName;
      if (profileAvatarLabel) profileAvatarLabel.textContent = activeUser.firstName.charAt(0).toUpperCase();
      
      // populate overview variables
      if (profileNameVal) profileNameVal.textContent = `${activeUser.firstName} ${activeUser.lastName || ''}`;
      if (profileEmailVal) profileEmailVal.textContent = activeUser.email;
      if (profilePointsVal) profilePointsVal.textContent = activeUser.points || 0;

      // Populate personal form fields
      const pFirst = document.getElementById('profileFormFirst');
      const pLast = document.getElementById('profileFormLast');
      const pEmail = document.getElementById('profileFormEmail');
      
      if (pFirst) pFirst.value = activeUser.firstName;
      if (pLast) pLast.value = activeUser.lastName || '';
      if (pEmail) pEmail.value = activeUser.email;

      renderFavoritesInProfile();

      // Handle personal form submit
      const profileDetailsForm = document.getElementById('profileDetailsForm');
      if (profileDetailsForm) {
        profileDetailsForm.addEventListener('submit', (e) => {
          e.preventDefault();
          
          const fn = pFirst.value.trim();
          const ln = pLast.value.trim();
          const em = pEmail.value.trim();

          if (!fn || !em) {
            showToast('First name and Email are required.', 'error');
            return;
          }

          // Simulated update
          activeUser.firstName = fn;
          activeUser.lastName = ln;
          activeUser.email = em;
          localStorage.setItem('elawi_active_user', JSON.stringify(activeUser));

          if (profileNameSpan) profileNameSpan.textContent = fn;
          if (profileAvatarLabel) profileAvatarLabel.textContent = fn.charAt(0).toUpperCase();
          if (profileNameVal) profileNameVal.textContent = `${fn} ${ln}`;
          if (profileEmailVal) profileEmailVal.textContent = em;

          showToast('Profile information successfully saved!', 'success');
        });
      }

      // Handle password change form submit
      const profilePassForm = document.getElementById('profilePassForm');
      if (profilePassForm) {
        profilePassForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const current = document.getElementById('profPassCurrent').value;
          const next = document.getElementById('profPassNext').value;
          const confirm = document.getElementById('profPassConfirm').value;

          if (!current || !next || !confirm) {
            showToast('Please fill out all password fields.', 'error');
            return;
          }

          if (next !== confirm) {
            showToast('New passwords do not match.', 'error');
            return;
          }

          if (next.length < 6) {
            showToast('New password must be at least 6 characters.', 'error');
            return;
          }

          showToast('Password updated successfully!', 'success');
          profilePassForm.reset();
        });
      }
    }
  }

  // Checkout order submission simulation
  const checkoutSubmitForm = document.getElementById('checkoutDetailsForm');
  if (checkoutSubmitForm) {
    checkoutSubmitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (cart.length === 0) {
        showToast('Your shopping cart is empty.', 'error');
        return;
      }

      const fullname = document.getElementById('checkName').value.trim();
      const phone = document.getElementById('checkPhone').value.trim();
      const address = document.getElementById('checkAddress').value.trim();

      if (!fullname || !phone || !address) {
        showToast('Please fill in all shipping details.', 'error');
        return;
      }

      // Submit
      showToast('Processing your order... Please hold.', 'info');
      
      setTimeout(() => {
        cart = [];
        updateCartUI();
        showToast('Order successfully placed! Thank you for choosing ELAWI.', 'success');
        
        // Show completion confirmation content
        const wrap = document.getElementById('checkoutMainWrap');
        if (wrap) {
          wrap.innerHTML = `
            <div style="text-align:center; padding: 5rem 2rem; background:var(--surface); border-radius:12px; box-shadow:var(--shadow-md);">
              <i class="fa-solid fa-circle-check" style="font-size:5rem; color:var(--success); margin-bottom:2rem;"></i>
              <h1 style="font-size:2.5rem; margin-bottom:1rem;">Thank you, ${fullname}!</h1>
              <p style="font-size:1.1rem; color:var(--gray-500); max-width:600px; margin:0 auto 2.5rem auto;">
                Your order is being processed. We have sent a confirmation email containing invoice details and a real-time tracking link.
              </p>
              <div style="display:flex; gap:1.5rem; justify-content:center;">
                <a href="index.html" class="btn btn-primary">Return Home</a>
                <a href="shop.html" class="btn btn-secondary">Continue Shopping</a>
              </div>
            </div>
          `;
        }
      }, 1500);
    });
  }

});
