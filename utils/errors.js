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
        
        // Handle validation errors with details array
        if (errorData.error?.details && Array.isArray(errorData.error.details)) {
          const validationErrors = errorData.error.details
            .map(detail => detail.message || `${detail.field}: ${detail.message}`)
            .join(', ');
          return `Please fix the following: ${validationErrors}`;
        }
        
        // Handle field errors (like customerType)
        if (errorData.error?.details?.fieldErrors && Array.isArray(errorData.error.details.fieldErrors)) {
          const fieldErrors = errorData.error.details.fieldErrors
            .map(fieldError => `${fieldError.field}: ${fieldError.errorCode || 'required'}`)
            .join(', ');
          return `Missing required fields: ${fieldErrors}`;
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
