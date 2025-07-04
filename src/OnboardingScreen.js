import React, { useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, FlatList, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const data = [
  {
    title: ['Split Expenses'],
    subtitle: 'Easily Keep\ntrack of who\npaid what',
    image: require('../assets/Onboarding_01.jpg'),
  },
  {
    title: ['Settle Up Instantly '],
    subtitle: 'Clear balances and stay in sync together',
    image: require('../assets/Onboarding_02.jpg'),
  },
  {
    title: ['Organize Groups'],
    subtitle: 'with Ease Create or join groups for shared costs',
    image: require('../assets/Onboarding_03.jpg'),
  },
];

const OnboardingScreen = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef();
  const navigation = useNavigation();

  const handleNext = async () => {
    if (currentIndex < data.length - 1) {
      flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      console.log('Onboarding complete - checking invite flow');
      const pendingInviteFlow = await AsyncStorage.getItem('pendingInviteFlow');
      if (pendingInviteFlow === 'true') {
        navigation.navigate('Signup');
      }
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleSkip = async () => {
    console.log('Onboarding skipped - checking invite flow');
    const pendingInviteFlow = await AsyncStorage.getItem('pendingInviteFlow');
    if (pendingInviteFlow === 'true') {
      navigation.navigate('Signup');
    }
    if (onComplete) {
      onComplete();
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Image 
          source={item.image} 
          style={styles.image} 
          resizeMode="cover"
        />
        <View style={styles.overlay} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/Group 28.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <View style={styles.textContainer}>
            <Text style={styles.logoText}>Splitmate</Text>
          </View>
        </View>
        <View style={styles.titleContainer}>
          {item.title.map((line, index) => (
            <MaskedView
              key={index}
              style={{ height: 45 }}
              maskElement={
                <Text style={styles.title}>
                  {line}
                </Text>
              }
            >
              <LinearGradient
                colors={['#FFDF3D', '#FA8500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </MaskedView>
          ))}
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    </View>
  );

  const Pagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {data.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              { backgroundColor: currentIndex === index ? '#fff' : 'rgba(255,255,255,0.5)' }
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setCurrentIndex(index);
        }}
        ref={flatListRef}
      />

      <View style={styles.bottomContainer}>
        <Pagination />
        <TouchableOpacity 
          style={styles.buttonContainer} 
          onPress={handleNext}
        >
          <LinearGradient
            colors={['#FFFFFF', '#CCCCCD']}
            style={styles.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>
              {currentIndex === data.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B3D6E',
  },
  slide: {
    width: screenWidth,
    height: '100%',
    flex: 1,
  },
  imageContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 61, 110, 0.4)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: screenHeight * 0.15,
  },
  logoIcon: {
    width: 160,
    height: 30,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFDF3D',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  titleContainer: {
    marginTop: screenHeight * 0.15,
    paddingHorizontal: 5,
    width: '100%',
  },
  title: {
    fontSize: 39,
    fontWeight: '900',
    textAlign: 'left',
    color: 'black',
    lineHeight: 40,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 35,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 45,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    textTransform: 'capitalize',
    marginTop: 10,
  },
  skipButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  paginationContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    width: screenWidth - 40,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  button: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OnboardingScreen;
