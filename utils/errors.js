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

// Field-level error codes (INVALID_INPUT.fieldErrors[].errorCode)
const ERROR_CODE_MESSAGES = {
  'PHONENUMBER_INVALID': 'Please enter a valid phone number',
  'PHONENUMBER_REQUIRED': 'Phone number is required',
  'DATE_AGE_TOO_YOUNG': (minAge) => `Age must be at least ${minAge} years old`,
  'DATE_AGE_TOO_OLD': (maxAge) => `Age must be no more than ${maxAge} years old`,
  'DATE_INVALID': 'Please enter a valid date',
  'DATE_REQUIRED': 'Date of birth is required',
  'EMAIL_INVALID': 'Please enter a valid email address',
  'EMAIL_REQUIRED': 'Email is required',
  'STRING_TOO_LONG': (fieldError) => {
    const minV = fieldError?.minValue ?? fieldError?.mixValue;
    const maxV = fieldError?.maxValue;
    if (minV != null && maxV != null) {
      return `Use between ${minV} and ${maxV} characters`;
    }
    if (maxV != null) {
      return `Use at most ${maxV} characters`;
    }
    return 'That value is too long';
  },
  'STRING_TOO_SHORT': (fieldError) => {
    const minV = fieldError?.minValue ?? fieldError?.mixValue;
    if (minV != null) {
      return `Use at least ${minV} characters`;
    }
    return 'That value is too short';
  },
  'REQUIRED': 'This field is required',
  'INVALID': 'Invalid value provided',
  'FIELD_MANDATORY': 'This field is required',
  'FIELD_EMPTY': 'This field cannot be empty',
  'PASSWORD_INVALID': 'Please choose a valid password',
  'INCORRECT_PASSOWRD': 'Incorrect password',
};

/**
 * Top-level BRP API errorCode → short customer-facing message.
 * @see docs/brp-api3-openapi.yaml (error codes table)
 */
