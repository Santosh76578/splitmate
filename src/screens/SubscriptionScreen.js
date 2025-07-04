import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const SubscriptionScreen = () => {
  const navigation = useNavigation();

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Unlock More with{'\n'}SplitMate Premium</Text>

        {/* Features List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Icon name="check-circle" color="#4CAF50" size={24} />
            <Text style={styles.featureText}>Create more than 3 groups</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="check-circle" color="#4CAF50" size={24} />
            <Text style={styles.featureText}>View detailed graphical analytics of group expenses</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="check-circle" color="#4CAF50" size={24} />
            <Text style={styles.featureText}>Get access to the Settle Up feature for seamless balances</Text>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>One time Price</Text>
            <Text style={styles.price}>$0.99</Text>
          </View>
          <View style={styles.divider} />
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.upgradeButton}>
          <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreButton}>
          <Text style={styles.restoreButtonText}>Restore Purchase</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop:20,
    borderBottomLeftRadius:20,
    borderBottomRightRadius:20,
    borderWidth:1
  },
  backButton: {
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 40,
  },
  featuresList: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 15,
    flex: 1,
  },
  priceSection: {
    marginBottom: 40,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  priceLabel: {
    fontSize: 16,
    color: '#FFF',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#FFF',
    opacity: 0.1,
  },
  upgradeButton: {
    backgroundColor: '#FFB800',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  restoreButton: {
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#FFF',
    textDecorationLine: 'underline',
  },
});

export default SubscriptionScreen; 