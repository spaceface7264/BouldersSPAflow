# BUSINESSUNITS API Integration

This document describes how the gym locations have been prepared for the BUSINESSUNITS API based on the provided documentation.

## API Schema Compliance

The gym data has been transformed to match the BUSINESSUNITS API schema with the following key mappings:

### Required Fields
- **`id`**: Integer IDs (1-10) for each gym
- **`name`**: Gym names (e.g., "Boulders Copenhagen")
- **`company`**: Nested object with company information
- **`companyNameForInvoice`**: "Boulders Denmark A/S"
- **`address`**: Structured address object with street, city, postalCode, country
- **`location`**: "DK" (ISO 3166-1 alpha-2 country code)
- **`region`**: Nested object with region information
- **`currency`**: "DKK" for all Danish gyms

### Address Structure
```json
{
  "address": {
    "street": "Vesterbrogade 149",
    "city": "København V", 
    "postalCode": "1620",
    "country": "Denmark",
    "latitude": 55.6761,
    "longitude": 12.5683
  }
}
```

### Key Transformations Made

1. **String IDs → Integer IDs**: 
   - `boulders-copenhagen` → `1`
   - `boulders-aarhus` → `2`
   - etc.

2. **String Addresses → Structured Objects**:
   - "Vesterbrogade 149, 1620 København V" → structured address object

3. **Added Required Fields**:
   - Company information
   - Region data
   - Currency (DKK)
   - Country code (DK)

4. **Preserved Coordinates**:
   - Added latitude/longitude to address objects for distance calculation

## Files Created

### 1. `gym-data-api.js`
Contains the complete gym data array formatted for the API, plus the `BusinessUnitsAPI` class for API operations.

### 2. `api-utils.js`
Utility functions for:
- Testing API connection
- Syncing gyms to API
- Validating data
- Import/export functionality

### 3. Updated `app.js`
- Added API integration
- Fallback to local data if API fails
- Dynamic coordinate loading from API

## API Endpoints Used

- **GET** `/api/ver3/businessunits` - Fetch all business units
- **POST** `/api/ver3/businessunits` - Create new business unit
- **PUT** `/api/ver3/businessunits/{id}` - Update existing business unit
- **DELETE** `/api/ver3/businessunits/{id}` - Delete business unit

## Usage

### Browser Console Commands
```javascript
// Test API connection
testAPI()

// Sync all gyms to API
syncGyms()

// Export gym data to JSON
exportGyms()
```

### Programmatic Usage
```javascript
// Initialize API
const api = new BusinessUnitsAPI();

// Get all gyms
const gyms = await api.getBusinessUnits();

// Create a new gym
const newGym = await api.createBusinessUnit(gymData);

// Update existing gym
const updatedGym = await api.updateBusinessUnit(1, updatedData);
```

## Data Validation

The `APIUtils` class includes validation to ensure data matches the API schema:

- Required fields check
- Address structure validation
- Country code format validation
- Data type validation

## Error Handling

- API calls include try/catch blocks
- Fallback to local data if API fails
- Detailed error logging
- Graceful degradation

## Next Steps

1. **Test API Connection**: Use `testAPI()` to verify connectivity
2. **Sync Data**: Use `syncGyms()` to upload all gym data
3. **Monitor**: Check console for success/error messages
4. **Customize**: Modify company/region data as needed

## Notes

- All gyms are configured with `hasRegisterUnitForInternet: true`
- Currency is set to "DKK" for all Danish locations
- Country code is "DK" (Denmark)
- Coordinates are preserved for distance calculation functionality
- API calls are made to `https://boulders.brpsystems.com/apiserver`
