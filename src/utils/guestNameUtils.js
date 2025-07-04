import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Cache for guest names to prevent unnecessary assignments
const guestNameCache = new Map();

/**
 * Generates a unique guest name using UID or random string
 * @param {string} userId - The user's UID
 * @returns {Promise<string>} The generated guest name
 */
export const generateGuestName = async (userId = '') => {
  try {
    let suffix = '';
    if (userId && typeof userId === 'string') {
      suffix = userId.slice(-4).toUpperCase();
    } else {
      // fallback: random 4-digit hex
      suffix = Math.random().toString(16).substr(2, 4).toUpperCase();
    }
    return `guest-${suffix}`;
  } catch (error) {
    console.error('Error generating guest name:', error);
    // Fallback to timestamp-based name if all else fails
    const timestamp = Date.now();
    return `guest-${timestamp}`;
  }
};

/**
 * Assigns a default guest name to a user if they don't have one
 * @param {string} userId - The user's UID
 * @param {Object} userData - Current user data
 * @returns {Promise<string>} The assigned guest name
 */
export const assignDefaultGuestName = async (userId, userData = {}) => {
  try {
    // Check cache first
    if (guestNameCache.has(userId)) {
      return guestNameCache.get(userId);
    }

    // Check if user already has a display name
    if (userData.displayName && userData.displayName.trim() !== '') {
      guestNameCache.set(userId, userData.displayName);
      return userData.displayName;
    }

    // Check if there's a stored name in AsyncStorage
    const storedName = await AsyncStorage.getItem('userName');
    if (storedName && storedName.trim() !== '') {
      guestNameCache.set(userId, storedName);
      return storedName;
    }

    // Generate a new guest name with unique suffix
    const guestName = await generateGuestName(userId);
    
    // Store the name in AsyncStorage
    await AsyncStorage.setItem('userName', guestName);
    
    // Update the user document in Firestore if userId is provided
    if (userId) {
      try {
        await setDoc(doc(db, 'users', userId), {
          displayName: guestName,
          isGuest: true,
          isAnonymous: true,
          updatedAt: new Date(),
        }, { merge: true });
      } catch (firestoreError) {
        console.error('Error updating Firestore with guest name:', firestoreError);
      }
    }
    
    // Cache the result
    guestNameCache.set(userId, guestName);
    return guestName;
  } catch (error) {
    console.error('Error assigning default guest name:', error);
    return 'guest';
  }
};

/**
 * Checks if a user needs a default guest name and assigns one if needed
 * @param {Object} user - The user object from auth context
 * @returns {Promise<string>} The user's display name (either existing or newly assigned)
 */
export const ensureGuestName = async (user) => {
  try {
    // If user is not anonymous, return their existing display name
    if (!user?.isAnonymous) {
      return user?.displayName || 'User';
    }

    // Check cache first
    if (user?.uid && guestNameCache.has(user.uid)) {
      return guestNameCache.get(user.uid);
    }

    const currentName = user?.displayName || await AsyncStorage.getItem('userName');
    
    if (!currentName || currentName.trim() === '') {
      const assignedName = await assignDefaultGuestName(user?.uid, user);
      return assignedName;
    }
    
    // Cache the result
    if (user?.uid) {
      guestNameCache.set(user.uid, currentName);
    }
    
    return currentName;
  } catch (error) {
    console.error('Error ensuring guest name:', error);
    return 'guest';
  }
};

/**
 * Resets the guest counter (useful for testing or cleanup)
 */
export const resetGuestCounter = async () => {
  try {
    await AsyncStorage.removeItem('guestCounter');
  } catch (error) {
    console.error('Error resetting guest counter:', error);
  }
};

/**
 * Gets the current guest counter value
 * @returns {Promise<number>} The current guest counter
 */
export const getGuestCounter = async () => {
  try {
    return parseInt(await AsyncStorage.getItem('guestCounter') || '0');
  } catch (error) {
    console.error('Error getting guest counter:', error);
    return 0;
  }
};

// Clear cache when needed (e.g., on logout)
export const clearGuestNameCache = () => {
  guestNameCache.clear();
};

// Get cached name for a user
export const getCachedGuestName = (userId) => {
  return guestNameCache.get(userId);
}; 