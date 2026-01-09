# Boulders Membership Flow

A modern, production-ready membership signup flow for Boulders climbing gyms with full API integration, payment processing, and comprehensive user experience.

## 🚀 Features

### Core Functionality
- **Multi-step signup process** with smooth transitions and validation
- **Gym selection** with real-time search, distance calculation, and geolocation
- **Membership & Punch Card selection** with detailed pricing and product information
- **Discount code application** with real-time price updates and success/error handling
- **Cart management** with live price updates and discount display
- **Checkout process** with comprehensive form validation
- **Payment integration** with BRP API3 payment link generation
- **Order confirmation** with detailed purchase information
- **Mobile-responsive design** optimized for all devices

### Advanced Features
- **Heads-up Display** - Shows selected gym name in top-right corner
- **Distance Calculation** - Real-time distance to gyms when location is allowed
- **API Integration** - Full integration with BRP API3 for orders, products, customers, and payments
- **Discount System** - Apply coupon codes with immediate price updates and visual feedback
- **Cart Price Display** - Shows original and discounted prices with strikethrough
- **Payment Overview** - Displays monthly fees and pay-now amounts with billing periods
- **Accessibility** - Focus management for expanded items, keyboard navigation
- **Smooth Animations** - Check circles, hover effects, transitions, and price highlight animations
- **Search Functionality** - Filter gyms by name or address
- **Back Navigation** - Clean back arrow for easy step navigation
- **Language Support** - Multi-language support (Danish/English) with i18n

## 📱 Step Flow

1. **Home Gym** - Select your preferred gym location
2. **Access Type** - Choose membership plan or punch card
3. **Checkout** - Complete payment and personal information
4. **Confirmation** - View order details and membership information

## 🎨 Design Features

### Visual Elements
- **Dark theme** with magenta accents
- **Smooth animations** and transitions
- **Clean typography** with proper hierarchy
- **Responsive grid layouts** (2 columns desktop, 1 column mobile)
- **Interactive feedback** with hover and selection states

### Heads-up Display
- **Fixed position** in top-right corner
- **Auto-show/hide** when gym is selected
- **Smooth animations** with fade and slide effects
- **Mobile optimized** with responsive sizing

### Gym Selection
- **Real-time search** with instant filtering
- **Distance indicators** when location is available
- **Smooth selection** with check circle animations
- **Auto-advance** to next step after selection

## 🔧 Technical Implementation

### API Integration
- **BUSINESSUNITS API** for gym data
- **Dynamic loading** of gym locations
- **Fallback data** when API is unavailable
- **Real-time updates** from API responses

### JavaScript Features
- **Modular architecture** with separate functions
- **Event delegation** for dynamic content
- **State management** for user selections
- **Error handling** with graceful fallbacks

### CSS Architecture
- **Mobile-first approach** with responsive breakpoints
- **CSS Grid and Flexbox** for layouts
- **Custom properties** for consistent theming
- **Smooth transitions** and animations

## 📁 File Structure

```
├── index.html              # Main HTML structure
├── styles.css              # Complete CSS styling
├── app.js                  # Main JavaScript functionality
├── api-utils.js            # API utility functions
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── docs/
│   ├── brp-api3-openapi.yaml  # BRP API3 OpenAPI specification
│   ├── backend-issues/     # Backend bug reports and issues
│   ├── deployment/         # Deployment guides and setup
│   ├── implementation/     # Implementation guides and references
│   ├── status/             # Status reports and plans
│   └── testing/            # Testing guides and results
├── features/               # React-based feature modules
│   └── signup/            # Signup flow components
├── shared/                 # Shared utilities and components
│   ├── styles/
│   │   └── tokens.css      # Design tokens
│   ├── constants/          # Shared constants
│   ├── lib/                # Utility libraries
│   ├── types/              # TypeScript type definitions
│   └── ui/                 # Reusable UI components
├── functions/              # Serverless functions
│   └── api-proxy/          # API proxy for Cloudflare Workers
└── README.md               # This file
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- Modern web browser with JavaScript enabled
- Internet connection for API calls
- Access to BRP API3 endpoints (for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "API Prod2"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Development server**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:5173`

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Preview production build**
   ```bash
   npm run preview
   ```

### Deployment

#### Cloudflare Pages
```bash
npm run deploy
```

#### Cloudflare Workers
```bash
npm run deploy:cloudflare
```

See `docs/deployment/` for detailed deployment guides.

## 🔌 API Integration

### BRP API3 Documentation
Complete OpenAPI 3.0 specification for BRP API3 is available in the project:
- **Location**: `docs/brp-api3-openapi.yaml`
- **Version**: 3.0.0
- **Format**: OpenAPI 3.0.1 YAML specification

This specification documents all available endpoints, request/response schemas, error codes, and authentication requirements. Use it as a reference when implementing new API integrations or troubleshooting endpoint issues.

### Integrated APIs

The application integrates with multiple BRP API3 endpoints:

- **Business Units** - Gym locations and information
- **Products** - Membership plans, punch cards, and add-ons
- **Orders** - Order creation and management
- **Customers** - Customer account creation and management
- **Subscriptions** - Membership subscription handling
- **Payments** - Payment link generation and processing
- **Coupons** - Discount code application

### API Endpoints

- **Base URL**: `https://boulders.brpsystems.com/apiserver/api/ver3`
- **Authentication**: Bearer token (JWT) for authenticated endpoints
- **Proxy**: API proxy available via Cloudflare Workers for CORS handling

See `docs/implementation/` for detailed integration guides.

## 🛠️ Development

### Tech Stack
- **Frontend Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Custom CSS
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod validation
- **Routing**: React Router
- **Deployment**: Cloudflare Pages/Workers

### Key Features Implementation

#### Discount System
- Real-time coupon code validation
- Immediate price updates on successful application
- Visual feedback with animations
- Error handling with specific error messages
- Support for both membership and punch card discounts

#### Cart Management
- Live price calculations
- Discount display with original and discounted prices
- Payment overview with monthly fees and pay-now amounts
- Billing period display

#### Order Processing
- Order creation and management via BRP API3
- Subscription item attachment for memberships
- Value card item addition for punch cards
- Payment link generation
- Order confirmation with detailed information

## 📱 Mobile Optimization

- **Touch-friendly** button sizes and spacing
- **Responsive breakpoints** at 640px and 768px
- **Optimized layouts** for single-column mobile view
- **Smooth scrolling** and touch interactions
- **Geolocation** support for distance calculation

## 📚 Documentation

Comprehensive documentation is organized in the `docs/` directory:

- **`docs/backend-issues/`** - Backend bug reports and issue tracking
- **`docs/deployment/`** - Deployment guides and Cloudflare setup
- **`docs/implementation/`** - Implementation guides and API integration references
- **`docs/status/`** - Project status reports and production readiness plans
- **`docs/testing/`** - Testing guides and test results

## 🔮 Future Enhancements

- [ ] Enhanced error handling and user feedback
- [ ] Additional payment methods
- [ ] Advanced filtering and search options
- [ ] Analytics integration
- [ ] A/B testing support

## 📄 License

This project is part of the Boulders membership system.

---