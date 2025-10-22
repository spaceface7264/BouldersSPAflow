const numberFormatter = new Intl.NumberFormat('da-DK');
const currencyFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
});

const MEMBERSHIP_PLANS = [
  {
    id: 'membership-student',
    name: 'Student',
    price: 379,
    priceSuffix: 'kr/mo',
    description: 'For climbers with valid student ID',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      '10% off Shoes and Gear'
    ],
    cta: 'Select Student',
  },
  {
    id: 'membership-adult',
    name: 'Adult',
    price: 445,
    priceSuffix: 'kr/mo',
    description: 'For climbers over 16 years',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      '10% off Shoes and Gear'
    ],
    cta: 'Select Adult',
  },
  {
    id: 'membership-junior',
    name: 'Junior',
    price: 249,
    priceSuffix: 'kr/mo',
    description: 'For climbers under 16 years',
    features: [
      'Unlimited access to 10 gyms',
      'Bloc Life Loyalty Program',
      '3x 15-Day Guest Passes',
      'Discount on kids classes',
    ],
    cta: 'Select Junior',
  },
];

const VALUE_CARDS = [
  {
    id: 'value-adult',
    name: 'Adult',
    price: 1200,
    priceSuffix: 'kr',
    description: 'For ages 16+',
    features: [
      '10 x Adult entries',
      'A physical card you can share',
      'Valid at all gyms during opening hours',
      'Can be upgraded to membership',
    ],
    min: 0,
    max: 5,
  },
  {
    id: 'value-junior',
    name: 'Junior',
    price: 800,
    priceSuffix: 'kr',
    description: 'For ages up to 15 years',
    features: [
      '10 x Junior entries',
      'A physical card you can share',
      'Valid at all gyms during opening hours',
      'Can be upgraded to membership',
    ],
    min: 0,
    max: 3,
  },
];

const ADDONS = [
  {
    id: 'addon-shoes',
    name: 'Climbing Shoes',
    price: { original: 599, discounted: 399 },
    description: 'Essential climbing shoes for beginners',
    features: [
      'High-quality rubber sole',
      'Comfortable fit',
      'Perfect for bouldering',
      'Available in multiple sizes',
    ],
    cta: 'Add to Cart',
  },
  {
    id: 'addon-chalk',
    name: 'Chalk Bag Set',
    price: { original: 299, discounted: 199 },
    description: 'Complete chalk bag with magnesium chalk',
    features: [
      'Premium magnesium chalk',
      'Durable chalk bag',
      'Brush included',
      'Multiple color options',
    ],
    cta: 'Add to Cart',
  },
];

const VALUE_CARD_PUNCH_MULTIPLIER = 10;

const REQUIRED_FIELDS = [
  'fullName',
  'dateOfBirth',
  'streetAddress',
  'postalCode',
  'email',
  'countryCode',
  'password',
  'confirmPassword',
  'primaryGym',
];

const PARENT_REQUIRED_FIELDS = [
  'parentFullName',
  'parentDateOfBirth',
  'parentStreetAddress',
  'parentPostalCode',
  'parentEmail',
  'parentCountryCode',
  'parentPassword',
  'parentConfirmPassword',
  'parentPrimaryGym',
];

const CARD_FIELDS = ['cardNumber', 'expiryDate', 'cvv', 'cardholderName'];

// Gym coordinates for distance calculation (legacy - now using API data)
const GYM_COORDINATES = {
  'boulders-copenhagen': { lat: 55.6761, lng: 12.5683 },
  'boulders-odense': { lat: 55.4038, lng: 10.4024 },
  'boulders-aarhus': { lat: 56.1572, lng: 10.2107 },
  'boulders-aalborg': { lat: 57.0488, lng: 9.9217 },
  'boulders-esbjerg': { lat: 55.4703, lng: 8.4549 },
  'boulders-herning': { lat: 56.1393, lng: 8.9756 },
  'boulders-kolding': { lat: 55.4904, lng: 9.4722 },
  'boulders-randers': { lat: 56.4606, lng: 10.0363 },
  'boulders-vejle': { lat: 55.7093, lng: 9.5357 },
  'boulders-viborg': { lat: 56.4531, lng: 9.4021 }
};

// API-ready gym data mapping
const GYM_API_MAPPING = {
  'boulders-copenhagen': 1,
  'boulders-aarhus': 2,
  'boulders-odense': 3,
  'boulders-aalborg': 4,
  'boulders-esbjerg': 5,
  'boulders-herning': 6,
  'boulders-kolding': 7,
  'boulders-randers': 8,
  'boulders-vejle': 9,
  'boulders-viborg': 10
};

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get user location and update distances
async function getUserLocation() {
  if (!navigator.geolocation) {
    console.log('Geolocation is not supported by this browser.');
    return;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        state.locationPermission = 'granted';
        updateGymDistances();
        resolve(state.userLocation);
      },
      (error) => {
        console.log('Location access denied or error:', error.message);
        state.locationPermission = 'denied';
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
}

// Update distance display for all gyms
function updateGymDistances() {
  if (!state.userLocation) return;

  document.querySelectorAll('.gym-item').forEach(item => {
    const gymId = item.dataset.gymId;
    const gymCoords = GYM_COORDINATES[gymId];
    
    if (gymCoords) {
      const distance = calculateDistance(
        state.userLocation.lat,
        state.userLocation.lng,
        gymCoords.lat,
        gymCoords.lng
      );
      
      const distanceElement = item.querySelector('.gym-distance');
      if (distanceElement) {
        distanceElement.textContent = `${distance.toFixed(1)} km`;
        distanceElement.style.display = 'block';
      }
    }
  });
}

// API Integration Functions
class BusinessUnitsAPI {
  constructor(baseUrl = 'https://boulders.brpsystems.com/apiserver') {
    this.baseUrl = baseUrl;
  }

  // Get all business units from API
  async getBusinessUnits() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching business units:', error);
      // Fallback to local data if API fails
      return this.getLocalGymData();
    }
  }

  // Get local gym data as fallback
  getLocalGymData() {
    return [
      {
        id: 1,
        name: "Boulders Copenhagen",
        address: {
          street: "Vesterbrogade 149",
          city: "København V",
          postalCode: "1620",
          latitude: 55.6761,
          longitude: 12.5683
        }
      },
      {
        id: 2,
        name: "Boulders Aarhus",
        address: {
          street: "Søren Frichs Vej 42",
          city: "Åbyhøj",
          postalCode: "8230",
          latitude: 56.1572,
          longitude: 10.2107
        }
      },
      {
        id: 3,
        name: "Boulders Odense",
        address: {
          street: "Hjallesevej 91",
          city: "Odense M",
          postalCode: "5230",
          latitude: 55.4038,
          longitude: 10.4024
        }
      },
      {
        id: 4,
        name: "Boulders Aalborg",
        address: {
          street: "Hobrovej 333",
          city: "Aalborg SV",
          postalCode: "9200",
          latitude: 57.0488,
          longitude: 9.9217
        }
      },
      {
        id: 5,
        name: "Boulders Esbjerg",
        address: {
          street: "Gammel Vardevej 2",
          city: "Esbjerg",
          postalCode: "6700",
          latitude: 55.4703,
          longitude: 8.4549
        }
      },
      {
        id: 6,
        name: "Boulders Herning",
        address: {
          street: "Industrivej 15",
          city: "Herning",
          postalCode: "7400",
          latitude: 56.1393,
          longitude: 8.9756
        }
      },
      {
        id: 7,
        name: "Boulders Kolding",
        address: {
          street: "Vestre Ringvej 36",
          city: "Kolding",
          postalCode: "6000",
          latitude: 55.4904,
          longitude: 9.4722
        }
      },
      {
        id: 8,
        name: "Boulders Randers",
        address: {
          street: "Industrivej 8",
          city: "Randers C",
          postalCode: "8900",
          latitude: 56.4606,
          longitude: 10.0363
        }
      },
      {
        id: 9,
        name: "Boulders Vejle",
        address: {
          street: "Vejlevej 25",
          city: "Vejle",
          postalCode: "7100",
          latitude: 55.7093,
          longitude: 9.5357
        }
      },
      {
        id: 10,
        name: "Boulders Viborg",
        address: {
          street: "Industrivej 12",
          city: "Viborg",
          postalCode: "8800",
          latitude: 56.4531,
          longitude: 9.4021
        }
      }
    ];
  }

  // Create a new business unit
  async createBusinessUnit(businessUnitData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(businessUnitData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating business unit:', error);
      throw error;
    }
  }

  // Update an existing business unit
  async updateBusinessUnit(id, businessUnitData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(businessUnitData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating business unit:', error);
      throw error;
    }
  }
}

// Initialize API instance
const businessUnitsAPI = new BusinessUnitsAPI();

// Load gyms from API and update UI
async function loadGymsFromAPI() {
  try {
    const gyms = await businessUnitsAPI.getBusinessUnits();
    console.log('Loaded gyms from API:', gyms);
    
    // Clear existing gym list
    const gymList = document.querySelector('.gym-list');
    if (gymList) {
      gymList.innerHTML = '';
    }
    
    // Create gym items from API data
    gyms.forEach(gym => {
      if (gym.name && gym.address) {
        const gymItem = createGymItem(gym);
        if (gymList) {
          gymList.appendChild(gymItem);
        }
        
        // Update gym coordinates with API data if available
        if (gym.address.latitude && gym.address.longitude) {
          const gymKey = Object.keys(GYM_API_MAPPING).find(key => GYM_API_MAPPING[key] === gym.id);
          if (gymKey) {
            GYM_COORDINATES[gymKey] = {
              lat: gym.address.latitude,
              lng: gym.address.longitude
            };
          }
        }
      }
    });
    
  // Re-setup event listeners for new gym items
  setupGymEventListeners();
  
  // Re-setup forward arrow event listener
  setupForwardArrowEventListeners();
    
    // Update distances if user location is available
    if (state.userLocation) {
      updateGymDistances();
    }
  } catch (error) {
    console.error('Failed to load gyms from API:', error);
  }
}

