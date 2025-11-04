// API Utility Functions for BUSINESSUNITS API
// This file contains helper functions for working with the gym data and API

// Import the gym data (if using modules)
// import { GYM_DATA_API, BusinessUnitsAPI } from './gym-data-api.js';

// For browser usage, we'll define the data here as well
const GYM_DATA_API = [
  {
    id: 1,
    name: "Boulders Copenhagen",
    company: {
      id: 1,
      name: "Boulders Denmark",
    },
    companyNameForInvoice: "Boulders Denmark A/S",
    address: {
      street: "Vesterbrogade 149",
      city: "København V",
      postalCode: "1620",
      country: "Denmark",
      latitude: 55.6761,
      longitude: 12.5683
    },
    location: "DK",
    region: {
      id: 1,
      name: "Copenhagen Region",
    },
    currency: "DKK",
    releaseSuspensionProduct: {},
    settings: {},
    hasRegisterUnitForInternet: true
  },
  // ... (other gyms would be here)
];

// Utility functions for API operations
class APIUtils {
  constructor() {
    this.api = new BusinessUnitsAPI();
  }

  // Test API connection
  async testConnection() {
    try {
      const gyms = await this.api.getBusinessUnits();
      console.log('✅ API Connection successful');
      console.log(`Found ${gyms.length} business units`);
      return { success: true, data: gyms };
    } catch (error) {
      console.error('❌ API Connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync all gyms to API
  async syncAllGyms() {
    console.log('🔄 Starting gym sync to API...');
    const results = [];
    
    for (const gym of GYM_DATA_API) {
      try {
        // Check if gym already exists
        const existingGyms = await this.api.getBusinessUnits();
        const existingGym = existingGyms.find(g => g.id === gym.id);
        
        if (existingGym) {
          console.log(`📝 Updating existing gym: ${gym.name}`);
          const result = await this.api.updateBusinessUnit(gym.id, gym);
          results.push({ 
            action: 'updated', 
            gym: gym.name, 
            success: true, 
            data: result 
          });
        } else {
          console.log(`➕ Creating new gym: ${gym.name}`);
          const result = await this.api.createBusinessUnit(gym);
          results.push({ 
            action: 'created', 
            gym: gym.name, 
            success: true, 
            data: result 
          });
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${gym.name}:`, error);
        results.push({ 
          action: 'failed', 
          gym: gym.name, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    console.log('✅ Gym sync completed');
    return results;
  }

  // Get gym by ID
  async getGymById(id) {
    try {
      const gyms = await this.api.getBusinessUnits();
      return gyms.find(gym => gym.id === id);
    } catch (error) {
      console.error('Error getting gym by ID:', error);
      return null;
    }
  }

  // Search gyms by name or location
  async searchGyms(query) {
    try {
      const gyms = await this.api.getBusinessUnits();
      const searchTerm = query.toLowerCase();
      
      return gyms.filter(gym => 
        gym.name.toLowerCase().includes(searchTerm) ||
        gym.address.city.toLowerCase().includes(searchTerm) ||
        gym.address.street.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Error searching gyms:', error);
      return [];
    }
  }

  // Validate gym data against API schema
  validateGymData(gymData) {
    const requiredFields = [
      'id', 'name', 'company', 'companyNameForInvoice', 
      'address', 'location', 'region', 'currency'
    ];
    
    const missingFields = requiredFields.filter(field => !gymData[field]);
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: [`Missing required fields: ${missingFields.join(', ')}`]
      };
    }

    // Validate address structure
    if (!gymData.address.street || !gymData.address.city || !gymData.address.postalCode) {
      return {
        valid: false,
        errors: ['Address must include street, city, and postalCode']
      };
    }

    // Validate country code
    if (!/^[A-Z]{2}$/.test(gymData.location)) {
      return {
        valid: false,
        errors: ['Location must be a valid ISO 3166-1 alpha-2 country code']
      };
    }

    return { valid: true, errors: [] };
  }

  // Export gym data to JSON file
  exportGymData() {
    const dataStr = JSON.stringify(GYM_DATA_API, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boulders-gyms-api-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Import gym data from JSON file
  async importGymData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// Browser console helpers
if (typeof window !== 'undefined') {
  window.APIUtils = APIUtils;
  window.GYM_DATA_API = GYM_DATA_API;
  
  // Add console helpers
  window.testAPI = async () => {
    const utils = new APIUtils();
    return await utils.testConnection();
  };
  
  window.syncGyms = async () => {
    const utils = new APIUtils();
    return await utils.syncAllGyms();
  };
  
  window.exportGyms = () => {
    const utils = new APIUtils();
    utils.exportGymData();
  };
  
  console.log('🔧 API Utils loaded! Available commands:');
  console.log('  testAPI() - Test API connection');
  console.log('  syncGyms() - Sync all gyms to API');
  console.log('  exportGyms() - Export gym data to JSON');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIUtils, GYM_DATA_API };
}
