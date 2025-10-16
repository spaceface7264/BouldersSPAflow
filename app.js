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

function init() {
  cacheDom();
  cacheTemplates();
  renderCatalog();
  refreshCarousels();
  updateCartSummary();
  updateCheckoutButton();
  setupEventListeners();
  handleCategoryToggle('single');
  updateStepIndicator();
  updateNavigationButtons();
  
  // Load gyms from API
  loadGymsFromAPI();
  
  // Request user location for distance calculation
  getUserLocation();
  updateMainSubtitle();
}

document.addEventListener('DOMContentLoaded', init);

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
  if (!DOM.singlePlanSection || !DOM.valuePlanSection) return;

  const showSingle = category === 'single';

  // Update toggle button states
  DOM.toggleButtons?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  // Update toggle background position
  DOM.categoryToggle?.classList.toggle('right-active', !showSingle);

  // Animate section transitions
  const currentSection = showSingle ? DOM.singlePlanSection : DOM.valuePlanSection;
  const hidingSection = showSingle ? DOM.valuePlanSection : DOM.singlePlanSection;

  // Start hiding animation for current section
  if (hidingSection.dataset.state === 'visible') {
    hidingSection.dataset.state = 'leaving';
    hidingSection.classList.remove('expanded');
    hidingSection.classList.add('collapsed');
    
    // After animation completes, fully hide
    setTimeout(() => {
      if (hidingSection.dataset.state === 'leaving') {
        hidingSection.dataset.state = 'hidden';
      }
    }, 400);
  }

  // Start showing animation for target section  
  if (currentSection.dataset.state === 'hidden') {
    currentSection.dataset.state = 'entering';
    currentSection.classList.remove('collapsed');
    currentSection.classList.add('expanded');
    
    // After animation completes, mark as visible
    setTimeout(() => {
      if (currentSection.dataset.state === 'entering') {
        currentSection.dataset.state = 'visible';
      }
    }, 400);
  }

  // Scroll handling with slight delay to ensure section is visible
  setTimeout(() => {
    if (showSingle) {
      if (DOM.singleCarousel) DOM.singleCarousel.dataset.centerInitialized = 'false';
      DOM.singleCarousel?.scrollTo?.({ left: 0, behavior: 'smooth' });
    } else {
      if (DOM.valueCarousel) DOM.valueCarousel.dataset.centerInitialized = 'false';
      DOM.valueCarousel?.scrollTo?.({ left: 0, behavior: 'smooth' });
      // Reset disabled state whenever the value card section becomes visible
      DOM.valuePlans?.querySelectorAll('.plan-card').forEach((card) => {
        card.classList.remove('disabled');
      });
    }
    
    refreshCarousels();
    updateValueCardSummary();
  }, 100);
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
      const planId = actionable.dataset.planId;
      if (planId) {
        adjustValueCardQuantity(planId, 1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
      break;
    }
    case 'decrement-quantity': {
      const planId = actionable.dataset.planId;
      if (planId) {
        adjustValueCardQuantity(planId, -1);
        centerPlanCard(actionable.closest('.plan-card'));
      }
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

function toggleAddon(addonId, button) {
  if (state.addonIds.has(addonId)) {
    state.addonIds.delete(addonId);
  } else {
    state.addonIds.add(addonId);
  }

  const card = button.closest('.plan-card');
  if (card) {
    const isSelected = state.addonIds.has(addonId);
    card.classList.toggle('selected', isSelected);
    button.textContent = isSelected ? 'Selected' : findAddon(addonId)?.cta ?? 'Select Add-on';
    centerPlanCard(card);
  }

  updateCartSummary();
  updateAddonSkipButton();
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
  state.currentStep += 1;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Scroll to top immediately and with delay
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);

  if (state.currentStep === TOTAL_STEPS) {
    renderConfirmationView();
  }
}

function prevStep() {
  if (state.currentStep <= 1) return;
  state.currentStep -= 1;
  showStep(state.currentStep);
  updateStepIndicator();
  updateNavigationButtons();
  updateMainSubtitle();

  // Scroll to top immediately and with delay
  scrollToTop();
  setTimeout(() => {
    scrollToTop();
  }, 200);
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

  DOM.stepCircles.forEach((circle, index) => {
    const stepNumber = index + 1;
    const step = circle.closest('.step');
    const isCompleted = stepNumber < state.currentStep;
    const isActive = stepNumber === state.currentStep;

    circle.classList.toggle('completed', isCompleted);
    circle.classList.toggle('active', isActive);
    circle.classList.toggle('inactive', !isActive && !isCompleted);

    if (isCompleted) {
      circle.innerHTML =
        '<svg class="checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    } else {
      circle.textContent = stepNumber;
    }

    if (step) {
      step.classList.toggle('completed', isCompleted);
      step.classList.toggle('active', isActive);
      step.classList.toggle('inactive', !isActive && !isCompleted);
    }
  });

  DOM.stepConnectors.forEach((connector, index) => {
    const stepNumber = index + 1;
    connector.classList.toggle('completed', stepNumber < state.currentStep);
  });
}

function updateNavigationButtons() {
  DOM.prevBtn.disabled = state.currentStep === 1;
  DOM.nextBtn.disabled = state.currentStep === TOTAL_STEPS;
  DOM.nextBtn.textContent = state.currentStep === TOTAL_STEPS ? 'Complete' : 'Next';
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

  DOM.mainSubtitle.textContent = subtitles[state.currentStep] ?? 'Choose your access type';
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
