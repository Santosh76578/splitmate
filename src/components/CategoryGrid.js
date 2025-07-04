import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const categories = [
  { id: 1, name: 'Food', image: require('../../assets/category/Food.png') },
  { id: 2, name: 'Drinks', image: require('../../assets/category/Drinks.png') },
  { id: 3, name: 'Trip', image: require('../../assets/category/trip.png') },
  { id: 4, name: 'Party', image: require('../../assets/category/party.png') },
  { id: 5, name: 'Groccery', image: require('../../assets/category/grocery.png') },
  { id: 6, name: 'Gift', image: require('../../assets/category/Gift.png') },
  { id: 7, name: 'Entertainment', image: require('../../assets/category/Entertainment.png') },
  { id: 8, name: 'Office', image: require('../../assets/category/Office.png') },
  { id: 9, name: 'Booking', image: require('../../assets/category/Bookings.png') },
  { id: 10, name: 'Travel', image: require('../../assets/category/travel.png') },
  { id: 11, name: 'Miscellaneous', image: require('../../assets/category/misscelenous.png') },
];

const CategoryGrid = ({ onSelectCategory, onClose }) => {
  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Select Category</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.gridContainer}>
        {categories.map((category, idx) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryItem,
              (idx + 1) % 4 === 0 && { marginRight: 0 }
            ]}
            onPress={() => onSelectCategory?.(category)}
          >
            <LinearGradient
              colors={['#8B6AD2', '#211E83']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={category.image}
                style={styles.categoryIcon}
                resizeMode="contain"
              />
              <Text style={styles.categoryName}>{category.name}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
};

const { width } = Dimensions.get('window');
const itemSize = (width - 70) / 4; // 3 items per row with spacing

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  closeButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  categoryItem: {
    width: itemSize,
    height: itemSize,
    marginBottom: 10,
    marginRight: 10,
  },
  gradient: {
    flex: 1,
    borderRadius: 15,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 30,
    height: 30,
    marginBottom: 5,
  },
  categoryName: {
    color: 'white',
    marginTop: 5,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default CategoryGrid; 