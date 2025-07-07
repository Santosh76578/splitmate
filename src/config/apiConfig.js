// API Configuration
export const API_CONFIG = {
  // PLUDO Boost API base URL
  BASE_URL: 'https://api.pludoboost-app.info',
  
  // Token generation endpoint
  GENERATE_TOKEN: '/plant',
  
  // Token validation endpoint
  VALIDATE_TOKEN: '/validate-token',
  
  // WebView configuration - Terms of Use page
  WEBVIEW: {
    // PLUDO Boost Terms of Use page
    BASE_URL: 'https://pludoboost-app.info/termsofuse/',
    
    // Query parameters to include in webview URL
    DEFAULT_PARAMS: {
      platform: 'mobile',
      app: 'splitmate',
      appId: '6748014578',
    },
  },
  
  // Request timeout in milliseconds
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // milliseconds
  },
  
  // Development/Testing options
  DEVELOPMENT: {
    // Enable fallback token when API is not available (for testing)
    ENABLE_FALLBACK_TOKEN: true,
    
    // Skip API calls entirely (for testing)
    SKIP_API_CALLS: false,
    
    // Simulate API failure for testing
    SIMULATE_API_FAILURE: false,
    
    // Skip WebView and go directly to onboarding (for testing)
    SKIP_WEBVIEW: false,
  },
};

// Helper function to build webview URL with token
export const buildWebViewUrl = (token, additionalParams = {}) => {
  const url = new URL(API_CONFIG.WEBVIEW.BASE_URL);
  
  // Add token
  url.searchParams.set('token', token);
  
  // Add default parameters
  Object.entries(API_CONFIG.WEBVIEW.DEFAULT_PARAMS).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  // Add additional parameters
  Object.entries(additionalParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  return url.toString();
};

// Helper function to build API URL
export const buildApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 