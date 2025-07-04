import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomSplash() {
  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
    >
      <Image source={require('../../assets/Frame.png')} style={styles.logo} />
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
    width: 0,
    height: 80,
    resizeMode: 'contain',
  },
}); 