// Field name mapping to user-friendly labels
const FIELD_LABELS = {
  'username': 'Email',
  'email': 'Email',
  'customer.email': 'Email',
  'mobilePhone.number': 'Mobile number',
  'phoneNumber': 'Mobile number',
  'customer.mobilePhone.number': 'Mobile number',
  'customer.phone.number': 'Mobile number',
  'phone.number': 'Mobile number',
  'birthDate': 'Date of birth',
  'dateOfBirth': 'Date of birth',
  'customer.birthDate': 'Date of birth',
  'customer.dateOfBirth': 'Date of birth',
  'firstName': 'First name',
  'customer.firstName': 'First name',
  'lastName': 'Last name',
  'customer.lastName': 'Last name',
  'password': 'Password',
  'streetAddress': 'Street address',
  'customer.address.street': 'Street address',
  'postalCode': 'Postal code',
  'customer.address.postalCode': 'Postal code',
  'city': 'City',
  'customer.address.city': 'City',
};

// Error code mapping to user-friendly messages
const ERROR_CODE_MESSAGES = {
  'PHONENUMBER_INVALID': 'Please enter a valid phone number',
  'PHONENUMBER_REQUIRED': 'Phone number is required',
  'DATE_AGE_TOO_YOUNG': (minAge) => `Age must be at least ${minAge} years old`,
  'DATE_AGE_TOO_OLD': (maxAge) => `Age must be no more than ${maxAge} years old`,
  'DATE_INVALID': 'Please enter a valid date',
  'DATE_REQUIRED': 'Date of birth is required',
  'EMAIL_INVALID': 'Please enter a valid email address',
  'EMAIL_REQUIRED': 'Email is required',
  'REQUIRED': 'This field is required',
  'INVALID': 'Invalid value provided',
};

// Helper to get user-friendly field label
function getFieldLabel(field) {
  if (!field) return 'Field';
  
  // Check exact match first
  if (FIELD_LABELS[field]) {
    return FIELD_LABELS[field];
  }
  
  // Check partial matches (e.g., "customer.email" -> "email")
  const fieldLower = field.toLowerCase();
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (fieldLower.includes(key.toLowerCase()) || key.toLowerCase().includes(fieldLower)) {
      return label;
    }
  }
  
  // Fallback: capitalize and format the field name
  return field
    .split('.')
    .pop()
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Helper to get user-friendly error message from error code
function getErrorCodeMessage(errorCode, fieldError) {
  if (!errorCode) return null;
  
  const codeUpper = errorCode.toUpperCase();
  
  // Handle special cases with parameters
  if (codeUpper === 'DATE_AGE_TOO_YOUNG' && fieldError?.minAge !== undefined) {
    return ERROR_CODE_MESSAGES[codeUpper](fieldError.minAge);
  }
  if (codeUpper === 'DATE_AGE_TOO_OLD' && fieldError?.maxAge !== undefined) {
    return ERROR_CODE_MESSAGES[codeUpper](fieldError.maxAge);
  }
  
  // Direct mapping
  if (ERROR_CODE_MESSAGES[codeUpper]) {
    return typeof ERROR_CODE_MESSAGES[codeUpper] === 'function' 
      ? ERROR_CODE_MESSAGES[codeUpper]() 
      : ERROR_CODE_MESSAGES[codeUpper];
  }
  
  return null;
}

// Mapping from API field names to DOM field IDs
const FIELD_ID_MAP = {
  'username': 'loginEmail',
  'email': 'email',
  'customer.email': 'email',
  'mobilePhone.number': 'phoneNumber',
  'phoneNumber': 'phoneNumber',
  'customer.mobilePhone.number': 'phoneNumber',
  'customer.phone.number': 'phoneNumber',
  'phone.number': 'phoneNumber',
  'birthDate': 'dateOfBirth',
  'dateOfBirth': 'dateOfBirth',
  'customer.birthDate': 'dateOfBirth',
  'customer.dateOfBirth': 'dateOfBirth',
  'firstName': 'firstName',
  'customer.firstName': 'firstName',
  'lastName': 'lastName',
  'customer.lastName': 'lastName',
  'password': 'password',
  'customer.password': 'password',
  'streetAddress': 'streetAddress',
  'customer.address.street': 'streetAddress',
  'postalCode': 'postalCode',
  'customer.address.postalCode': 'postalCode',
  'city': 'city',
  'customer.address.city': 'city',
};

