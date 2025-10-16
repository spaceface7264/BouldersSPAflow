# Boulders Membership Flow

A modern, responsive membership signup flow for Boulders climbing gyms with API integration and smooth user experience.

## 🚀 Features

### Core Functionality
- **Multi-step signup process** with smooth transitions
- **Gym selection** with real-time search and distance calculation
- **Membership plan selection** with detailed pricing
- **Add-on selection** for additional services
- **Checkout process** with form validation
- **Mobile-responsive design** optimized for all devices

### Advanced Features
- **Heads-up Display** - Shows selected gym name in top-right corner
- **Scroll to Top** - Automatically scrolls to top when navigating steps (⚠️ *Note: Still debugging - $100 debt acknowledged!*)
- **Distance Calculation** - Real-time distance to gyms when location is allowed
- **API Integration** - Dynamic gym loading from BUSINESSUNITS API
- **Smooth Animations** - Check circles, hover effects, and transitions
- **Search Functionality** - Filter gyms by name or address
- **Back Navigation** - Clean back arrow for easy step navigation

## 📱 Step Flow

1. **Home Gym** - Select your preferred gym location
2. **Access** - Choose membership plan type
3. **Boost** - Select additional add-ons
4. **Checkout** - Complete payment and personal information

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
├── gym-data-api.js         # API-ready gym data
├── api-utils.js            # API utility functions
├── shared/
│   ├── styles/
│   │   └── tokens.css      # Design tokens
│   └── constants/
│       └── index.ts        # Shared constants
└── README.md               # This file
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Internet connection for API calls

### Installation
1. Clone or download the project
2. Open `index.html` in a web browser
3. Or serve via local server:
   ```bash
   python3 -m http.server 8080 --bind 0.0.0.0
   ```

### Mobile Testing
Access via local network IP:
- **Desktop**: `http://localhost:8080`
- **Mobile**: `http://[YOUR_IP]:8080`

## 🔌 API Integration

### BUSINESSUNITS API
The application integrates with the BUSINESSUNITS API for gym data:

- **Endpoint**: `https://boulders.brpsystems.com/apiserver/api/ver3/businessunits`
- **Method**: GET (no authentication required)
- **Data Format**: JSON with structured gym information

### API Data Structure
```json
{
  "id": 1,
  "name": "Boulders Copenhagen",
  "address": {
    "street": "Vesterbrogade 149",
    "city": "København V",
    "postalCode": "1620",
    "latitude": 55.6761,
    "longitude": 12.5683
  },
  "location": "DK",
  "currency": "DKK"
}
```

## 🎯 Browser Console Commands

For development and testing:

```javascript
// Test API connection
testAPI()

// Sync all gyms to API
syncGyms()

// Export gym data to JSON
exportGyms()
```

## 📱 Mobile Optimization

- **Touch-friendly** button sizes and spacing
- **Responsive breakpoints** at 640px and 768px
- **Optimized layouts** for single-column mobile view
- **Smooth scrolling** and touch interactions

## 🐛 Known Issues

1. **Scroll to Top** - Still debugging the automatic scroll functionality (acknowledged $100 debt! 💸)
2. **API Fallback** - Uses local data when API is unavailable
3. **Location Permission** - Distance calculation requires user permission

## 🔮 Future Enhancements

- [ ] Fix scroll to top functionality (priority!)
- [ ] Add loading states for API calls
- [ ] Implement offline mode
- [ ] Add more gym filtering options
- [ ] Enhanced error handling and user feedback

## 📄 License

This project is part of the Boulders membership system.

---