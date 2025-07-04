import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Check if a group exists and is accessible by the current user
 * @param {string} groupId - The group ID to check
 * @param {string} userId - The current user's ID
 * @param {boolean} isGuest - Whether the user is a guest user
 * @returns {Promise<{exists: boolean, accessible: boolean, groupData: object|null, error: string|null}>}
 */
export const validateGroupAccess = async (groupId, userId, isGuest = false) => {
  try {
    if (!groupId || !userId) {
      return {
        exists: false,
        accessible: false,
        groupData: null,
        error: 'Invalid group ID or user ID'
      };
    }

    if (isGuest) {
      // For guest users, check both AsyncStorage and Firestore
      const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
      const localGroup = guestGroups.find(g => g.id === groupId);
      
      if (localGroup) {
        return {
          exists: true,
          accessible: true,
          groupData: localGroup,
          error: null
        };
      }

      // Check Firestore for groups where guest user is a member
      try {
        const groupDocRef = doc(db, 'groups', groupId);
        const groupDocSnap = await getDoc(groupDocRef);
        
        if (groupDocSnap.exists()) {
          const groupData = groupDocSnap.data();
          const isMember = groupData.memberIds && groupData.memberIds.includes(userId);
          
          if (isMember) {
            return {
              exists: true,
              accessible: true,
              groupData: {
                ...groupData,
                id: groupDocSnap.id
              },
              error: null
            };
          } else {
            return {
              exists: true,
              accessible: false,
              groupData: null,
              error: 'You are not a member of this group'
            };
          }
        } else {
          return {
            exists: false,
            accessible: false,
            groupData: null,
            error: 'Group does not exist'
          };
        }
      } catch (firestoreError) {
        console.error('Error checking Firestore for guest group:', firestoreError);
        return {
          exists: false,
          accessible: false,
          groupData: null,
          error: 'Error checking group access'
        };
      }
    } else {
      // For regular users, check Firestore
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupDocRef);
      
      if (groupDocSnap.exists()) {
        const groupData = groupDocSnap.data();
        
        // Check if user is a member or creator
        const isMember = groupData.memberIds && groupData.memberIds.includes(userId);
        const isCreator = groupData.createdBy && groupData.createdBy.id === userId;
        
        if (isMember || isCreator) {
          return {
            exists: true,
            accessible: true,
            groupData: {
              ...groupData,
              id: groupDocSnap.id
            },
            error: null
          };
        } else {
          return {
            exists: true,
            accessible: false,
            groupData: null,
            error: 'You are not a member of this group'
          };
        }
      } else {
        return {
          exists: false,
          accessible: false,
          groupData: null,
          error: 'Group does not exist'
        };
      }
    }
  } catch (error) {
    console.error('Error validating group access:', error);
    return {
      exists: false,
      accessible: false,
      groupData: null,
      error: 'Error checking group access'
    };
  }
};

/**
 * Check if a group exists (without access validation)
 * @param {string} groupId - The group ID to check
 * @param {boolean} isGuest - Whether the user is a guest user
 * @returns {Promise<boolean>}
 */
export const checkGroupExists = async (groupId, isGuest = false) => {
  try {
    if (!groupId) {
      return false;
    }

    if (isGuest) {
      // Check AsyncStorage first
      const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
      const localGroup = guestGroups.find(g => g.id === groupId);
      
      if (localGroup) {
        return true;
      }

      // Check Firestore
      try {
        const groupDocRef = doc(db, 'groups', groupId);
        const groupDocSnap = await getDoc(groupDocRef);
        return groupDocSnap.exists();
      } catch (error) {
        console.error('Error checking Firestore for group existence:', error);
        return false;
      }
    } else {
      // Check Firestore for regular users
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupDocRef);
      return groupDocSnap.exists();
    }
  } catch (error) {
    console.error('Error checking group existence:', error);
    return false;
  }
}; 