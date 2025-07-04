import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  linkWithCredential
} from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ensureGuestName, assignDefaultGuestName, clearGuestNameCache } from '../utils/guestNameUtils';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const updateUserState = async (updatedData) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const updatedUser = {
        ...user,
        ...updatedData,
      };

      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user state:', error);
    }
  };

  const restoreSession = async () => {
    try {
      setIsRestoring(true);
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle auth state changes
  useEffect(() => {
    let unsubscribe;
    setLoading(true); // Start loading immediately

    const setupAuth = async () => {
      try {
        await restoreSession();
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            // Get stored user data
            const storedName = await AsyncStorage.getItem('userName');
            const storedAvatar = await AsyncStorage.getItem('userAvatar');
            
            // Fetch additional user info from Firestore first
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            let userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: storedName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
              photoURL: null,
              isAnonymous: firebaseUser.isAnonymous
            };

            if (userDoc.exists()) {
              const userInfo = userDoc.data();
              Object.assign(userData, userInfo); // Merge ALL Firestore fields, including role
              // Always prefer the email from Firebase Auth
              if (firebaseUser.email) {
                userData.email = firebaseUser.email;
              }
              await AsyncStorage.setItem('userPhone', userData.phone || '');
            } else {
              userData.photoURL = firebaseUser.photoURL || storedAvatar;
            }

            // For anonymous users, ensure they have a default guest name
            // Only assign if no display name exists
            if (firebaseUser.isAnonymous && (!userData.displayName || userData.displayName.trim() === '')) {
              userData.displayName = await ensureGuestName(userData);
            }

            // If we have a photoURL, ensure it's stored in AsyncStorage
            if (userData.photoURL) {
              await AsyncStorage.setItem('userAvatar', userData.photoURL);
            }

            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
          } else {
            // Only clear user if not restoring and not loading
            await AsyncStorage.removeItem('user');
            setUser(null);
          }
          setLoading(false); // Only set loading false after auth state is known
        });
      } catch (error) {
        setLoading(false);
      }
    };

    setupAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground
        if (!user) {
          await restoreSession();
        }
      } else if (nextAppState === 'background') {
        // App went to background
        if (user) {
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  const login = async (email, password) => {
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      
      // Get stored user data
      const storedName = await AsyncStorage.getItem('userName');
      const storedAvatar = await AsyncStorage.getItem('userAvatar');
      
      const userData = {
        uid: response.user.uid,
        email: response.user.email,
        displayName: storedName || response.user.displayName || email.split('@')[0],
        photoURL: storedAvatar || response.user.photoURL,
        isAnonymous: response.user.isAnonymous
      };
      
      // Fetch additional user info from Firestore and merge all fields
      const userDoc = await getDoc(doc(db, 'users', response.user.uid));
      if (userDoc.exists()) {
        const userInfo = userDoc.data();
        Object.assign(userData, userInfo);
      }
      // Ensure joinedViaInvite is properly set
      userData.joinedViaInvite = userData.joinedViaInvite || false;
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      // Return the specific Firebase error code
      return { 
        success: false, 
        error: error.code || error.message 
      };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // Clear guest name cache
      clearGuestNameCache();
      // Only remove user/guest-related data, not onboardingCompleted or global keys
      await AsyncStorage.multiRemove([
        'user',
        'userName',
        'userAvatar',
        'userPhone',
        'guestGroups',
        'guestExpenses',
        'guestActivities',
        'guestSettlements',
        'userGroups',
        'userExpenses',
        'userActivities',
        'userSettlements'
      ]);
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const signup = async (email, password) => {
    try {
      let userCredential;
      let joinedViaInvite = false;
      let isGuestUpgrade = false;
      
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        // Upgrade anonymous user
        isGuestUpgrade = true;
        const credential = EmailAuthProvider.credential(email, password);
        userCredential = await linkWithCredential(auth.currentUser, credential);
        // Check guest user doc for joinedViaInvite
        const guestDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (guestDoc.exists()) {
          joinedViaInvite = guestDoc.data().joinedViaInvite || false;
        }
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
      };

      // For guest upgrades, the migration will be handled in SignupScreen
      if (!isGuestUpgrade) {
        // Create or update user document in Firestore with member role
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          displayName: userCredential.user.displayName,
          role: 'member',
          groups: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true,
          hasFullAccess: true,
          permissions: {
            canAddExpenses: true,
            canViewExpenses: true,
            canEditExpenses: true,
            canDeleteExpenses: true,
            canAddMembers: true,
            canRemoveMembers: true,
            canViewAnalytics: true,
            canViewSettlements: true,
            canCreateSettlements: true,
          },
          joinedViaInvite: joinedViaInvite
        }, { merge: true });

        // Fetch the user document to get all fields and merge
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userInfo = userDoc.data();
          Object.assign(userData, userInfo);
        }
      }

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  };

  const guestLogin = async () => {
    try {
      // Only remove guest-related data before creating new guest session
      await AsyncStorage.multiRemove([
        'user',
        'userName',
        'userAvatar',
        'userPhone',
        'guestGroups',
        'guestExpenses',
        'guestActivities',
        'guestSettlements',
        'userGroups',
        'userExpenses',
        'userActivities',
        'userSettlements'
      ]);
      const userCredential = await signInAnonymously(auth);
      
      // Assign a default guest name using the utility function
      const guestName = await assignDefaultGuestName(userCredential.user.uid, {
        isAnonymous: true
      });
      
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: guestName,
        photoURL: userCredential.user.photoURL,
        isAnonymous: true
      };
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Guest login error:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteAccount = async (password) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        password
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Clear all user data from AsyncStorage
      await AsyncStorage.clear();

      // Delete the user account
      await deleteUser(currentUser);
      setUser(null);
      
      return { success: true };
    } catch (error) {
      console.error('Delete account error:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    signup,
    resetPassword,
    guestLogin,
    deleteAccount,
    updateUserState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 