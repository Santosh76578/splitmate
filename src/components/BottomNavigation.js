import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import AddOptionsModal from './AddOptionsModal';

const { width } = Dimensions.get('window');

const BottomNavigation = ({ navigation, activeRoute }) => {
  const [showAddOptions, setShowAddOptions] = useState(false);

  const tabs = [
    { key: 'home', label: 'HOME', icon: 'home-outline' },
    { key: 'groups', label: 'GROUPS', icon: 'account-group-outline' },
    { key: 'add', label: '', icon: 'plus' },
    { key: 'expense', label: 'EXPENSE', icon: 'currency-usd' },
    { key: 'profile', label: 'PROFILE', icon: 'account-outline' },
  ];

  const handlePress = (route) => {
    if (route === 'add') {
      setShowAddOptions(true);
      return;
    }
    navigation.navigate(route);
  };

  return (
    <View style={styles.container}>
      <View style={styles.plusButtonContainer}>
        <LinearGradient
          colors={['#5850EC', '#4338CA']}
          style={styles.plusButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.centerButton}
            onPress={() => setShowAddOptions(true)}
          >
            <Icon
              name="plus"
              size={38}
              color="#fff"
              style={styles.plusIcon}
            />
          </TouchableOpacity>
        </LinearGradient>
      </View>
      <LinearGradient
        colors={['#1E3A8A', '#1E3A8A']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.tabsContainer}>
          <View style={styles.tabSection}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handlePress('home')}
            >
              <Icon
                name="home-outline"
                size={26}
                color={activeRoute === 'home' ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[
                styles.label,
                { color: activeRoute === 'home' ? '#fff' : 'rgba(255,255,255,0.5)' }
              ]}>
                HOME
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handlePress('Groups')}
            >
              <Icon
                name="account-group-outline"
                size={26}
                color={activeRoute === 'groups' ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[
                styles.label,
                { color: activeRoute === 'groups' ? '#fff' : 'rgba(255,255,255,0.5)' }
              ]}>
                GROUPS
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.centerSpace} />
          <View style={styles.tabSection}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handlePress('expense')}
            >
              <Icon
                name="currency-usd"
                size={26}
                color={activeRoute === 'expense' ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[
                styles.label,
                { color: activeRoute === 'expense' ? '#fff' : 'rgba(255,255,255,0.5)' }
              ]}>
                EXPENSE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => handlePress('profile')}
            >
              <Icon
                name="account-outline"
                size={26}
                color={activeRoute === 'profile' ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[
                styles.label,
                { color: activeRoute === 'profile' ? '#fff' : 'rgba(255,255,255,0.5)' }
              ]}>
                PROFILE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <AddOptionsModal
        visible={showAddOptions}
        onClose={() => setShowAddOptions(false)}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: 85,
    position: 'relative',
  },
  plusButtonContainer: {
    position: 'absolute',
    top: -25,
    left: '50%',
    marginLeft: -35,
    zIndex: 2,
    width: 70,
    height: 70,
    borderRadius: 35,
    shadowColor: '#5850EC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  plusButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  gradient: {
    flex: 1,
    paddingBottom: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  tabSection: {
    flexDirection: 'row',
    width: '40%',
    justifyContent: 'space-between',
  },
  centerSpace: {
    width: '20%',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    marginTop: -2,
  },
  label: {
    fontSize: 10,
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

});

export default BottomNavigation; 