// Create gym item element from API data
function createGymItem(gym) {
  const gymItem = document.createElement('div');
  gymItem.className = 'gym-item';
  gymItem.setAttribute('data-gym-id', `gym-${gym.id}`);
  
  const address = gym.address;
  const addressString = `${address.street}, ${address.postalCode} ${address.city}`;
  
  gymItem.innerHTML = `
    <div class="gym-info">
      <div class="gym-name">${gym.name}</div>
      <div class="gym-details">
        <div class="gym-address">${addressString}</div>
        <div class="gym-distance" style="display: none;">-- km</div>
      </div>
    </div>
    <div class="check-circle"></div>
  `;
  
  return gymItem;
}

// Setup event listeners for gym items
function setupGymEventListeners() {
  const gymItems = document.querySelectorAll('.gym-item');
  gymItems.forEach(item => {
    item.addEventListener('click', () => handleGymSelection(item));
  });
}

// Setup event listeners for forward arrow
function setupForwardArrowEventListeners() {
  const forwardArrowBtn = document.getElementById('forwardArrowBtn');
  if (forwardArrowBtn) {
    forwardArrowBtn.addEventListener('click', handleForwardNavigation);
  }
}

// Handle forward navigation
function handleForwardNavigation() {
  // Only allow forward navigation if we're not on the last step
  if (state.currentStep < TOTAL_STEPS) {
    nextStep();
  }
}

const state = {
  currentStep: 1,
  selectedGymId: null,
  membershipPlanId: null,
  valueCardQuantities: new Map(),
  addonIds: new Set(),
  userLocation: null,
  locationPermission: 'prompt', // 'granted', 'denied', 'prompt'
  totals: {
    cartTotal: 0,
    membershipMonthly: 0,
  },
  billingPeriod: '',
  forms: {},
  order: null,
  paymentMethod: null,
};

const DOM = {};
const templates = {};
const TOTAL_STEPS = 5;
const buttonGlareTimeouts = new WeakMap();
const carouselResizeObservers = new WeakMap();
const carouselScrollHandlers = new WeakMap();
const carouselResizeFallbacks = new WeakMap();

// Determine whether a membership (not punch card) is currently selected
function isMembershipSelected() {
  const id = state.membershipPlanId;
  if (!id) return false;
  return !String(id).includes('punch');
}

// Interstitial Add-ons Modal (shown after selecting membership on step 2)
let addonsModal = null;
let addonsModalImageCol = null;
let addonsModalImageEl = null;
function defaultAddonsImage() {
  // Simple dark gradient SVG placeholder with label
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0b0f1a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="#22d3ee" opacity="0.08">
    <circle cx="120" cy="160" r="80"/>
    <circle cx="360" cy="280" r="60"/>
    <circle cx="640" cy="180" r="90"/>
    <circle cx="240" cy="520" r="70"/>
    <circle cx="560" cy="720" r="100"/>
  </g>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#e5e7eb" font-size="36" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Boost your membership</text>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="18" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Add shoes, chalk and more</text>
</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function ensureAddonsModal() {
  if (addonsModal) return addonsModal;
  const overlay = document.createElement('div');
  overlay.className = 'addons-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  // Modal styles are defined in styles.css (no inline style injection)

  const sheet = document.createElement('div');
  sheet.className = 'addons-sheet';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'addons-content';

  // Left image column (optional)
  // Image column removed per request

  const header = document.createElement('div');
  header.className = 'addons-header';
  const title = document.createElement('h3');
  title.textContent = 'Add to your membership';
  title.className = 'addons-title';
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.setAttribute('type', 'button');
  closeBtn.textContent = '\u00D7';
  closeBtn.className = 'addons-close';
  closeBtn.addEventListener('click', () => hideAddonsModal());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const grid = document.createElement('div');
  grid.className = 'addons-grid';
  grid.setAttribute('data-modal-addons-grid', '');

  const actions = document.createElement('div');
  actions.className = 'addons-actions';
  const hint = document.createElement('div');
  hint.textContent = 'Add gear now at a special price and pick it up at your next visit.';
  hint.className = 'addons-hint';
  
  // Single dynamic button
  const actionButton = document.createElement('button');
  actionButton.textContent = 'Skip';
  actionButton.className = 'addons-action-btn';
  actionButton.addEventListener('click', () => handleAddonAction());
  
  const rightActions = document.createElement('div');
  rightActions.className = 'addons-actions-right';
  rightActions.appendChild(actionButton);
  actions.appendChild(hint);
  actions.appendChild(rightActions);

  const contentCol = document.createElement('div');
  contentCol.style.flex = '1 1 auto';
  contentCol.style.display = 'flex';
  contentCol.style.flexDirection = 'column';
  contentCol.style.minWidth = '0';
  contentCol.appendChild(header);
  contentCol.appendChild(grid);
  contentCol.appendChild(actions);

  // Image column removed
  contentWrap.appendChild(contentCol);
  sheet.appendChild(contentWrap);
  overlay.appendChild(sheet);
  
  // Add click-outside-to-close functionality
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAddonsModal();
    }
  });
  
  document.body.appendChild(overlay);

  addonsModal = overlay;
  return addonsModal;
}