// Helper to map API field name to DOM field ID
function getFieldId(apiField) {
  if (!apiField) return null;
  
  // Check exact match first
  if (FIELD_ID_MAP[apiField]) {
    return FIELD_ID_MAP[apiField];
  }
  
  // Check partial matches
  const fieldLower = apiField.toLowerCase();
  for (const [key, fieldId] of Object.entries(FIELD_ID_MAP)) {
    if (fieldLower.includes(key.toLowerCase()) || key.toLowerCase().includes(fieldLower)) {
      return fieldId;
    }
  }
  
  // Try to extract the base field name (e.g., "customer.email" -> "email")
  const parts = apiField.split('.');
  const baseField = parts[parts.length - 1];
  
  // Convert camelCase to lowercase (e.g., "mobilePhone" -> "mobilephone")
  const baseFieldLower = baseField.replace(/([A-Z])/g, '-$1').toLowerCase();
  
  // Try common mappings
  if (baseFieldLower.includes('email') || baseFieldLower === 'email') {
    return 'email';
  }
  if (baseFieldLower.includes('phone') || baseFieldLower.includes('mobile')) {
    return 'phoneNumber';
  }
  if (baseFieldLower.includes('birth') || baseFieldLower.includes('date')) {
    return 'dateOfBirth';
  }
  
  return null;
}

