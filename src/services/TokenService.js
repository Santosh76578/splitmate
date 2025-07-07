import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { API_CONFIG, buildApiUrl } from '../config/apiConfig';

class TokenService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  /**
   * Generate a unique device identifier
   */
  generateDeviceId = async () => {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      
      if (!deviceId) {
        // Generate a unique device ID based on device info
        const deviceInfo = {
          brand: Device.brand,
          manufacturer: Device.manufacturer,
          modelName: Device.modelName,
          osVersion: Device.osVersion,
          platformApiLevel: Device.platformApiLevel,
        };
        
        deviceId = this.hashCode(JSON.stringify(deviceInfo));
        await AsyncStorage.setItem('deviceId', deviceId.toString());
      }
      
      return deviceId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      return 'unknown-device';
    }
  };

  /**
   * Simple hash function to generate device ID
   */
  hashCode = (str) => {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  };

  /**
   * Test the API endpoint to verify connectivity
   */
  testApiConnection = async () => {
    try {
      console.log('🔍 Testing API connection...');
      
      // Try the actual endpoint with a simple GET request
      const response = await fetch(API_CONFIG.BASE_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SplitMate/1.0.0',
        },
      });
      
      console.log('🔍 API connection test response status:', response.status);
      
      // Consider any response (even 404) as "reachable" since the server responded
      const isReachable = response.status < 500;
      console.log('🔍 API is reachable:', isReachable);
      return isReachable;
    } catch (error) {
      console.error('❌ API connection test failed:', error);
      return false;
    }
  };

  /**
   * Generate a fallback token for testing purposes
   */
  generateFallbackToken = () => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    return `fallback_${timestamp}_${randomId}`;
  };

  /**
   * Call the token generation API with retry mechanism
   */
  generateToken = async () => {
    try {
      // Check if we should simulate API failure (for testing)
      if (API_CONFIG.DEVELOPMENT.SIMULATE_API_FAILURE) {
        console.log('🧪 TESTING MODE: Simulating API failure...');
        console.log('🔄 Will show HomeScreen directly (no errors)');
        return null; // Return null cleanly, no errors thrown
      }

      // Check if we should skip API calls (for testing)
      if (API_CONFIG.DEVELOPMENT.SKIP_API_CALLS) {
        console.log('Skipping API calls (development mode)');
        return API_CONFIG.DEVELOPMENT.ENABLE_FALLBACK_TOKEN ? this.generateFallbackToken() : null;
      }

      const now = new Date().toISOString();
      console.log('🚀 Making token API call with date:', now);
      console.log('🔗 API URL:', buildApiUrl(API_CONFIG.GENERATE_TOKEN));
      console.log('📋 Request headers:', { 'x-app-id': '6747886719' });
      console.log('📋 Request body:', { date: now });

      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(buildApiUrl(API_CONFIG.GENERATE_TOKEN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-app-id': '6747886719',
        },
        body: JSON.stringify({ date: now }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📊 === API RESPONSE DEBUG ===');
      console.log('✅ Response status:', response.status);
      console.log('✅ Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('✅ Full response data:', JSON.stringify(responseData, null, 2));

      const token = responseData?.token;
      console.log('🔍 Token extraction:');
      console.log('  - responseData:', responseData);
      console.log('  - responseData?.token:', token);
      console.log('  - Token type:', typeof token);
      console.log('  - Token length:', token ? token.length : 'N/A');
      console.log('  - Is valid token?', !!(token && typeof token === 'string' && token.trim() !== ''));

      // Store the token for later use
      if (token) {
        try {
          await AsyncStorage.setItem('apiToken', token);
          // Don't store null for tokenExpiry, just remove it if it exists
          await AsyncStorage.removeItem('tokenExpiry');
        } catch (storageError) {
          console.log('⚠️ AsyncStorage error (non-critical):', storageError.message);
          // Continue even if storage fails
        }
      }

      return token || null;
    } catch (error) {
      // Only log to console, no alerts or popups
      console.log('❌ === API ERROR DEBUG ===');
      console.log('❌ Error message:', error.message);
      console.log('❌ Error type:', error.constructor.name);
      console.log('🔄 Will show HomeScreen directly (no errors)');
      return null; // Always return null on error, never throw
    }
  };

  /**
   * Get stored token
   */
  getStoredToken = async () => {
    try {
      const token = await AsyncStorage.getItem('apiToken');
      const expiry = await AsyncStorage.getItem('tokenExpiry');
      
      // Check if token is expired
      if (expiry && new Date(expiry) < new Date()) {
        await this.clearToken();
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  };

  /**
   * Clear stored token
   */
  clearToken = async () => {
    try {
      await AsyncStorage.removeItem('apiToken');
      await AsyncStorage.removeItem('tokenExpiry');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  };

  /**
   * Validate token with server
   */
  validateToken = async (token) => {
    try {
      const response = await fetch(buildApiUrl(API_CONFIG.VALIDATE_TOKEN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  };
}

export default new TokenService(); 