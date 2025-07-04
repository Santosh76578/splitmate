import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const handleGuestLogin = async () => {
    try {
      setLoading(true);
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      // Store user data in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        email: null,
        isGuest: true
      }));
      
      // Set user state
      setUser(user);
      
      // Show success message
      Alert.alert(
        "Success",
        "Logged in as guest successfully!",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error('Guest login error:', error);
      Alert.alert(
        "Error",
        error.message || "Failed to login as guest"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // Rest of the component code
  );
};

export default Login; 