// Gym data prepared for BUSINESSUNITS API
// Based on API documentation: https://boulders.brpsystems.com/apiserver/api/ver3/businessunits

const GYM_DATA_API = [
  {
    id: 1,
    name: "Boulders Copenhagen",
    company: {
      id: 1,
      name: "Boulders Denmark",
      // Add other company fields as needed
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Vesterbrogade 149",
      city: "København V",
      postalCode: "1620",
      country: "Denmark",
      // Adding coordinates for distance calculation
      latitude: 55.6761,
      longitude: 12.5683
    },
    location: "DK", // ISO 3166-1 alpha-2 country code
    region: {
      id: 1,
      name: "Copenhagen Region",
      // Add other region fields as needed
    },
    currency: "DKK",
    releaseSuspensionProduct: {
      // Add product details if needed
    },
    settings: {
      // Add gym-specific settings
    },
    hasRegisterUnitForInternet: true
  },
  {
    id: 2,
    name: "Boulders Aarhus",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Søren Frichs Vej 42",
      city: "Åbyhøj",
      postalCode: "8230",
      country: "Denmark",
      latitude: 56.1572,
      longitude: 10.2107
    },
    location: "DK",
    region: {
      id: 2,
      name: "Central Jutland Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 3,
    name: "Boulders Odense",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Hjallesevej 91",
      city: "Odense M",
      postalCode: "5230",
      country: "Denmark",
      latitude: 55.4038,
      longitude: 10.4024
    },
    location: "DK",
    region: {
      id: 3,
      name: "Funen Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 4,
    name: "Boulders Aalborg",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Hobrovej 333",
      city: "Aalborg SV",
      postalCode: "9200",
      country: "Denmark",
      latitude: 57.0488,
      longitude: 9.9217
    },
    location: "DK",
    region: {
      id: 4,
      name: "North Jutland Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 5,
    name: "Boulders Esbjerg",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Gammel Vardevej 2",
      city: "Esbjerg",
      postalCode: "6700",
      country: "Denmark",
      latitude: 55.4703,
      longitude: 8.4549
    },
    location: "DK",
    region: {
      id: 5,
      name: "South Denmark Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 6,
    name: "Boulders Herning",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Industrivej 15",
      city: "Herning",
      postalCode: "7400",
      country: "Denmark",
      latitude: 56.1393,
      longitude: 8.9756
    },
    location: "DK",
    region: {
      id: 2,
      name: "Central Jutland Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 7,
    name: "Boulders Kolding",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Vestre Ringvej 36",
      city: "Kolding",
      postalCode: "6000",
      country: "Denmark",
      latitude: 55.4904,
      longitude: 9.4722
    },
    location: "DK",
    region: {
      id: 5,
      name: "South Denmark Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 8,
    name: "Boulders Randers",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Industrivej 8",
      city: "Randers C",
      postalCode: "8900",
      country: "Denmark",
      latitude: 56.4606,
      longitude: 10.0363
    },
    location: "DK",
    region: {
      id: 6,
      name: "East Jutland Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 9,
    name: "Boulders Vejle",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Vejlevej 25",
      city: "Vejle",
      postalCode: "7100",
      country: "Denmark",
      latitude: 55.7093,
      longitude: 9.5357
    },
    location: "DK",
    region: {
      id: 5,
      name: "South Denmark Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  {
    id: 10,
    name: "Boulders Viborg",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Industrivej 12",
      city: "Viborg",
      postalCode: "8800",
      country: "Denmark",
      latitude: 56.4531,
      longitude: 9.4021
    },
    location: "DK",
    region: {
      id: 7,
      name: "Central Jutland Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  }
];

// API Integration Functions
class BusinessUnitsAPI {
  constructor(baseUrl = 'https://boulders.brpsystems.com/apiserver') {
    this.baseUrl = baseUrl;
  }

  // Get all business units
  async getBusinessUnits() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching business units:', error);
      throw error;
    }
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

  // Delete a business unit
  async deleteBusinessUnit(id) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ver3/businessunits/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Error deleting business unit:', error);
      throw error;
    }
  }

  // Bulk create all gyms
  async createAllGyms() {
    const results = [];
    for (const gym of GYM_DATA_API) {
      try {
        const result = await this.createBusinessUnit(gym);
        results.push({ success: true, gym: gym.name, data: result });
        console.log(`Successfully created ${gym.name}`);
      } catch (error) {
        results.push({ success: false, gym: gym.name, error: error.message });
        console.error(`Failed to create ${gym.name}:`, error);
      }
    }
    return results;
  }
}

// Utility function to parse address string into structured format
function parseAddress(addressString) {
  // This is a basic parser - you might want to enhance it based on your address format
  const parts = addressString.split(', ');
  if (parts.length >= 2) {
    const street = parts[0];
    const cityPostal = parts[1].split(' ');
    const postalCode = cityPostal[0];
    const city = cityPostal.slice(1).join(' ');
    
    return {
      street,
      city,
      postalCode,
      country: "Denmark"
    };
  }
  return {
    street: addressString,
    city: "",
    postalCode: "",
    country: "Denmark"
  };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GYM_DATA_API, BusinessUnitsAPI, parseAddress };
}