const BRP_TOP_LEVEL_MESSAGES = {
  EMAIL_ALREADY_EXISTS: 'This email is already registered. Try logging in or use reset password.',
  EMAIL_ALREADY_EXISTS_NAME: (data) => {
    const name = data?.fullName;
    return name
      ? `This email is already in use (account: ${name}). Try logging in or contact us if that is not you.`
      : 'This email is already registered. Try logging in or use reset password.';
  },
  EMAIL_BLOCKED: 'This email cannot be used. Please contact the gym for help.',
  PRODUCT_NOT_ALLOWED: 'This offer is not available for your account right now.',
  COUPON_NOT_APPLICABLE: 'This code does not apply to your current order.',
  COUPON_NOT_FOUND_ON_ORDER: 'That discount code was not found.',
  COUPON_INVALID_TIME: 'This code is not valid for the dates of your order.',
  COUPON_AFTER_VALUE_CARD_RESERVATION: 'This code cannot be used after a punch card step in your order.',
  CUSTOMER_SUSPENDED: 'Your membership account is suspended. Please contact the gym.',
  ID_NOT_FOUND: 'We could not find that record. Refresh the page or try again.',
  INSUFFICIENT_RIGHTS: 'You are not allowed to do that. Log in again or contact the gym.',
  INVALID_INPUT: 'Please check the highlighted fields and try again.',
  PAYMENT_FAILED: 'Payment could not be completed. Try again or use another payment method.',
  ORDER_DELETE_NOT_ALLOWED: 'This order cannot be changed anymore.',
  FUNCTIONALITY_DISABLED: 'That action is not available at the moment. Please try again later.',
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
  if (codeUpper === 'STRING_TOO_LONG' && typeof ERROR_CODE_MESSAGES[codeUpper] === 'function') {
    return ERROR_CODE_MESSAGES[codeUpper](fieldError);
  }
  if (codeUpper === 'STRING_TOO_SHORT' && typeof ERROR_CODE_MESSAGES[codeUpper] === 'function') {
    return ERROR_CODE_MESSAGES[codeUpper](fieldError);
  }

  // Direct mapping
  if (ERROR_CODE_MESSAGES[codeUpper]) {
    const entry = ERROR_CODE_MESSAGES[codeUpper];
    return typeof entry === 'function' ? entry(fieldError) : entry;
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

/** Parsed JSON body from failed fetch (see utils/apiRequest.js — errors include `payload`). */
function extractApiErrorPayload(error) {
  if (!error) return null;
  if (error.payload != null && typeof error.payload === 'object' && !Array.isArray(error.payload)) {
    return error.payload;
  }
  if (typeof error.payload === 'string') {
    try {
      const p = JSON.parse(error.payload);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

function tryParseErrorJsonFromMessage(message) {
  if (!message || typeof message !== 'string') return null;
  try {
    const trimmed = message.trim();
    if (trimmed.startsWith('{')) {
      const p = JSON.parse(trimmed);
      if (p && typeof p === 'object') return p;
    }
  } catch (_) {
    /* ignore */
  }
  let jsonMatch = message.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    jsonMatch = message.match(/-\s*(\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonMatch = [jsonMatch[1]];
    }
  }
  if (!jsonMatch) return null;
  try {
    const p = JSON.parse(jsonMatch[0]);
    if (p && typeof p === 'object') return p;
  } catch (_) {
    /* ignore */
  }
  return null;
}

/** Native BRP body: { errorCode, fieldErrors?, message?, ... } */
function formatTopLevelBrpError(errorData) {
  if (!errorData || typeof errorData !== 'object') return null;
  const rawCode = errorData.errorCode ?? errorData.error_code;
  if (!rawCode || typeof rawCode !== 'string') return null;
  const codeUpper = rawCode.toUpperCase();

  if (codeUpper === 'INVALID_INPUT' && Array.isArray(errorData.fieldErrors) && errorData.fieldErrors.length > 0) {
    const fieldErrorMessages = errorData.fieldErrors
      .map((fieldError) => {
        const fieldLabel = getFieldLabel(fieldError.field);
        const codeMessage = getErrorCodeMessage(fieldError.errorCode, fieldError);
        if (codeMessage) {
          return `${fieldLabel}: ${codeMessage}`;
        }
        return `${fieldLabel}: Please check this field`;
      })
      .filter(Boolean)
      .join('. ');
    return fieldErrorMessages || BRP_TOP_LEVEL_MESSAGES.INVALID_INPUT;
  }

  const mapped = BRP_TOP_LEVEL_MESSAGES[codeUpper];
  if (typeof mapped === 'function') {
    return mapped(errorData);
  }
  if (typeof mapped === 'string') {
    return mapped;
  }

  if (codeUpper === 'ADDON_FEATURE' && typeof errorData.message === 'string' && errorData.message.trim()) {
    return errorData.message.trim();
  }

  return null;
}

// Extract field information from error data for highlighting
export function extractErrorFields(error) {
  const fields = [];

  if (!error) {
    return fields;
  }

  const payloadObj = extractApiErrorPayload(error);
  if (payloadObj?.fieldErrors && Array.isArray(payloadObj.fieldErrors)) {
    const code = String(payloadObj.errorCode || '').toUpperCase();
    if (!code || code === 'INVALID_INPUT') {
      payloadObj.fieldErrors.forEach((fieldError) => {
        if (fieldError.field) {
          const fieldId = getFieldId(fieldError.field);
          if (fieldId && !fields.find((f) => f.fieldId === fieldId)) {
            fields.push({ fieldId, field: fieldError.field, errorCode: fieldError.errorCode });
          }
        }
      });
    }
  }

  if (!error.message) {
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

/** Prefer this over matching the first 3-digit number in a message (e.g. "120 seconds" vs 429). */
function extractHttpStatusFromMessage(message) {
  if (!message || typeof message !== 'string') return null;
  const patterns = [
    /\bHTTP error!\s*status:\s*(\d{3})\b/i,
    /\bLogin failed:\s*(\d{3})\b/,
    /\bstatus:\s*(\d{3})\b/i,
  ];
  for (const re of patterns) {
    const m = message.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// Helper function to get user-friendly error messages
export function getErrorMessage(error, context = 'operation') {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  const msg = error.message || '';

  // Network errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.status === 429 || error.isRateLimit) {
    return msg.includes('Rate limit exceeded') || msg.includes('wait')
      ? msg
      : 'Too many requests. Please wait a moment before trying again.';
  }

  const msgLower = msg.toLowerCase();
  if (
    msgLower.includes('rate limit') ||
    msgLower.includes('too many requests') ||
    msgLower.includes('too many login')
  ) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  if (
    context === 'Login' &&
    error.status === 401 &&
    error.payload &&
    typeof error.payload === 'object'
  ) {
    const payloadStr = JSON.stringify(error.payload).toLowerCase();
    if (
      payloadStr.includes('rate') ||
      payloadStr.includes('too many') ||
      payloadStr.includes('throttle') ||
      payloadStr.includes('429')
    ) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
  }

  const resolvedStatusEarly =
    typeof error.status === 'number' && Number.isFinite(error.status)
      ? error.status
      : extractHttpStatusFromMessage(msg);

  const mayHaveJsonBody =
    extractApiErrorPayload(error) != null ||
    resolvedStatusEarly != null ||
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('409') ||
    msg.includes('422');

  const errorData =
    extractApiErrorPayload(error) ||
    (mayHaveJsonBody ? tryParseErrorJsonFromMessage(msg) : null);

  if (errorData) {
    try {
      const topBrp = formatTopLevelBrpError(errorData);
      if (topBrp) {
        return topBrp;
      }

      // Handle 401 errors with specific error codes (like INVALID_CREDENTIALS)
      if (errorData.code === 'INVALID_CREDENTIALS' || errorData.error?.code === 'INVALID_CREDENTIALS') {
        return errorData.message || errorData.error?.message || 'Invalid username or password';
      }

      // Handle VALIDATION_ERROR with details array (e.g., username validation)
      if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error?.details && Array.isArray(errorData.error.details)) {
        const validationMessages = errorData.error.details
          .map((detail) => {
            const fieldLabel = getFieldLabel(detail.field);
            if (detail.message) {
              return detail.message;
            }
            return `${fieldLabel} is invalid`;
          })
          .filter((m) => m)
          .join('. ');

        if (validationMessages) {
          return validationMessages;
        }
      }

      // Handle EXTERNAL_API_ERROR with fieldErrors in details (e.g., phone number, birth date)
      if (errorData.error?.code === 'EXTERNAL_API_ERROR' && errorData.error?.details) {
        const details = errorData.error.details;

        if (details.fieldErrors && Array.isArray(details.fieldErrors) && details.fieldErrors.length > 0) {
          const fieldErrorMessages = details.fieldErrors
            .map((fieldError) => {
              const fieldLabel = getFieldLabel(fieldError.field);
              const errorCode = fieldError.errorCode;

              const codeMessage = getErrorCodeMessage(errorCode, fieldError);
              if (codeMessage) {
                return `${fieldLabel}: ${codeMessage}`;
              }

              return `${fieldLabel}: ${errorCode || 'Invalid value'}`;
            })
            .filter((m) => m)
            .join('. ');

          if (fieldErrorMessages) {
            return fieldErrorMessages;
          }
        }
      }

      // Handle validation errors with details array (generic fallback)
      if (errorData.error?.details && Array.isArray(errorData.error.details)) {
        const validationErrors = errorData.error.details
          .map((detail) => {
            const fieldLabel = getFieldLabel(detail.field);
            if (detail.message) {
              return `${fieldLabel}: ${detail.message}`;
            }
            return `${fieldLabel} is invalid`;
          })
          .filter((m) => m)
          .join('. ');

        if (validationErrors) {
          return validationErrors;
        }
      }

      // Handle field errors (like customerType) - legacy format
      if (errorData.error?.details?.fieldErrors && Array.isArray(errorData.error.details.fieldErrors)) {
        const fieldErrors = errorData.error.details.fieldErrors
          .map((fieldError) => {
            const fieldLabel = getFieldLabel(fieldError.field);
            const codeMessage = getErrorCodeMessage(fieldError.errorCode, fieldError);
            if (codeMessage) {
              return `${fieldLabel}: ${codeMessage}`;
            }
            return `${fieldLabel}: ${fieldError.errorCode || 'required'}`;
          })
          .filter((m) => m)
          .join('. ');

        if (fieldErrors) {
          return fieldErrors;
        }
      }

      // Handle generic error messages from API
      if (errorData.error?.message) {
        return errorData.error.message;
      }
      if (errorData.message && !errorData.errorCode) {
        return errorData.message;
      }
    } catch (e) {
      console.warn('[getErrorMessage] Failed to parse error JSON:', e);
    }
  }

  const resolvedStatus =
    typeof error.status === 'number' && Number.isFinite(error.status)
      ? error.status
      : extractHttpStatusFromMessage(msg);

  if (resolvedStatus != null) {
    const status = resolvedStatus;

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
  return msg || 'An unexpected error occurred. Please try again.';
}
