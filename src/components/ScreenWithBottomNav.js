import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import BottomNavigation from './BottomNavigation';

const { width } = Dimensions.get('window');

const ScreenWithBottomNav = ({ children, navigation, activeRoute }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {children}
      </View>
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomLine} />
        <BottomNavigation navigation={navigation} activeRoute={activeRoute} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1F44',
  },
  content: {
    flex: 1,
    marginBottom: 65, // Adjusted for new nav height
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomLine: {
    position: 'absolute',
    bottom: 25,
    width: width * 0.4, // 40% of screen width
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
    opacity: 0.15,
    alignSelf: 'center',
  },
});

export default ScreenWithBottomNav; 