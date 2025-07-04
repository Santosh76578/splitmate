// Phone number normalization utility
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If it starts with 00, convert to +
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.substring(2);
  }
  
  // If it starts with +, keep as is (international format)
  if (normalized.startsWith('+')) {
    return normalized;
  }
  
  // If it's 10 digits and starts with 6-9, likely Indian local
  if (normalized.length === 10 && /^[6-9]/.test(normalized)) {
    return normalized;
  }
  
  // If it's 12 digits and starts with 91, likely Indian with country code
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return normalized.substring(2);
  }
  
  // If it's 11 digits and starts with 1, likely US with country code
  if (normalized.length === 11 && normalized.startsWith('1')) {
    return normalized.substring(1);
  }
  
  // If it's 10 digits, likely US local
  if (normalized.length === 10) {
    return normalized;
  }
  
  // For other countries, just return the digits (may be 9-13 digits)
  return normalized;
};

// Function to compare phone numbers
export const comparePhoneNumbers = (phone1, phone2) => {
  if (!phone1 || !phone2) return false;
  const n1 = normalizePhoneNumber(phone1);
  const n2 = normalizePhoneNumber(phone2);
  if (n1 === n2) return true;

  // If one is international and the other is local, compare last N digits
  // (N = min length of n1, n2, but at least 7)
  const minLen = Math.max(7, Math.min(n1.length, n2.length));
  if (n1.slice(-minLen) === n2.slice(-minLen)) return true;

  // Try removing leading country codes (1, 91, 44, 49, 61, etc.)
  const stripCountry = s => s.replace(/^\+?(1|91|44|49|61)/, '');
  if (stripCountry(n1) === stripCountry(n2)) return true;

  // Special case: UK and similar numbers, local starts with 0, international drops it
  // Compare after stripping leading 0 from local number
  const stripLeadingZero = s => s.replace(/^0+/, '');
  if (stripCountry(n1) === stripLeadingZero(stripCountry(n2))) return true;
  if (stripCountry(n2) === stripLeadingZero(stripCountry(n1))) return true;

  return false;
};

// Debug function to log phone number details
export const debugPhoneNumbers = (storedPhone, enteredPhone) => {
  // Debug function - no logging in production
};

// Test function to verify phone normalization works correctly
export const testPhoneNormalization = () => {
  const testCases = [
    // US
    { input: '+1 (555) 123-4567', expected: '+15551234567' },
    { input: '1-555-123-4567', expected: '5551234567' },
    { input: '(555) 123-4567', expected: '5551234567' },
    { input: '555-123-4567', expected: '5551234567' },
    { input: '5551234567', expected: '5551234567' },
    // India
    { input: '+91 8455 921 933', expected: '+918455921933' },
    { input: '8455921933', expected: '8455921933' },
    { input: '918455921933', expected: '918455921933' },
    // UK
    { input: '+44 20 7946 0958', expected: '+442079460958' },
    { input: '020 7946 0958', expected: '02079460958' },
    // Germany
    { input: '+49 30 901820', expected: '+4930901820' },
    { input: '030 901820', expected: '030901820' },
    // Australia
    { input: '+61 412 345 678', expected: '+61412345678' },
    { input: '0412 345 678', expected: '0412345678' },
    // General
    { input: '0044 20 7946 0958', expected: '+442079460958' },
    { input: '0049 30 901820', expected: '+4930901820' },
    { input: '0061 412 345 678', expected: '+61412345678' },
  ];
  
  // Test function - no logging in production

  // Comparison tests
  const comparisonTests = [
    // US
    { phone1: '+1 (555) 123-4567', phone2: '555-123-4567', shouldMatch: true },
    // India
    { phone1: '+91 8455 921 933', phone2: '8455921933', shouldMatch: true },
    { phone1: '+91 8455 921 933', phone2: '918455921933', shouldMatch: true },
    // UK
    { phone1: '+44 20 7946 0958', phone2: '020 7946 0958', shouldMatch: true },
    // Germany
    { phone1: '+49 30 901820', phone2: '030 901820', shouldMatch: true },
    // Australia
    { phone1: '+61 412 345 678', phone2: '0412 345 678', shouldMatch: true },
    // General
    { phone1: '+442079460958', phone2: '02079460958', shouldMatch: true },
    { phone1: '+4930901820', phone2: '030901820', shouldMatch: true },
    { phone1: '+61412345678', phone2: '0412345678', shouldMatch: true },
    { phone1: '+61412345678', phone2: '412345678', shouldMatch: true },
    { phone1: '+442079460958', phone2: '2079460958', shouldMatch: true },
    { phone1: '+4930901820', phone2: '30901820', shouldMatch: true },
  ];
  // Test function - no logging in production
}; 