function populateAddonsModal() {
  ensureAddonsModal();
  const grid = addonsModal.querySelector('[data-modal-addons-grid]');
  if (!grid) return;
  grid.innerHTML = '';
  if (!templates.addon) {
    // Fallback simple cards if template missing
    ADDONS.forEach((addon) => {
      const card = document.createElement('div');
      card.className = 'plan-card addon-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div style="font-weight:600">${addon.name}</div>
        <div>${currencyFormatter.format(addon.price.discounted)}</div>
        <div class="check-circle" data-action="toggle-addon" data-addon-id="${addon.id}"></div>
      `;
      
      // Make entire card clickable
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking the check circle itself
        const checkCircle = card.querySelector('.check-circle');
        if (e.target === checkCircle || checkCircle.contains(e.target)) {
          return;
        }
        // Toggle the addon
        if (addon.id) toggleAddon(addon.id, checkCircle);
      });
      
      grid.appendChild(card);
    });
    return;
  }
  // Use existing add-on template for consistency
  ADDONS.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    const checkCircle = card.querySelector('[data-action="toggle-addon"]');
    if (checkCircle) checkCircle.dataset.addonId = addon.id;
    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    if (nameEl) nameEl.textContent = addon.name;
    if (originalPriceEl) originalPriceEl.textContent = currencyFormatter.format(addon.price.original);
    if (discountedPriceEl) discountedPriceEl.textContent = currencyFormatter.format(addon.price.discounted);
    if (descriptionEl) descriptionEl.textContent = addon.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      addon.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    
    // Make entire card clickable
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking the check circle itself
      if (e.target === checkCircle || checkCircle.contains(e.target)) {
        return;
      }
      // Toggle the addon
      if (addon.id) toggleAddon(addon.id, checkCircle);
    });
    
    grid.appendChild(card);
  });
}

function showAddonsModal() {
  ensureAddonsModal();
  populateAddonsModal();
  updateAddonActionButton();
  
  // Show modal with subtle animation
  addonsModal.style.display = 'block';
  addonsModal.style.opacity = '0';
  addonsModal.style.transform = 'scale(0.95)';
  document.body.style.overflow = 'hidden';
  
  // Trigger animation after a brief moment
  requestAnimationFrame(() => {
    addonsModal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    addonsModal.style.opacity = '1';
    addonsModal.style.transform = 'scale(1)';
  });
}

function hideAddonsModal() {
  if (!addonsModal) return;
  addonsModal.style.display = 'none';
  document.body.style.overflow = '';
}

function proceedAfterAddons() {
  hideAddonsModal();
  // Jump directly to Info step (step 4)
  state.currentStep = 4;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  scrollToTop();
  setTimeout(scrollToTop, 200);
}

// Expose a small API to set the image dynamically if desired
// Usage: window.setAddonsUpsellImage('https://.../image.jpg')
// Image API removed

// Hide Boost from the step indicator permanently and toggle Boost step panel by selection
function applyConditionalSteps() {
  // 1) Hide Boost in the step indicator entirely (never shown)
  const boostStep = Array.from(document.querySelectorAll('.step .step-label'))
    .find((label) => label.textContent.trim() === 'Boost')?.closest('.step');
  if (boostStep) {
    boostStep.classList.add('hidden');
    // Hide adjacent connectors so the visual line doesn't have a dangling segment
    const prevConnector = boostStep.previousElementSibling;
    if (prevConnector && prevConnector.classList.contains('step-connector')) {
      prevConnector.classList.add('hidden');
    }
    const nextConnector = boostStep.nextElementSibling;
    // Keep the connector after Boost visible to bridge Access -> Send
    if (nextConnector && nextConnector.classList.contains('step-connector')) {
      nextConnector.classList.remove('hidden');
    }
  }

  // 2) Show/hide Boost page (step 3) based on whether membership is selected
  const boostPanel = document.getElementById('step-3');
  if (boostPanel) {
    const shouldShowBoost = isMembershipSelected();
    boostPanel.style.display = shouldShowBoost ? 'block' : 'none';

    // If user is currently on a hidden step, move to the next visible
    if (!shouldShowBoost && state.currentStep === 3) {
      nextStep();
    }
  }

  // Recompute indicator visuals after changes
  updateStepIndicator();
}

function init() {
  cacheDom();
  cacheTemplates();
  renderCatalog();
  refreshCarousels();
  updateCartSummary();
  initAuthModeToggle();
  updateCheckoutButton();
  setupEventListeners();
  setupForwardArrowEventListeners();
  // Apply conditional visibility for Boost on load
  applyConditionalSteps();
  updateStepIndicator();
  updateNavigationButtons();
  
  // Load gyms from API
  loadGymsFromAPI();
  
  // Request user location for distance calculation
  getUserLocation();
  updateMainSubtitle();
}

document.addEventListener('DOMContentLoaded', init);


// Re-initialize form scrolling on window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setupFormFieldScrolling();
  }, 250);
});

function cacheDom() {
  DOM.stepPanels = Array.from(document.querySelectorAll('.step-panel'));
  DOM.stepCircles = Array.from(document.querySelectorAll('.step-circle'));
  DOM.stepConnectors = Array.from(document.querySelectorAll('.step-connector'));
  DOM.prevBtn = document.getElementById('prevBtn');
  DOM.nextBtn = document.getElementById('nextBtn');
  DOM.mainSubtitle = document.getElementById('mainSubtitle');
  DOM.mainTitle = document.querySelector('.main-title');
  DOM.membershipPlans = document.querySelector('[data-component="membership-plans"]');
  DOM.valuePlans = document.querySelector('[data-component="value-plans"]');
  DOM.singlePlanSection = document.getElementById('singlePlans');
  DOM.valuePlanSection = document.getElementById('quantityPlans');
  DOM.singleCarousel = document.getElementById('singleChoiceMode');
  DOM.valueCarousel = document.getElementById('quantityMode');
  DOM.toggleButtons = Array.from(document.querySelectorAll('.toggle-btn'));
  DOM.categoryToggle = document.querySelector('.category-toggle');
  DOM.addonPlans = document.querySelector('[data-component="addon-plans"]');
  DOM.valueCardPunches = document.querySelector('[data-value-card-punches]');
  DOM.valueCardContinueBtn = document.querySelector('[data-action="continue-value-cards"]');
  DOM.valueCardEntryLabel = document.querySelector('[data-entry-label]');
  DOM.cartItems = document.querySelector('[data-component="cart-items"]');
  DOM.cartTotal = document.querySelector('[data-summary-field="cart-total"]');
  DOM.billingPeriod = document.querySelector('[data-summary-field="billing-period"]');
  DOM.checkoutBtn = document.querySelector('[data-action="submit-checkout"]');
  DOM.termsConsent = document.getElementById('termsConsent');
  DOM.discountToggle = document.querySelector('.discount-toggle');
  DOM.discountForm = document.querySelector('.discount-form');
  DOM.skipAddonsBtn = document.getElementById('skipAddons');
  DOM.backFromAddonsBtn = document.getElementById('backFromAddons');
  DOM.paymentOptions = Array.from(document.querySelectorAll('input[name="paymentMethod"]'));
  DOM.cardPaymentForm = document.getElementById('cardPaymentForm');
  DOM.parentGuardianToggle = document.getElementById('parentGuardian');
  DOM.parentGuardianForm = document.getElementById('parentGuardianForm');
  DOM.parentGuardianReminder = document.querySelector('[data-role="parent-guardian-reminder"]');
  DOM.sameAddressToggle = document.getElementById('sameAddressToggle');
  DOM.confirmationItems = document.querySelector('[data-component="confirmation-items"]');
  DOM.confirmationFields = {
    orderNumber: document.querySelector('[data-summary-field="order-number"]'),
    orderDate: document.querySelector('[data-summary-field="order-date"]'),
    orderTotal: document.querySelector('[data-summary-field="order-total"]'),
    memberName: document.querySelector('[data-summary-field="member-name"]'),
    membershipNumber: document.querySelector('[data-summary-field="membership-number"]'),
    membershipType: document.querySelector('[data-summary-field="membership-type"]'),
    primaryGym: document.querySelector('[data-summary-field="primary-gym"]'),
    membershipPrice: document.querySelector('[data-summary-field="membership-price"]'),
  };
}

function cacheTemplates() {
  templates.membership = document.getElementById('membership-plan-template');
  templates.valueCard = document.getElementById('value-card-template');
  templates.addon = document.getElementById('addon-card-template');
  templates.cartItem = document.getElementById('cart-item-template');
  templates.confirmationItem = document.getElementById('confirmation-item-template');
}

function setupEventListeners() {
  DOM.nextBtn?.addEventListener('click', nextStep);
  DOM.prevBtn?.addEventListener('click', prevStep);
  DOM.discountToggle?.addEventListener('click', toggleDiscountForm);
  DOM.sameAddressToggle?.addEventListener('change', handleSameAddressToggle);
  DOM.parentGuardianToggle?.addEventListener('change', handleParentGuardianToggle);
  DOM.termsConsent?.addEventListener('change', updateCheckoutButton);

  // Gym selection event listeners will be set up dynamically when gyms are loaded

  // Search functionality
  const gymSearch = document.getElementById('gymSearch');
  gymSearch?.addEventListener('input', handleGymSearch);

  // Back arrow event listener
  const backToGymBtn = document.getElementById('backToGymBtn');
  backToGymBtn?.addEventListener('click', () => handleBackToGym());

  DOM.toggleButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category ?? 'single';
      handleCategoryToggle(category);
    });
  });

  // New category and plan selection functionality
  setupNewAccessStep();

  if (DOM.paymentOptions.length) {
    DOM.paymentOptions.forEach((option) => {
      option.addEventListener('change', handlePaymentChange);
    });
  }

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('input', handleGlobalInput);

  const cardNumber = document.getElementById('cardNumber');
  const expiryDate = document.getElementById('expiryDate');
  const cvv = document.getElementById('cvv');

  cardNumber?.addEventListener('input', formatCardNumber);
  expiryDate?.addEventListener('input', formatExpiryDate);
  cvv?.addEventListener('input', stripNonDigits);
  
  // Setup form field scrolling for mobile
  setupFormFieldScrolling();
}

function renderCatalog() {
  renderMembershipPlans();
  renderValueCards();
  renderAddons();
}

function renderMembershipPlans() {
  if (!templates.membership || !DOM.membershipPlans) return;
  DOM.membershipPlans.innerHTML = '';
  DOM.membershipPlans.dataset.centerInitialized = 'false';

  MEMBERSHIP_PLANS.forEach((plan) => {
    const card = templates.membership.content.firstElementChild.cloneNode(true);
    card.dataset.planId = plan.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const priceValueEl = card.querySelector('[data-element="priceValue"]');
    const priceSuffixEl = card.querySelector('[data-element="priceSuffix"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const buttonEl = card.querySelector('[data-action="select-membership"]');

    if (nameEl) nameEl.textContent = plan.name;
    if (priceValueEl) priceValueEl.textContent = numberFormatter.format(plan.price);
    if (priceSuffixEl) priceSuffixEl.textContent = ` ${plan.priceSuffix}`;
    if (descriptionEl) descriptionEl.textContent = plan.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      plan.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    if (buttonEl) {
      buttonEl.dataset.planId = plan.id;
      buttonEl.textContent = plan.cta ?? 'Select Plan';
    }

    card.addEventListener('click', (event) => handleMembershipCardClick(event, card));

    DOM.membershipPlans.appendChild(card);
  });
}

function handleGymSelection(item) {
  // Remove selected class from all gym items
  document.querySelectorAll('.gym-item').forEach(gymItem => {
    gymItem.classList.remove('selected');
  });
  
  // Add selected class to clicked item
  item.classList.add('selected');
  
  // Store selected gym ID
  state.selectedGymId = item.dataset.gymId;
  
  // Update heads-up display
  updateGymHeadsUp(item);
  
  // Auto-advance to next step after a short delay
  setTimeout(() => {
    nextStep();
  }, 500);
}

// Update gym heads-up display
function updateGymHeadsUp(selectedItem) {
  const headsUp = document.getElementById('gymHeadsUp');
  const gymName = document.getElementById('selectedGymName');
  
  if (selectedItem && headsUp && gymName) {
    const gymNameText = selectedItem.querySelector('.gym-name').textContent;
    gymName.textContent = gymNameText;
    
    // Show heads-up with animation
    headsUp.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      headsUp.classList.remove('show');
    }, 3000);
  }
}

// Update access type heads-up display
function updateAccessHeadsUp(selectedCard) {
  const headsUp = document.getElementById('accessHeadsUp');
  const accessName = document.getElementById('selectedAccessName');
  
  if (selectedCard && headsUp && accessName) {
    const planType = selectedCard.querySelector('.plan-type').textContent;
    const category = selectedCard.closest('.category-item').dataset.category;
    
    // Format the display name based on category and plan type
    let displayName = planType;
    if (category === 'punchcard') {
      displayName = `${planType} Punch Card`;
    } else if (category === 'membership') {
      displayName = `${planType} Membership`;
    }
    
    accessName.textContent = displayName;
    
    // Show heads-up with animation
    headsUp.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      headsUp.classList.remove('show');
    }, 3000);
  }
}

// Sync punch card quantity UI
function syncPunchCardQuantityUI(card, planId) {
  const quantity = state.valueCardQuantities.get(planId) || 1;
  const pricePerUnit = parseInt(card.dataset.price) || 1200;
  const total = pricePerUnit * quantity;
  
  // Find the quantity panel (now a sibling of the card)
  const panel = card.nextElementSibling;
  if (!panel || !panel.classList.contains('quantity-panel')) return;
  
  const quantityValue = panel.querySelector('[data-element="quantityValue"]');
  const quantityTotal = panel.querySelector('[data-element="quantityTotal"]');
  const decrementBtn = panel.querySelector('[data-action="decrement-quantity"]');
  const incrementBtn = panel.querySelector('[data-action="increment-quantity"]');
  
  if (quantityValue) quantityValue.textContent = quantity;
  if (quantityTotal) quantityTotal.textContent = `${total.toLocaleString('da-DK')} kr`;
  
  // Disable buttons based on min/max
  if (decrementBtn) decrementBtn.disabled = quantity <= 1;
  if (incrementBtn) incrementBtn.disabled = quantity >= 5;
}

// Scroll to top function with multiple approaches
function scrollToTop() {
  // Method 1: Direct scroll to top
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  
  // Method 2: Smooth scroll with requestAnimationFrame
  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  });
  
  // Method 3: Force scroll after a brief delay
  setTimeout(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 50);
}

function scrollToElement(element, options = {}) {
  // Only apply on mobile (screen width <= 768px)
  if (window.innerWidth > 768) return;
  
  const {
    offset = -20,           // Padding from top
    delay = 300,            // Delay before scroll
    behavior = 'smooth'     // Scroll behavior
  } = options;
  
  setTimeout(() => {
    if (!element) return;
    
    // For fixed viewport, scroll within the main container
    const mainContainer = document.querySelector('main');
    if (!mainContainer) return;
    
    // Get element position relative to the main container
    const elementRect = element.getBoundingClientRect();
    const mainRect = mainContainer.getBoundingClientRect();
    
    // Calculate scroll position within the main container
    const relativeTop = elementRect.top - mainRect.top;
    const scrollPosition = mainContainer.scrollTop + relativeTop + offset;
    
    // Scroll within the main container
    mainContainer.scrollTo({
      top: scrollPosition,
      behavior: behavior
    });
  }, delay);
}

// Setup form field focus scrolling for mobile
function setupFormFieldScrolling() {
  // Only on mobile
  if (window.innerWidth > 768) return;
  
  const formInputs = document.querySelectorAll('input, select, textarea');
  
  formInputs.forEach((input) => {
    input.addEventListener('focus', function() {
      scrollToElement(this, { delay: 100, offset: -100 });
    });
  });
}

function handleGymSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const gymItems = document.querySelectorAll('.gym-item');
  const noResults = document.getElementById('noResults');
  let visibleCount = 0;
  
  gymItems.forEach(item => {
    const gymName = item.querySelector('.gym-name').textContent.toLowerCase();
    const gymAddress = item.querySelector('.gym-address').textContent.toLowerCase();
    
    if (gymName.includes(searchTerm) || gymAddress.includes(searchTerm)) {
      item.classList.remove('hidden');
      visibleCount++;
    } else {
      item.classList.add('hidden');
    }
  });
  
  // Show/hide no results message
  if (visibleCount === 0 && searchTerm.length > 0) {
    noResults.classList.remove('hidden');
  } else {
    noResults.classList.add('hidden');
  }
}

function handleBackToGym() {
  // Go back to step 1 (gym selection)
  state.currentStep = 1;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
  
  // Scroll to top immediately and with delay
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);
  
  // Restore previously selected gym if any
  if (state.selectedGymId) {
    const selectedGymItem = document.querySelector(`[data-gym-id="${state.selectedGymId}"]`);
    if (selectedGymItem) {
      // Remove selected class from all items first
      document.querySelectorAll('.gym-item').forEach(item => {
        item.classList.remove('selected');
      });
      // Add selected class to previously selected item
      selectedGymItem.classList.add('selected');
      
      // Show heads-up for previously selected gym
      updateGymHeadsUp(selectedGymItem);
    }
  }
}

function handleMembershipCardClick(event, card) {
  const button = card.querySelector('[data-action="select-membership"]');
  if (!button) return;

  centerPlanCard(card);

  if (event.target.closest('[data-action="select-membership"]')) return;

  if (card.classList.contains('selected')) return;

  triggerPlanButtonGlare(button);
}

function triggerPlanButtonGlare(button) {
  const existingTimeout = buttonGlareTimeouts.get(button);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  button.classList.add('attention-glare');

  const timeoutId = window.setTimeout(() => {
    button.classList.remove('attention-glare');
    buttonGlareTimeouts.delete(button);
  }, 900);

  buttonGlareTimeouts.set(button, timeoutId);
}

function renderValueCards() {
  if (!templates.valueCard || !DOM.valuePlans) return;
  DOM.valuePlans.innerHTML = '';
  DOM.valuePlans.dataset.centerInitialized = 'false';

  VALUE_CARDS.forEach((plan) => {
    const card = templates.valueCard.content.firstElementChild.cloneNode(true);
    card.dataset.planId = plan.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const priceValueEl = card.querySelector('[data-element="priceValue"]');
    const priceSuffixEl = card.querySelector('[data-element="priceSuffix"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const quantityValueEl = card.querySelector('[data-element="quantityValue"]');
    const quantityTotalEl = card.querySelector('[data-element="quantityTotal"]');
    const selector = card.querySelector('.quantity-selector');
    const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
    const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

    if (nameEl) nameEl.textContent = plan.name;
    if (priceValueEl) priceValueEl.textContent = numberFormatter.format(plan.price);
    if (priceSuffixEl) priceSuffixEl.textContent = ` ${plan.priceSuffix}`;
    if (descriptionEl) descriptionEl.textContent = plan.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      plan.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }

    if (quantityValueEl) quantityValueEl.textContent = plan.min;
    if (quantityTotalEl) quantityTotalEl.textContent = numberFormatter.format(plan.min * plan.price);

    if (selector) {
      selector.dataset.planId = plan.id;
      selector.dataset.basePrice = String(plan.price);
      selector.dataset.min = String(plan.min ?? 0);
      selector.dataset.max = String(Number.isFinite(plan.max) ? plan.max : '');
      selector.dataset.current = String(plan.min ?? 0);
    }

    if (decrementBtn) decrementBtn.dataset.planId = plan.id;
    if (incrementBtn) incrementBtn.dataset.planId = plan.id;

    card.addEventListener('click', () => centerPlanCard(card));

    DOM.valuePlans.appendChild(card);

    syncValueCardUI(plan.id);
  });

  enforceValueCardAvailability();
  updateValueCardSummary();
}

function renderAddons() {
  if (!templates.addon || !DOM.addonPlans) return;
  DOM.addonPlans.innerHTML = '';
  DOM.addonPlans.dataset.centerInitialized = 'false';

  ADDONS.forEach((addon) => {
    const card = templates.addon.content.firstElementChild.cloneNode(true);
    card.dataset.planId = addon.id;

    const nameEl = card.querySelector('[data-element="name"]');
    const originalPriceEl = card.querySelector('[data-element="originalPrice"]');
    const discountedPriceEl = card.querySelector('[data-element="discountedPrice"]');
    const descriptionEl = card.querySelector('[data-element="description"]');
    const featuresEl = card.querySelector('[data-element="features"]');
    const buttonEl = card.querySelector('[data-action="toggle-addon"]');

    if (nameEl) nameEl.textContent = addon.name;
    if (originalPriceEl) originalPriceEl.textContent = currencyFormatter.format(addon.price.original);
    if (discountedPriceEl) discountedPriceEl.textContent = currencyFormatter.format(addon.price.discounted);
    if (descriptionEl) descriptionEl.textContent = addon.description;
    if (featuresEl) {
      featuresEl.innerHTML = '';
      addon.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresEl.appendChild(li);
      });
    }
    if (buttonEl) {
      buttonEl.dataset.addonId = addon.id;
      buttonEl.textContent = addon.cta ?? 'Select Add-on';
    }

    card.addEventListener('click', () => centerPlanCard(card));

    DOM.addonPlans.appendChild(card);
  });

  updateAddonSkipButton();
}

function handleCategoryToggle(category) {
  // Update category item states
  const categoryItems = document.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    const isSelected = item.dataset.category === category;
    item.classList.toggle('selected', isSelected);
    
    // Only toggle expanded if this is the selected category
    if (isSelected) {
      item.classList.toggle('expanded');
    } else {
      item.classList.remove('expanded');
    }
  });

  // Update plan sections visibility based on expanded state
  const singlePlans = document.getElementById('singleChoiceMode');
  const quantityPlans = document.getElementById('quantityMode');
  
  const singleCategory = document.querySelector('.category-item[data-category="single"]');
  const quantityCategory = document.querySelector('.category-item[data-category="quantity"]');
  
  if (singleCategory && singleCategory.classList.contains('expanded')) {
    if (singlePlans) singlePlans.style.display = 'block';
    if (quantityPlans) quantityPlans.style.display = 'none';
  } else if (quantityCategory && quantityCategory.classList.contains('expanded')) {
    if (singlePlans) singlePlans.style.display = 'none';
    if (quantityPlans) quantityPlans.style.display = 'block';
  } else {
    // If no category is expanded, hide both
    if (singlePlans) singlePlans.style.display = 'none';
    if (quantityPlans) quantityPlans.style.display = 'none';
  }
}

function handlePlanSelection(selectedCard) {
  // Remove selected class from all plan cards in the same category
  const category = selectedCard.closest('.category-item').dataset.category;
  const allCardsInCategory = selectedCard.closest('.category-item').querySelectorAll('.plan-card');
  
  allCardsInCategory.forEach(card => {
    card.classList.remove('selected');
  });
  
  // Add selected class to clicked card
  selectedCard.classList.add('selected');
  
  // Store the selected plan
  const planId = selectedCard.dataset.plan;
  state.membershipPlanId = planId;
  
  console.log('Selected plan:', planId);
  
  // Update access heads-up display
  updateAccessHeadsUp(selectedCard);

  // Reevaluate Boost visibility based on plan type
  applyConditionalSteps();
  
  // Auto-advance to next step after a short delay
  setTimeout(() => {
    nextStep();
  }, 500);
}

function setupNewAccessStep() {
  const categoryItems = document.querySelectorAll('.category-item');
  const footerText = document.getElementById('footerText');
  
  const footerTexts = {
    membership: 'Membership is an ongoing subscription with automatic renewal. No signup or cancellation fees. Notice period is the rest of the month + 1 month. By signing up you accept <a href="#">terms and Conditions</a>.',
    punchcard: 'You can buy 1 type of value card at a time. Each entry uses one clip on your value card. Card is valid for 5 years and does not include membership benefits. Refill within 14 days after your last clip and get 100 kr off at the gym. By purchasing a value card, you accept <a href="#">terms and Conditions</a>.'
  };

  let currentCategory = null;
  let selectedPlan = null;

  // Category expansion/collapse
  categoryItems.forEach(category => {
    const header = category.querySelector('.category-header');
    
    header.addEventListener('click', () => {
      const categoryType = category.dataset.category;
      const wasExpanded = category.classList.contains('expanded');

      // Collapse all categories
      categoryItems.forEach(item => {
        item.classList.remove('expanded', 'selected');
      });

      // Expand clicked category if it wasn't already expanded
      if (!wasExpanded) {
        category.classList.add('expanded', 'selected');
        currentCategory = categoryType;
        footerText.innerHTML = footerTexts[categoryType];
        
        // Scroll to show the expanded content
        const categoryContent = category.querySelector('.category-content');
        if (categoryContent) {
          scrollToElement(categoryContent, { delay: 100, offset: -80 });
        }
      } else {
        currentCategory = null;
        footerText.innerHTML = 'Select a category above to view available plans.';
      }

      // Clear selected plan when switching categories
      selectedPlan = null;
      state.membershipPlanId = null;
      
      // Clear all punch card quantities when switching categories
      state.valueCardQuantities.clear();
      
      document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected', 'has-quantity', 'disabled');
      });
      
      // Hide all quantity panels
      document.querySelectorAll('.quantity-panel').forEach(panel => {
        panel.classList.remove('show');
        panel.style.display = 'none';
      });
      
      // Hide continue buttons when switching categories
      document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.style.display = 'none';
      });
    });
  });

  // Plan selection
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't handle clicks on quantity controls - let them handle their own events
      if (e.target.closest('.quantity-selector')) {
        return;
      }
      
      e.stopPropagation();
      
      const planId = card.dataset.plan;
      const categoryItem = card.closest('.category-item');
      const category = categoryItem.dataset.category;
      
      // Check if this card is already selected
      const isAlreadySelected = card.classList.contains('selected');
      
      // Clear ALL selections across ALL categories first
      document.querySelectorAll('.plan-card').forEach(c => {
        c.classList.remove('selected', 'has-quantity', 'disabled');
      });
      
      // Clear all punch card quantities when making a new selection
      state.valueCardQuantities.clear();
      
      // Hide all quantity panels
      document.querySelectorAll('.quantity-panel').forEach(panel => {
        panel.classList.remove('show');
        panel.style.display = 'none';
      });
      
      // Hide continue buttons initially
      document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.style.display = 'none';
      });
      
      // Clear state
      state.membershipPlanId = null;
      
      // If clicking the same card that was already selected, deselect it
      if (isAlreadySelected) {
        selectedPlan = null;
        return;
      }
      
      // Select clicked card
      card.classList.add('selected');
      selectedPlan = planId;
      
      // Store the selected plan in state
      state.membershipPlanId = planId;
      
        // Handle punch cards differently - show quantity selector
        if (category === 'punchcard') {
          // Initialize quantity to 1 for this specific punch card type
          if (!state.valueCardQuantities.has(planId)) {
            state.valueCardQuantities.set(planId, 1);
          }
          
          // Clear quantity for the other punch card type when switching
          const otherPunchCardId = planId === 'adult-punch' ? 'junior-punch' : 'adult-punch';
          if (state.valueCardQuantities.has(otherPunchCardId)) {
            state.valueCardQuantities.delete(otherPunchCardId);
          }
          
          // Show quantity panel (now a sibling element)
          card.classList.add('has-quantity');
          const panel = card.nextElementSibling;
          if (panel && panel.classList.contains('quantity-panel')) {
            panel.classList.add('show');
            panel.style.display = 'block';
            syncPunchCardQuantityUI(card, planId);
            
            // Scroll to show quantity panel for punch cards
            scrollToElement(panel, { delay: 400, offset: -60 });
          }
          
          // Grey out the other punch card type
          const otherPunchCard = document.querySelector(`[data-plan="${otherPunchCardId}"]`);
          if (otherPunchCard) {
            otherPunchCard.classList.add('disabled');
          }
          
          // Update access heads-up
          updateAccessHeadsUp(card);
          
          // Don't auto-advance for punch cards - let user adjust quantity first
        } else {
          // Membership - update access heads-up and open interstitial modal
          updateAccessHeadsUp(card);
          
          // Add subtle visual cue on selected card
          card.style.transition = 'all 0.3s ease';
          card.style.transform = 'scale(1.02)';
          card.style.boxShadow = '0 8px 25px rgba(240, 0, 240, 0.3)';
          
          // Add subtle delay and animation to guide user to modal
          setTimeout(() => {
            showAddonsModal();
            
            // Reset card animation after modal appears
            setTimeout(() => {
              card.style.transform = 'scale(1)';
              card.style.boxShadow = '';
            }, 300);
          }, 800); // 800ms delay
        }
    });
  });

  // Punch card continue arrows (now within each card)
  document.querySelectorAll('.continue-arrow').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      nextStep();
    });
  });

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Initialize auth mode toggle
function initAuthModeToggle() {
  const toggleBtns = document.querySelectorAll('.auth-mode-btn');
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  
  // Set initial state (create account active)
  const createBtn = document.querySelector('[data-mode="create"]');
  if (createBtn) createBtn.classList.add('active');
  
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchAuthMode(mode);
    });
  });
}

// Switch between auth modes
function switchAuthMode(mode) {
  const toggleBtns = document.querySelectorAll('.auth-mode-btn');
  const loginSection = document.querySelector('[data-auth-section="login"]');
  const createSection = document.querySelector('[data-auth-section="create"]');
  
  // Update button states
  toggleBtns.forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Show/hide sections with fade
  if (mode === 'login') {
    createSection.style.display = 'none';
    loginSection.style.display = 'block';
  } else {
    loginSection.style.display = 'none';
    createSection.style.display = 'block';
  }
}

function handleGlobalClick(event) {
  const actionable = event.target.closest('[data-action]');
  if (!actionable) return;

  const action = actionable.dataset.action;

  switch (action) {
    case 'select-membership': {
      const planId = actionable.dataset.planId;
      if (planId) selectMembershipPlan(planId);
      break;
    }
    case 'toggle-addon': {
      const addonId = actionable.dataset.addonId;
      if (addonId) toggleAddon(addonId, actionable);
      break;
    }
    case 'increment-quantity': {
      event.stopPropagation();
      const planId = actionable.dataset.planId;
      if (planId && planId.includes('punch')) {
        // Find the card that contains this quantity panel
        const panel = actionable.closest('.quantity-panel');
        const card = panel ? panel.previousElementSibling : null;
        if (card && card.classList.contains('plan-card') && card.classList.contains('selected')) {
          const current = state.valueCardQuantities.get(planId) || 1;
          if (current < 5) { // Max 5 punch cards of the same type
            state.valueCardQuantities.set(planId, current + 1);
            syncPunchCardQuantityUI(card, planId);
          }
        }
      } else if (planId) {
        adjustValueCardQuantity(planId, 1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
      break;
    }
    case 'decrement-quantity': {
      event.stopPropagation();
      const planId = actionable.dataset.planId;
      if (planId && planId.includes('punch')) {
        // Find the card that contains this quantity panel
        const panel = actionable.closest('.quantity-panel');
        const card = panel ? panel.previousElementSibling : null;
        if (card && card.classList.contains('plan-card') && card.classList.contains('selected')) {
          const current = state.valueCardQuantities.get(planId) || 1;
          if (current > 1) { // Min 1 punch card
            state.valueCardQuantities.set(planId, current - 1);
            syncPunchCardQuantityUI(card, planId);
          }
        }
      } else if (planId) {
        adjustValueCardQuantity(planId, -1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
      break;
    }
    case 'continue-punch-card': {
      event.stopPropagation();
      nextStep();
      break;
    }
    case 'switch-auth-mode': {
      const mode = actionable.dataset.mode;
      switchAuthMode(mode);
      break;
    }
    case 'submit-checkout': {
      event.preventDefault();
      handleCheckout();
      break;
    }
    case 'continue-value-cards': {
      event.preventDefault();
      handleValueCardContinue();
      break;
    }
    case 'edit-cart': {
      event.preventDefault();
      handleEditCart();
      break;
    }
    case 'copy-referral': {
      handleReferralCopy();
      break;
    }
    case 'open-login': {
      showToast('Login flow handled by backend integration.', 'info');
      break;
    }
    case 'toggle-addons-step': {
      event.preventDefault();
      handleAddonContinue();
      break;
    }
    case 'go-back-step': {
      event.preventDefault();
      prevStep();
      break;
    }
    default:
      break;
  }
}

function handleGlobalInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLElement)) return;
  if (field.classList.contains('quantity-btn')) return;

  if (field.closest('.form-group')) {
    field.closest('.form-group').classList.remove('error');
  }

  if (field.dataset.apiField === 'payment.method') {
    updateCheckoutButton();
  }
}

function selectMembershipPlan(planId) {
  state.membershipPlanId = planId;
  const selectedPlan = findMembershipPlan(planId);

  if (DOM.membershipPlans) {
    DOM.membershipPlans.querySelectorAll('.plan-card').forEach((card) => {
      const isSelected = card.dataset.planId === planId;
      card.classList.toggle('selected', isSelected);
      const btn = card.querySelector('[data-action="select-membership"]');
      if (btn) {
        const plan = findMembershipPlan(card.dataset.planId ?? '');
        btn.textContent = isSelected
          ? 'Selected'
          : plan?.cta ?? 'Select Plan';
        const timeoutId = buttonGlareTimeouts.get(btn);
        if (timeoutId) {
          clearTimeout(timeoutId);
          buttonGlareTimeouts.delete(btn);
        }
        btn.classList.remove('attention-glare');
      }
      if (isSelected) {
        centerPlanCard(card);
      }
    });
  }

  updateCartSummary();
  updateCheckoutButton();
  if (state.currentStep === 2) {
    setTimeout(() => nextStep(), 300);
  }
  showToast(`${selectedPlan?.name ?? 'Membership'} selected.`, 'success');
}

function toggleAddon(addonId, checkCircle) {
  if (state.addonIds.has(addonId)) {
    state.addonIds.delete(addonId);
  } else {
    state.addonIds.add(addonId);
  }

  const card = checkCircle.closest('.plan-card');
  if (card) {
    const isSelected = state.addonIds.has(addonId);
    card.classList.toggle('selected', isSelected);
    centerPlanCard(card);
  }

  updateCartSummary();
  updateAddonSkipButton();
  updateAddonActionButton();
}

function updateAddonActionButton() {
  const actionButton = document.querySelector('.addons-action-btn');
  if (!actionButton) return;
  
  const hasSelectedAddons = state.addonIds.size > 0;
  
  if (hasSelectedAddons) {
    actionButton.textContent = 'Continue';
    actionButton.className = 'addons-action-btn addons-continue';
  } else {
    actionButton.textContent = 'Skip';
    actionButton.className = 'addons-action-btn addons-skip';
  }
}

function handleAddonAction() {
  const hasSelectedAddons = state.addonIds.size > 0;
  
  if (hasSelectedAddons) {
    // If addons are selected, proceed directly
    proceedAfterAddons();
  } else {
    // If no addons selected, show confirmation dialog
    showSkipConfirmation();
  }
}

function showSkipConfirmation() {
  // Create confirmation modal
  const confirmationOverlay = document.createElement('div');
  confirmationOverlay.className = 'confirmation-overlay';
  confirmationOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;
  
  const confirmationDialog = document.createElement('div');
  confirmationDialog.className = 'confirmation-dialog';
  confirmationDialog.style.cssText = `
    background: var(--color-surface-dark);
    border: 2px solid var(--color-item-border);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    text-align: center;
    color: var(--color-text-secondary);
  `;
  
  confirmationDialog.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: 18px;">Are you sure?</h3>
    <p style="margin: 0 0 24px 0; color: var(--color-text-muted); line-height: 1.5;">
      You're missing out on essential gear that could enhance your climbing experience. 
      These add-ons are specially selected and offer great value!
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button class="confirmation-btn confirmation-cancel" style="
        padding: 10px 20px;
        border: 1px solid var(--color-item-border);
        border-radius: 8px;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        font-weight: 600;
      ">Go Back</button>
      <button class="confirmation-btn confirmation-skip" style="
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: var(--color-brand-accent);
        color: var(--color-button-primary);
        cursor: pointer;
        font-weight: 600;
      ">Skip Anyway</button>
    </div>
  `;
  
  confirmationOverlay.appendChild(confirmationDialog);
  document.body.appendChild(confirmationOverlay);
  
  // Add event listeners
  confirmationOverlay.querySelector('.confirmation-cancel').addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
  });
  
  confirmationOverlay.querySelector('.confirmation-skip').addEventListener('click', () => {
    document.body.removeChild(confirmationOverlay);
    proceedAfterAddons();
  });
  
  // Close on overlay click
  confirmationOverlay.addEventListener('click', (e) => {
    if (e.target === confirmationOverlay) {
      document.body.removeChild(confirmationOverlay);
    }
  });
}

function adjustValueCardQuantity(planId, delta) {
  const plan = findValueCard(planId);
  if (!plan) return;

  const current = state.valueCardQuantities.get(planId) ?? plan.min ?? 0;
  const max = Number.isFinite(plan.max) ? plan.max : current + delta;
  const min = plan.min ?? 0;
  const next = Math.max(min, Math.min(max, current + delta));

  state.valueCardQuantities.set(planId, next);
  syncValueCardUI(planId);
  enforceValueCardAvailability();
  updateCartSummary();
  updateValueCardSummary();
}

function syncValueCardUI(planId) {
  const plan = findValueCard(planId);
  if (!plan || !DOM.valuePlans) return;

  const card = DOM.valuePlans.querySelector(`[data-plan-id="${planId}"]`);
  if (!card) return;

  const selector = card.querySelector('.quantity-selector');
  const valueEl = card.querySelector('[data-element="quantityValue"]');
  const totalEl = card.querySelector('[data-element="quantityTotal"]');
  const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
  const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

  const quantity = state.valueCardQuantities.get(planId) ?? plan.min ?? 0;
  const total = plan.price * quantity;

  if (valueEl) valueEl.textContent = quantity;
  if (totalEl) totalEl.textContent = numberFormatter.format(total);
  if (selector) selector.dataset.current = String(quantity);

  if (decrementBtn) decrementBtn.disabled = quantity <= (plan.min ?? 0);
  if (incrementBtn) {
    if (Number.isFinite(plan.max)) {
      incrementBtn.disabled = quantity >= plan.max;
    } else {
      incrementBtn.disabled = false;
    }
  }

  card.classList.toggle('selected', quantity > (plan.min ?? 0));
}

function enforceValueCardAvailability() {
  if (!DOM.valuePlans) return;
  const activeId = Array.from(state.valueCardQuantities.entries()).find(([, qty]) => qty > 0)?.[0] ?? null;

  DOM.valuePlans.querySelectorAll('.plan-card').forEach((card) => {
    const selector = card.querySelector('.quantity-selector');
    if (!selector) return;
    const planId = card.dataset.planId;
    const decrementBtn = card.querySelector('[data-action="decrement-quantity"]');
    const incrementBtn = card.querySelector('[data-action="increment-quantity"]');

    const disable = Boolean(activeId && planId !== activeId);
    card.classList.toggle('disabled', disable);

    if (disable) {
      decrementBtn?.setAttribute('disabled', 'true');
      incrementBtn?.setAttribute('disabled', 'true');
    } else {
      decrementBtn?.removeAttribute('disabled');
      incrementBtn?.removeAttribute('disabled');
      syncValueCardUI(planId ?? '');
    }
  });
}

function updateValueCardSummary() {
  if (!DOM.valueCardPunches || !DOM.valueCardContinueBtn) return;

  const totalQuantity = Array.from(state.valueCardQuantities.values()).reduce(
    (sum, qty) => sum + qty,
    0,
  );
  const totalPunches = totalQuantity * VALUE_CARD_PUNCH_MULTIPLIER;
  const entryLabel = totalPunches === 1 ? 'entry' : 'entries';

  DOM.valueCardPunches.textContent = totalPunches.toString();
  DOM.valueCardContinueBtn.disabled = totalQuantity <= 0;
  if (DOM.valueCardEntryLabel) {
    DOM.valueCardEntryLabel.textContent = entryLabel;
  }
  DOM.valueCardContinueBtn.setAttribute('aria-label', `Continue with ${totalPunches} ${entryLabel}`);
}

function handleValueCardContinue() {
  const hasSelection = Array.from(state.valueCardQuantities.values()).some((qty) => qty > 0);

  if (!hasSelection) {
    showToast('Select a value card quantity before continuing.', 'error');
    return;
  }

  nextStep();
}

function updateAddonSkipButton() {
  if (!DOM.skipAddonsBtn) return;

  const hasAddonsSelected = state.addonIds.size > 0;
  DOM.skipAddonsBtn.textContent = hasAddonsSelected ? 'Continue' : 'Skip';
}

function handleAddonContinue() {
  // Whether skipping or continuing after picking add-ons, we proceed to step 4
  nextStep();
}

function handleEditCart() {
  // Jump back to step 2 (plan selection)
  state.currentStep = 2;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();
}

function handlePaymentChange(event) {
  const selected = event.target;
  state.paymentMethod = selected.value;
  updateCheckoutButton();

  DOM.paymentOptions.forEach((option) => {
    const parent = option.closest('.payment-option');
    if (parent) parent.classList.toggle('selected', option.checked);
  });

  if (DOM.cardPaymentForm) {
    DOM.cardPaymentForm.style.display = state.paymentMethod === 'card' ? 'block' : 'none';
  }
}

function toggleDiscountForm() {
  if (!DOM.discountForm) return;
  const isVisible = DOM.discountForm.style.display !== 'none';
  DOM.discountForm.style.display = isVisible ? 'none' : 'flex';
  DOM.discountToggle?.classList.toggle('active', !isVisible);
}

function handleSameAddressToggle(event) {
  if (event.target.checked) {
    copyAddressAndContactInfo();
  } else {
    clearParentFormFields();
  }
}

function handleParentGuardianToggle(event) {
  if (!DOM.parentGuardianForm) return;
  const isChecked = event.target.checked;

  DOM.parentGuardianForm.style.display = isChecked ? 'block' : 'none';
  if (DOM.parentGuardianReminder) {
    DOM.parentGuardianReminder.hidden = !isChecked;
  }

  clearParentFormFields();
}

function formatCardNumber(event) {
  const digits = event.target.value.replace(/\s+/g, '').replace(/[^\d]/g, '');
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}

function formatExpiryDate(event) {
  const digits = event.target.value.replace(/[^\d]/g, '');
  const formatted = digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}` : digits;
  event.target.value = formatted.slice(0, 5);
}

function stripNonDigits(event) {
  event.target.value = event.target.value.replace(/[^\d]/g, '');
}

function copyAddressAndContactInfo() {
  const mappings = [
    ['streetAddress', 'parentStreetAddress'],
    ['postalCode', 'parentPostalCode'],
    ['city', 'parentCity'],
    ['email', 'parentEmail'],
    ['countryCode', 'parentCountryCode'],
    ['phoneNumber', 'parentPhoneNumber'],
  ];

  mappings.forEach(([sourceId, targetId]) => {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    target.value = source.value;
    target.readOnly = true;
    if (target.tagName === 'SELECT') {
      target.value = source.value;
      target.disabled = true;
    }
    target.classList.add('readonly-field');
  });
}

function clearParentFormFields() {
  const parentFields = [
    'parentStreetAddress',
    'parentPostalCode',
    'parentCity',
    'parentEmail',
    'parentCountryCode',
    'parentPhoneNumber',
  ];

  parentFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.value = '';
    field.readOnly = false;
    field.disabled = false;
    field.classList.remove('readonly-field');
  });
}

function updateCartSummary() {
  const items = [];
  state.totals.membershipMonthly = 0;

  if (state.membershipPlanId) {
    const membership = findMembershipPlan(state.membershipPlanId);
    if (membership) {
      items.push({
        id: membership.id,
        name: `${membership.name} membership`,
        amount: membership.price,
        type: 'membership',
      });
      state.totals.membershipMonthly = membership.price;
    }
  }

  state.valueCardQuantities.forEach((quantity, planId) => {
    if (quantity <= 0) return;
    const valueCard = findValueCard(planId);
    if (!valueCard) return;
    items.push({
      id: valueCard.id,
      name: `${valueCard.name} value card ×${quantity}`,
      amount: valueCard.price * quantity,
      type: 'value-card',
    });
  });

  state.addonIds.forEach((addonId) => {
    const addon = findAddon(addonId);
    if (!addon) return;
    items.push({
      id: addon.id,
      name: addon.name,
      amount: addon.price.discounted,
      type: 'addon',
    });
  });

  state.cartItems = items;
  state.totals.cartTotal = items.reduce((total, item) => total + item.amount, 0);

  renderCartItems();
  renderCartTotal();
}

function renderCartItems() {
  if (!templates.cartItem || !DOM.cartItems) return;
  DOM.cartItems.innerHTML = '';

  if (!state.cartItems.length) {
    const empty = document.createElement('div');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty';
    DOM.cartItems.appendChild(empty);
    return;
  }

  state.cartItems.forEach((item) => {
    const cartItem = templates.cartItem.content.firstElementChild.cloneNode(true);
    const nameEl = cartItem.querySelector('[data-element="name"]');
    const priceEl = cartItem.querySelector('[data-element="price"]');

    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) priceEl.textContent = currencyFormatter.format(item.amount);

    DOM.cartItems.appendChild(cartItem);
  });
}

function renderCartTotal() {
  if (DOM.cartTotal) {
    DOM.cartTotal.textContent = currencyFormatter.format(state.totals.cartTotal);
  }

  if (DOM.billingPeriod) {
    DOM.billingPeriod.textContent = state.billingPeriod || 'Billing period confirmed after checkout.';
  }
}

function handleCheckout() {
  if (!validateForm()) {
    showToast('Please review the highlighted fields.', 'error');
    return;
  }

  if (!state.membershipPlanId) {
    showToast('Select a membership to continue.', 'error');
    return;
  }

  if (!state.paymentMethod) {
    showToast('Choose a payment method to continue.', 'error');
    return;
  }

  const payload = buildCheckoutPayload();
  state.forms = payload;
  state.order = buildOrderSummary(payload);

  console.info('[checkout] payload ready for backend integration', payload);
  showToast('Checkout payload prepared. Connect backend API to complete.', 'success');

  if (state.currentStep < TOTAL_STEPS) {
    nextStep();
  } else {
    renderConfirmationView();
  }
}

function buildCheckoutPayload() {
  const payload = {};
  const fields = document.querySelectorAll('[data-api-field]');

  fields.forEach((field) => {
    const path = field.dataset.apiField;
    if (!path) return;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    setByPath(payload, path, value);
  });

  const valueCards = Array.from(state.valueCardQuantities.entries())
    .filter(([, qty]) => qty > 0)
    .map(([planId, quantity]) => ({ planId, quantity }));

  payload.purchase = {
    ...(payload.purchase || {}),
    membershipPlanId: state.membershipPlanId,
    valueCards,
    addons: Array.from(state.addonIds),
    totalAmount: state.totals.cartTotal,
  };

  payload.payment = {
    ...(payload.payment || {}),
    method: state.paymentMethod,
  };

  return payload;
}

function buildOrderSummary(payload) {
  const now = new Date();
  const membership = findMembershipPlan(state.membershipPlanId ?? '');

  return {
    number: 'TBD-ORDER-ID',
    date: now,
    items: [...state.cartItems],
    total: state.totals.cartTotal,
    memberName: payload.customer?.fullName ?? '',
    membershipNumber: 'TBD-MEMBERSHIP-ID',
    membershipType: membership?.name ?? '—',
    primaryGym: resolveGymLabel(payload.customer?.primaryGym),
    membershipPrice: state.totals.membershipMonthly,
  };
}

function resolveGymLabel(value) {
  const mapping = {
    'boulders-copenhagen': 'Boulders Copenhagen',
    'boulders-aarhus': 'Boulders Aarhus',
    'boulders-odense': 'Boulders Odense',
  };
  return value ? mapping[value] ?? value : '—';
}

function renderConfirmationView() {
  if (!state.order) return;

  const { orderNumber, orderDate, orderTotal, memberName, membershipNumber, membershipType, primaryGym, membershipPrice } = DOM.confirmationFields;

  if (orderNumber) orderNumber.textContent = state.order.number;
  if (orderDate) {
    orderDate.textContent = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(state.order.date);
  }
  if (orderTotal) orderTotal.textContent = currencyFormatter.format(state.order.total);
  if (memberName) memberName.textContent = state.order.memberName || '—';
  if (membershipNumber) membershipNumber.textContent = state.order.membershipNumber;
  if (membershipType) membershipType.textContent = state.order.membershipType;
  if (primaryGym) primaryGym.textContent = state.order.primaryGym;
  if (membershipPrice) {
    membershipPrice.textContent = `${currencyFormatter.format(state.order.membershipPrice)}/month`;
  }

  if (templates.confirmationItem && DOM.confirmationItems) {
    DOM.confirmationItems.innerHTML = '';
    state.order.items.forEach((item) => {
      const node = templates.confirmationItem.content.firstElementChild.cloneNode(true);
      const nameEl = node.querySelector('[data-element="name"]');
      const priceEl = node.querySelector('[data-element="price"]');
      if (nameEl) nameEl.textContent = item.name;
      if (priceEl) priceEl.textContent = currencyFormatter.format(item.amount);
      DOM.confirmationItems.appendChild(node);
    });
  }
}

function handleReferralCopy() {
  const referralLink = 'https://boulders.dk/refer?code=TBD-CODE';
  const clipboard = navigator.clipboard;

  if (clipboard && typeof clipboard.writeText === 'function') {
    clipboard
      .writeText(referralLink)
      .then(() => showToast('Referral link copied to clipboard!', 'success'))
      .catch(() => showToast('Unable to copy link. Please try again.', 'error'));
  } else {
    showToast('Clipboard not supported in this browser. Copy the URL manually.', 'error');
  }
}

function validateForm() {
  let isValid = true;
  clearErrorStates();

  REQUIRED_FIELDS.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field && !field.value.trim()) {
      isValid = false;
      highlightFieldError(fieldId);
    }
  });

  if (DOM.parentGuardianForm && DOM.parentGuardianForm.style.display !== 'none') {
    PARENT_REQUIRED_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId);
      }
    });
  }

  if (!DOM.termsConsent?.checked) {
    isValid = false;
    showToast('Please accept the terms and conditions.', 'error');
  }

  if (!state.paymentMethod) {
    isValid = false;
  }

  if (state.paymentMethod === 'card') {
    CARD_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && !field.value.trim()) {
        isValid = false;
        highlightFieldError(fieldId);
      }
    });

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber && cardNumber.value.trim() && !isValidCardNumber(cardNumber.value)) {
      isValid = false;
      highlightFieldError('cardNumber');
    }

    const expiryDate = document.getElementById('expiryDate');
    if (expiryDate && expiryDate.value.trim() && !isValidExpiryDate(expiryDate.value)) {
      isValid = false;
      highlightFieldError('expiryDate');
    }
  }

  return isValid;
}

function clearErrorStates() {
  [...REQUIRED_FIELDS, ...PARENT_REQUIRED_FIELDS, ...CARD_FIELDS].forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    const formGroup = field?.closest('.form-group');
    formGroup?.classList.remove('error');
  });
}

function highlightFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const formGroup = field?.closest('.form-group');
  formGroup?.classList.add('error');
}

function isValidCardNumber(value) {
  const digits = value.replace(/\s+/g, '');
  return /^\d{13,19}$/.test(digits);
}

function isValidExpiryDate(value) {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value);
}

function updateCheckoutButton() {
  if (!DOM.checkoutBtn) return;
  const termsAccepted = DOM.termsConsent?.checked ?? false;
  const hasMembership = Boolean(state.membershipPlanId);
  const hasPayment = Boolean(state.paymentMethod);

  DOM.checkoutBtn.disabled = !(termsAccepted && hasMembership && hasPayment);
}

function nextStep() {
  if (state.currentStep >= TOTAL_STEPS) return;
  // advance to next visible panel (skip any hidden ones)
  let target = state.currentStep + 1;
  // Ensure membership goes to Boost (step 3) right after Access (step 2)
  if (state.currentStep === 2 && isMembershipSelected()) {
    target = 3;
  }
  while (target <= TOTAL_STEPS) {
    const panel = DOM.stepPanels[target - 1];
    const hidden = panel && panel.style && panel.style.display === 'none';
    if (!hidden) break;
    target += 1;
  }
  state.currentStep = Math.min(target, TOTAL_STEPS);
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Scroll to top on mobile only
  if (window.innerWidth <= 768) {
    scrollToTop();
    setTimeout(() => {
      scrollToTop();
    }, 200);
  }

  if (state.currentStep === TOTAL_STEPS) {
    renderConfirmationView();
  }
}

function prevStep() {
  if (state.currentStep <= 1) return;
  // go back to previous visible panel (skip any hidden ones)
  let target = state.currentStep - 1;
  while (target >= 1) {
    const panel = DOM.stepPanels[target - 1];
    const hidden = panel && panel.style && panel.style.display === 'none';
    if (!hidden) break;
    target -= 1;
  }
  state.currentStep = Math.max(target, 1);
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Scroll to top immediately and with delay
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);
  
  // Show access heads-up if going back to step 2 and a plan is selected
  if (state.currentStep === 2 && state.membershipPlanId) {
    const selectedCard = document.querySelector(`[data-plan="${state.membershipPlanId}"]`);
    if (selectedCard) {
        // Ensure the card is selected visually
        // Clear all selections first
        document.querySelectorAll('.plan-card').forEach(c => {
          c.classList.remove('selected', 'has-quantity');
          // Hide quantity selector for all cards
          const selector = c.querySelector('.quantity-selector');
          if (selector) {
            selector.style.display = 'none';
          }
        });
        
        // Select the previously selected card
        selectedCard.classList.add('selected');
        
        // If it's a punch card, restore quantity panel and disabled state
        const category = selectedCard.closest('.category-item').dataset.category;
        if (category === 'punchcard' && state.valueCardQuantities.has(state.membershipPlanId)) {
          selectedCard.classList.add('has-quantity');
          const panel = selectedCard.nextElementSibling;
          if (panel && panel.classList.contains('quantity-panel')) {
            panel.classList.add('show');
            panel.style.display = 'block';
            syncPunchCardQuantityUI(selectedCard, state.membershipPlanId);
          }
          
          // Grey out the other punch card type
          const otherPunchCard = document.querySelector(`[data-plan="${state.membershipPlanId === 'adult-punch' ? 'junior-punch' : 'adult-punch'}"]`);
          if (otherPunchCard) {
            otherPunchCard.classList.add('disabled');
          }
        }
        
        // Show heads-up for previously selected access type
        updateAccessHeadsUp(selectedCard);
      }
    }
}

function showStep(stepNumber) {
  DOM.stepPanels.forEach((panel, index) => {
    panel.classList.toggle('active', index + 1 === stepNumber);
  });
}

function updateStepIndicator() {
  const stepIndicator = document.querySelector('.step-indicator');
  if (!stepIndicator) return;

  if (state.currentStep === TOTAL_STEPS) {
    stepIndicator.classList.add('hidden');
  } else {
    stepIndicator.classList.remove('hidden');
  }

  // Compute visible step panels to determine current visible index
  const visiblePanels = DOM.stepPanels.filter((panel) => panel && panel.style.display !== 'none');
  const currentPanel = DOM.stepPanels[state.currentStep - 1];
  const visibleCurrentIndex = Math.max(0, visiblePanels.indexOf(currentPanel));

  // Work only with visible indicator steps (Boost is hidden by applyConditionalSteps)
  const indicatorSteps = Array.from(document.querySelectorAll('.step'))
    .filter((s) => !s.classList.contains('hidden'));
  const indicatorCircles = indicatorSteps.map((s) => s.querySelector('.step-circle')).filter(Boolean);
  const indicatorConnectors = Array.from(document.querySelectorAll('.step-connector'))
    .filter((c) => !c.classList.contains('hidden'));

  indicatorCircles.forEach((circle, index) => {
    const isCompleted = index < visibleCurrentIndex;
    const isActive = index === visibleCurrentIndex;
    circle.classList.toggle('completed', isCompleted);
    circle.classList.toggle('active', isActive);
    circle.classList.toggle('inactive', !isActive && !isCompleted);

    if (isCompleted) {
      circle.innerHTML =
        '<svg class="checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    } else {
      circle.textContent = String(index + 1);
    }

    const step = circle.closest('.step');
    if (step) {
      step.classList.toggle('completed', isCompleted);
      step.classList.toggle('active', isActive);
      step.classList.toggle('inactive', !isActive && !isCompleted);
    }
  });

  indicatorConnectors.forEach((connector, index) => {
    connector.classList.toggle('completed', index < visibleCurrentIndex);
  });
}

function updateNavigationButtons() {
  DOM.prevBtn.disabled = state.currentStep === 1;
  DOM.nextBtn.disabled = state.currentStep === TOTAL_STEPS;
  DOM.nextBtn.textContent = state.currentStep === TOTAL_STEPS ? 'Complete' : 'Next';
  
  // Update forward arrow visibility
  const forwardArrowBtn = document.getElementById('forwardArrowBtn');
  if (forwardArrowBtn) {
    // Hide forward arrow on last step
    if (state.currentStep === TOTAL_STEPS) {
      forwardArrowBtn.style.display = 'none';
    } else {
      forwardArrowBtn.style.display = 'flex';
    }
  }
}

function updateMainSubtitle() {
  if (!DOM.mainSubtitle || !DOM.mainTitle) return;

  const subtitles = {
    1: 'Choose your home gym',
    2: 'Choose your access type',
    3: 'Need an add-on?',
    4: 'Log in to your existing account or create a new one',
    5: 'Welcome to Boulders!',
  };

  DOM.mainSubtitle.textContent = subtitles[state.currentStep] ?? 'Choose your membership type';
  DOM.mainTitle.textContent = state.currentStep === TOTAL_STEPS ? 'WELCOME TO BOULDERS' : 'JOIN BOULDERS';
}

function refreshCarousels() {
  document.querySelectorAll('.plan-section').forEach((section) => {
    setupCarousel(section);
  });
}

function scrollCardIntoCenter(carousel, card, behavior = 'smooth') {
  if (!carousel || !card) return;

  const canScroll = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
  if (!canScroll) return;

  const cardOffset = card.offsetLeft;
  const cardWidth = card.offsetWidth;
  const desiredLeft = cardOffset - (carousel.clientWidth / 2 - cardWidth / 2);
  const maxScroll = Math.max(carousel.scrollWidth - carousel.clientWidth, 0);
  const target = Math.min(Math.max(desiredLeft, 0), maxScroll);

  carousel.scrollTo({ left: target, behavior });
}

function centerPlanCard(card, behavior = 'smooth') {
  if (!card) return;
  const carousel = card.closest('[data-scroll-container]');
  if (!carousel) return;

  scrollCardIntoCenter(carousel, card, behavior);
  carousel.dataset.centerInitialized = 'true';
}

function initializeCarouselCenter(carousel) {
  if (!carousel || carousel.dataset.centerInitialized === 'true') return;

  const initialId = carousel.dataset.initialPlanId;
  let targetCard = initialId ? carousel.querySelector(`[data-plan-id="${initialId}"]`) : null;
  if (!targetCard) {
    targetCard = carousel.querySelector('.plan-card.selected');
  }
  if (!targetCard) {
    targetCard = carousel.querySelector('.plan-card');
  }

  if (targetCard) {
    scrollCardIntoCenter(carousel, targetCard, 'auto');
    carousel.dataset.centerInitialized = 'true';
  }
}

function setupCarousel(section) {
  const carousel = section.querySelector('[data-scroll-container]');
  const indicator = section.querySelector('.scroll-indicator');
  if (!carousel || !indicator) return;

  const updateIndicator = () => {
    const canScroll = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
    indicator.classList.toggle('hidden', !canScroll);
    if (!canScroll) return;
    indicator.classList.toggle('at-start', carousel.scrollLeft <= 0);
    indicator.classList.toggle(
      'at-end',
      Math.ceil(carousel.scrollLeft + carousel.clientWidth) >= Math.ceil(carousel.scrollWidth),
    );
  };

  const adjustEdgePadding = () => {
    const firstCard = carousel.querySelector('.plan-card');
    if (!firstCard) {
      carousel.style.removeProperty('--carousel-edge-padding');
      carousel.style.removeProperty('--carousel-scroll-padding');
      return;
    }

    const cardWidth = firstCard.getBoundingClientRect().width;
    const containerWidth = carousel.getBoundingClientRect().width;

    if (!cardWidth || !containerWidth) {
      window.requestAnimationFrame(adjustEdgePadding);
      return;
    }

    const hasHorizontalOverflow = Math.ceil(carousel.scrollWidth) > Math.ceil(carousel.clientWidth);
    if (!hasHorizontalOverflow) {
      carousel.style.removeProperty('--carousel-edge-padding');
      carousel.style.removeProperty('--carousel-scroll-padding');
      return;
    }

    const diff = containerWidth - cardWidth;
    const edgePadding = diff > 0 ? diff / 2 : 12;
    const scrollPadding = diff > 0 ? diff / 2 : 12;

    carousel.style.setProperty('--carousel-edge-padding', `${edgePadding}px`);
    carousel.style.setProperty('--carousel-scroll-padding', `${scrollPadding}px`);
  };

  const updateCarouselState = () => {
    adjustEdgePadding();
    updateIndicator();
    const selectedCard = carousel.querySelector('.plan-card.selected');
    if (selectedCard) {
      scrollCardIntoCenter(carousel, selectedCard, 'auto');
    }
  };

  updateCarouselState();
  initializeCarouselCenter(carousel);

  let scrollHandler = carouselScrollHandlers.get(carousel);
  if (scrollHandler) {
    carousel.removeEventListener('scroll', scrollHandler);
  }
  scrollHandler = () => updateIndicator();
  carousel.addEventListener('scroll', scrollHandler, { passive: true });
  carouselScrollHandlers.set(carousel, scrollHandler);

  if (typeof ResizeObserver === 'function') {
    const fallbackHandler = carouselResizeFallbacks.get(carousel);
    if (fallbackHandler) {
      window.removeEventListener('resize', fallbackHandler);
      carouselResizeFallbacks.delete(carousel);
    }

    let resizeObserver = carouselResizeObservers.get(carousel);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(updateCarouselState);
    resizeObserver.observe(carousel);
    const firstCard = carousel.querySelector('.plan-card');
    if (firstCard) {
      resizeObserver.observe(firstCard);
    }
    carouselResizeObservers.set(carousel, resizeObserver);
  } else {
    let fallbackHandler = carouselResizeFallbacks.get(carousel);
    if (fallbackHandler) {
      window.removeEventListener('resize', fallbackHandler);
    }
    fallbackHandler = () => updateCarouselState();
    window.addEventListener('resize', fallbackHandler);
    carouselResizeFallbacks.set(carousel, fallbackHandler);
  }
}

function setByPath(target, path, value) {
  const segments = path.split('.');
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
    } else {
      current[segment] = current[segment] ?? {};
      current = current[segment];
    }
  });
}

function findMembershipPlan(id) {
  return MEMBERSHIP_PLANS.find((plan) => plan.id === id) ?? null;
}

function findValueCard(id) {
  return VALUE_CARDS.find((plan) => plan.id === id) ?? null;
}

function findAddon(id) {
  return ADDONS.find((addon) => addon.id === id) ?? null;
}

function showToast(message, type = 'info') {
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach((toast) => toast.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
