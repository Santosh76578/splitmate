import axios from 'axios';

export const getToken = async () => {
  try {
    console.log('🔗 Calling PLUDO Boost API for token...');
    const now = new Date().toISOString();
    
    const response = await axios.post(
      'https://api.pludoboost-app.info/plant',
      { date: now },
      { 
        headers: { 'x-app-id': '6748014578' }, 
        timeout: 10000 
      }
    );
    
    console.log('✅ API response received:', response.status);
    const token = response.data?.token || null;
    console.log('🔑 Token extracted:', token ? 'Valid token' : 'No token');
    
    return token;
  } catch (error) {
    console.log('❌ Token fetch failed:', error.message);
    return null;
  }
}; 