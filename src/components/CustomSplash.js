import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomSplash({ onNavigateToOnboarding }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simple timer - show splash for 1.5 seconds then navigate
    const timer = setTimeout(() => {
      console.log('⏰ Splash screen timeout completed');
      setLoading(false);
      if (typeof onNavigateToOnboarding === 'function') {
        onNavigateToOnboarding();
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [onNavigateToOnboarding]);

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
    >
      <Image source={require('../../assets/Frame.png')} style={styles.logo} />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
}); 