// Extract field information from error data for highlighting
export function extractErrorFields(error) {
  const fields = [];
  
  if (!error || !error.message) {
    return fields;
  }
  
  // Try to parse validation errors from API response
  if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
    try {
      // Extract JSON from error message
      let jsonMatch = error.message.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = error.message.match(/-\s*(\{[\s\S]*\})/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        
        // Handle VALIDATION_ERROR with details array
        if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error?.details && Array.isArray(errorData.error.details)) {
          errorData.error.details.forEach(detail => {
            if (detail.field) {
              const fieldId = getFieldId(detail.field);
              if (fieldId) {
                fields.push({ fieldId, field: detail.field, message: detail.message });
              }
            }
          });
        }
        
        // Handle EXTERNAL_API_ERROR with fieldErrors in details
        if (errorData.error?.code === 'EXTERNAL_API_ERROR' && errorData.error?.details) {
          const details = errorData.error.details;
          if (details.fieldErrors && Array.isArray(details.fieldErrors)) {
            details.fieldErrors.forEach(fieldError => {
              if (fieldError.field) {
                const fieldId = getFieldId(fieldError.field);
                if (fieldId) {
                  fields.push({ fieldId, field: fieldError.field, errorCode: fieldError.errorCode });
                }
              }
            });
          }
        }
        
        // Handle generic validation errors with details array
        if (errorData.error?.details && Array.isArray(errorData.error.details)) {
          errorData.error.details.forEach(detail => {
            if (detail.field) {
              const fieldId = getFieldId(detail.field);
              if (fieldId && !fields.find(f => f.fieldId === fieldId)) {
                fields.push({ fieldId, field: detail.field, message: detail.message });
              }
            }
          });
        }
        
        // Handle field errors (legacy format)
        if (errorData.error?.details?.fieldErrors && Array.isArray(errorData.error.details.fieldErrors)) {
          errorData.error.details.fieldErrors.forEach(fieldError => {
            if (fieldError.field) {
              const fieldId = getFieldId(fieldError.field);
              if (fieldId && !fields.find(f => f.fieldId === fieldId)) {
                fields.push({ fieldId, field: fieldError.field, errorCode: fieldError.errorCode });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[extractErrorFields] Failed to parse error JSON:', e);
    }
  }
  
  return fields;
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error, context = 'operation') {
  // Network errors
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Try to parse validation errors from API response (400/401/403 errors with details)
  if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
    try {
      // Extract JSON from error message - try multiple patterns
      let jsonMatch = error.message.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Also try to parse the entire error text if it's JSON
        jsonMatch = error.message.match(/-\s*(\{[\s\S]*\})/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1]];
        }
      }
      
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        
        // Handle 401 errors with specific error codes (like INVALID_CREDENTIALS)
        if (errorData.code === 'INVALID_CREDENTIALS' || errorData.error?.code === 'INVALID_CREDENTIALS') {
          return errorData.message || errorData.error?.message || 'Invalid username or password';
        }
        
        // Handle VALIDATION_ERROR with details array (e.g., username validation)
        if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error?.details && Array.isArray(errorData.error.details)) {
          const validationMessages = errorData.error.details
            .map(detail => {
              const fieldLabel = getFieldLabel(detail.field);
              // Use the message from API if available, otherwise format it
              if (detail.message) {
                return detail.message;
              }
              return `${fieldLabel} is invalid`;
            })
            .filter(msg => msg) // Remove empty messages
            .join('. ');
          
          if (validationMessages) {
            return validationMessages;
          }
        }
        
        // Handle EXTERNAL_API_ERROR with fieldErrors in details (e.g., phone number, birth date)
        if (errorData.error?.code === 'EXTERNAL_API_ERROR' && errorData.error?.details) {
          const details = errorData.error.details;
          
          // Check for fieldErrors array in details
          if (details.fieldErrors && Array.isArray(details.fieldErrors) && details.fieldErrors.length > 0) {
            const fieldErrorMessages = details.fieldErrors
              .map(fieldError => {
                const fieldLabel = getFieldLabel(fieldError.field);
                const errorCode = fieldError.errorCode;
                
                // Try to get user-friendly message from error code
                const codeMessage = getErrorCodeMessage(errorCode, fieldError);
                if (codeMessage) {
                  return `${fieldLabel}: ${codeMessage}`;
                }
                
                // Fallback: format the error code
                return `${fieldLabel}: ${errorCode || 'Invalid value'}`;
              })
              .filter(msg => msg)
              .join('. ');
            
            if (fieldErrorMessages) {
              return fieldErrorMessages;
            }
          }
        }
        
        // Handle validation errors with details array (generic fallback)
        if (errorData.error?.details && Array.isArray(errorData.error.details)) {
          const validationErrors = errorData.error.details
            .map(detail => {
              const fieldLabel = getFieldLabel(detail.field);
              if (detail.message) {
                return `${fieldLabel}: ${detail.message}`;
              }
              return `${fieldLabel} is invalid`;
            })
            .filter(msg => msg)
            .join('. ');
          
          if (validationErrors) {
            return validationErrors;
          }
        }
        
        // Handle field errors (like customerType) - legacy format
        if (errorData.error?.details?.fieldErrors && Array.isArray(errorData.error.details.fieldErrors)) {
          const fieldErrors = errorData.error.details.fieldErrors
            .map(fieldError => {
              const fieldLabel = getFieldLabel(fieldError.field);
              const codeMessage = getErrorCodeMessage(fieldError.errorCode, fieldError);
              if (codeMessage) {
                return `${fieldLabel}: ${codeMessage}`;
              }
              return `${fieldLabel}: ${fieldError.errorCode || 'required'}`;
            })
            .filter(msg => msg)
            .join('. ');
          
          if (fieldErrors) {
            return fieldErrors;
          }
        }
        
        // Handle generic error messages from API
        if (errorData.error?.message) {
          return errorData.error.message;
        }
        if (errorData.message) {
          return errorData.message;
        }
      }
    } catch (e) {
      // If parsing fails, fall through to default error message
      console.warn('[getErrorMessage] Failed to parse error JSON:', e);
    }
  }

  // Parse status code from error message
  const statusMatch = error.message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    
    switch (status) {
      case 400:
        return 'Invalid information provided. Please check your details and try again.';
      case 401:
        // For login context, show invalid credentials message
        if (context === 'Login') {
          return 'Invalid username or password. Please check your credentials and try again.';
        }
        return 'Your session has expired. Please try again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return `${context} not found. Please try again.`;
      case 409:
        return 'This order already exists. Please check your orders or contact support.';
      case 422:
        return 'Invalid data provided. Please review your information.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'Server error. Please try again in a few moments.';
      default:
        return `An error occurred (${status}). Please try again or contact support.`;
    }
  }

  // Default message
  return error.message || 'An unexpected error occurred. Please try again.';
}
