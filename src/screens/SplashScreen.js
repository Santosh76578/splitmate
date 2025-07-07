import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/api';
import { useAuth } from '../context/AuthContext'; // adjust path as needed

export default function SplashScreen({ navigation }) {
  const { user } = useAuth();

  useEffect(() => {
    const initialise = async () => {
      try {
        console.log('🚀 Starting splash screen initialization...');
        
        // Check persistent flag for WebView completion
        const hasAcceptedTerms = await AsyncStorage.getItem('hasAcceptedTerms');
        if (hasAcceptedTerms === 'true') {
          console.log('✅ Terms already accepted, following normal app flow');
          const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
          if (onboardingCompleted === 'true') {
            if (user) {
              console.log('➡️ User is logged in, navigating to MainTabs');
              navigation.replace('MainTabs');
            } else {
              console.log('➡️ User not logged in, navigating to AuthNavigator');
              navigation.replace('AuthNavigator');
            }
            return;
          } else {
            console.log('➡️ Navigating to Onboarding');
            navigation.replace('Onboarding');
            return;
          }
        }
        
        // Call getToken API only if WebView wasn't completed
        const token = await getToken();
        console.log('🔑 Token result:', token ? 'Valid token received' : 'No token (null)');
        
        if (token) {
          console.log('🌐 Token valid, navigating to WebView...');
          navigation.replace('WebView');
        } else {
          console.log('➡️ No token, following normal app flow');
          // No token - follow normal app flow
          if (onboardingCompleted === 'true') {
            if (user) {
              navigation.replace('MainTabs');
            } else {
              navigation.replace('AuthNavigator');
            }
          } else {
            navigation.replace('Onboarding');
          }
        }
      } catch (error) {
        console.error('❌ Error in splash screen initialization:', error);
        // On any error, let the app handle the flow
        navigation.replace('AuthNavigator');
      }
    };

    // Add a small delay to show the splash screen
    const timer = setTimeout(initialise, 1500);
    return () => clearTimeout(timer);
  }, [navigation, user]);

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>SplitMate</Text>
        <Text style={styles.subtitle}>Launching App...</Text>
        <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
        <Text style={styles.debugText}>Checking token...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 20,
    opacity: 0.8,
  },
  loader: {
    marginTop: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    marginTop: 20,
  },
}); 