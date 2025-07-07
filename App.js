import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Platform, StatusBar, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppProvider } from './src/context/AppProvider';
import { useTheme } from './src/context/ThemeContext';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GroupDetailsScreen from './src/screens/GroupDetailsScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import InviteMembersScreen from './src/screens/InviteMembersScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import ExpenseDetailsScreen from './src/screens/ExpenseDetailsScreen';
import OnboardingScreen from './src/OnboardingScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import AddMemberScreen from './src/screens/AddMemberScreen';
import AddExpenseInsideGroup from './src/screens/AddExpenseInsideGroup';
import { LinearGradient } from 'expo-linear-gradient';
import AddOptionsModal from './src/components/AddOptionsModal';
import Svg, { Path } from 'react-native-svg';
import EditGroupScreen from './src/screens/EditGroupScreen';
import EditExpenseInsideGroup from './src/screens/EditExpenseInsideGroup';
import * as Linking from 'expo-linking';
import { navigationRef, navigate } from './src/navigation/RootNavigation';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NotificationService from './src/services/NotificationService';
import CustomSplash from './src/components/CustomSplash';
import SplashScreen from './src/screens/SplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

import { validateGroupAccess } from './src/utils/groupValidation';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const windowWidth = Dimensions.get('window').width;

// Add linking configuration
const linking = {
  prefixes: ['splitmate://', 'https://heroic-cannoli-2a304c.netlify.app'],
  config: {
    screens: {
      InviteMembers: {
        path: 'invite/:code',
        parse: {
          code: (code) => code,
        },
      },
      GroupDetails: {
        path: 'group/:groupId',
        parse: {
          groupId: (groupId) => groupId,
        },
      },
      // Add other screens as needed
    },
  },
};

// Auth Navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      {__DEV__ && <AuthStack.Screen name="InviteMembers" component={InviteMembersScreen} />}
    </AuthStack.Navigator>
  );
};

function CustomTabBar({ state, descriptors, navigation }) {
  const [showAddOptions, setShowAddOptions] = useState(false);

  return (
    <View style={styles.tabBarContainer}>
      <LinearGradient
        colors={['#2D5586', '#171E45']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.tabsWrapper}>
          <View style={styles.tabSection}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Icon
                name="home"
                size={24}
                color={state.index === 0 ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, { color: state.index === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                HOME
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => navigation.navigate('GroupsTab')}
            >
              <Icon
                name="account-group"
                size={24}
                color={state.index === 1 ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, { color: state.index === 1 ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                GROUPS
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.centerButtonContainer}>
            <TouchableOpacity 
              style={styles.centerButton}
              onPress={() => setShowAddOptions(true)}
            >
              <LinearGradient
                colors={['#4C49ED', '#3F3DD8']}
                style={styles.centerButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.svgContainer}>
                  <Svg
          width={80}
          height={80}
          viewBox="0 0 100 100"
          style={styles.svg}
        >
          <Path
            d="M50 0C75 0 100 25 100 50C100 75 75 100 50 100C25 100 0 75 0 50C0 25 25 0 50 0Z"
            fill="#6536F833"
          />
        </Svg>
                </View>
                <Icon name="plus" size={35} color="#fff" style={{ fontWeight: '300' }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.tabSection}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => navigation.navigate('ExpensesTab')}
            >
              <Icon
                name="wallet"
                size={24}
                color={state.index === 2 ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, { color: state.index === 2 ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                EXPENSES
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => navigation.navigate('ProfileTab')}
            >
              <Icon
                name="account"
                size={24}
                color={state.index === 3 ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, { color: state.index === 3 ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
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
}

// Main Tabs Navigator
const MainTabsNavigator = () => {
  const navigation = useNavigation();
  useEffect(() => {
    const checkPendingNavigation = async () => {
      const pending = await AsyncStorage.getItem('pendingGroupNavigation');
      if (pending) {
        const { groupId, guestId } = JSON.parse(pending);
        await AsyncStorage.removeItem('pendingGroupNavigation');
        navigation.navigate('GroupDetails', { groupId, guestId });
      }
    };
    checkPendingNavigation();
  }, []);

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="GroupsTab" component={GroupsScreen} />
      <Tab.Screen name="ExpensesTab" component={ExpensesScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: windowWidth,
    height: 80,
  },
  gradient: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tabsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: '100%',
  },
  tabSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '40%',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  centerButtonContainer: {
    position: 'absolute',
    left: '55%',
    top: -30,
    width: 65,
    height: 65,
    marginLeft: -32.5,
    zIndex: 1,
    borderRadius: 32.5,
    padding: 2,
  },
  centerButton: {
    width: '100%',
    height: '100%',
    borderRadius: 32.5,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#6536F8',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'visible',
  },
  centerButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32.5,
  },
  svgContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 1,
  },
});

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { user, loading } = useAuth();
  const [pendingInviteCode, setPendingInviteCode] = useState(null);

  // Push notification state
  const [expoPushToken, setExpoPushToken] = useState('');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
        setHasCompletedOnboarding(onboardingCompleted === 'true');

        // Check for deep link
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const { path: pathName, queryParams } = Linking.parse(initialUrl);
          // Check for invite link specifically
          if (pathName && pathName.startsWith('invite/')) {
            const code = pathName.split('/')[1];
            if (code) {
                await AsyncStorage.setItem('pendingInviteCode', code);
                await AsyncStorage.setItem('pendingInviteFlow', 'true');
                setPendingInviteCode(code);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeApp();

    // Listen for deep links while the app is running
    const subscription = Linking.addEventListener('url', async (event) => {
      const { path: pathName, queryParams } = Linking.parse(event.url);
      if (pathName && pathName.startsWith('invite/')) {
        const code = pathName.split('/')[1];
        if (code) {
            await AsyncStorage.setItem('pendingInviteCode', code);
            await AsyncStorage.setItem('pendingInviteFlow', 'true');
            setPendingInviteCode(code);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request permission and get token
    const registerForPushNotificationsAsync = async () => {
      let token;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          alert('Failed to get push token for push notification!');
          return;
        }
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: '7e64a6eb-4ca9-402e-b2e6-37e4bb15fb61', // Your Expo project ID
        })).data;
        console.log('Expo Push Token:', token);
      } else {
        alert('Must use physical device for Push Notifications');
      }

      return token;
    };

    // Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      if (data && navigationRef.current) {
        if (data.screen === 'GroupDetails') {
          // Get the current user (guest or not)
          const currentUser = require('./src/config/firebase').auth.currentUser;
          const params = { ...data.params };
          if (currentUser?.isAnonymous) {
            params.guestId = currentUser.uid;
          }
          
          // Validate group access before navigating
          validateGroupAccess(params.groupId, currentUser.uid, currentUser?.isAnonymous)
            .then((validation) => {
              if (validation.exists && validation.accessible) {
                navigationRef.current.navigate('GroupDetails', params);
              } else {
                Alert.alert(
                  'Group Not Found',
                  'This group has been deleted or you no longer have access to it.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Navigate to Groups screen instead
                        navigationRef.current.navigate('MainTabs', {
                          screen: 'GroupsTab'
                        });
                      }
                    }
                  ]
                );
              }
            })
            .catch(error => {
              console.error('Error validating group access:', error);
              Alert.alert(
                'Error',
                'Unable to access the group. Please try again.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to Groups screen instead
                      navigationRef.current.navigate('MainTabs', {
                        screen: 'GroupsTab'
                      });
                    }
                  }
                ]
              );
            });
        } else {
          navigationRef.current.navigate(data.screen, data.params);
        }
      }
    });

    // Initialize notifications
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        console.log('Push token:', token);
        setExpoPushToken(token);
        
        // Save token to user's profile if user is logged in
        if (user?.uid) {
          NotificationService.savePushToken(user.uid, token);
        }
      }
    });

    // Cleanup
    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Save push token when user logs in
  useEffect(() => {
    if (user?.uid && expoPushToken) {
      NotificationService.savePushToken(user.uid, expoPushToken);
    }
  }, [user, expoPushToken]);

  // After onboarding, if pendingInviteFlow is true, navigate to Signup
  const handleOnboardingComplete = async (navigation) => {
    try {
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      setHasCompletedOnboarding(true);
      const pendingInviteFlow = await AsyncStorage.getItem('pendingInviteFlow');
      if (pendingInviteFlow === 'true' && navigation) {
        navigation.navigate('Signup');
      }
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // After signup, navigate to Login and set signupJustCompleted flag
  // This should be handled in your SignupScreen after successful signup:
  // await AsyncStorage.setItem('signupJustCompleted', 'true');
  // navigation.navigate('Login');

  // After login, if all flags and invite code are present, navigate to InviteMembersScreen
  useEffect(() => {
    const checkInviteAfterAuth = async () => {
      if (user && navigationRef.current) {
        const code = await AsyncStorage.getItem('pendingInviteCode');
        const pendingInviteFlow = await AsyncStorage.getItem('pendingInviteFlow');
        const signupJustCompleted = await AsyncStorage.getItem('signupJustCompleted');
        if (code && pendingInviteFlow === 'true' && signupJustCompleted === 'true') {
          navigationRef.current.reset({
            index: 1,
            routes: [
              { name: 'MainTabs' },
              { name: 'InviteMembers', params: { code } }
            ]
          });
          await AsyncStorage.removeItem('pendingInviteCode');
          await AsyncStorage.removeItem('pendingInviteFlow');
          await AsyncStorage.removeItem('signupJustCompleted');
        }
      }
    };
    checkInviteAfterAuth();
  }, [user]);

  if (isLoading || loading) {
    return <CustomSplash onNavigateToOnboarding={() => setIsLoading(false)} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="WebView" component={WebViewScreen} />
              {!hasCompletedOnboarding ? (
                <Stack.Screen name="Onboarding">
                  {props => <OnboardingScreen {...props} onComplete={(nav) => handleOnboardingComplete(props.navigation)} />}
                </Stack.Screen>
              ) : user ? (
                <>
                  <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
                  <Stack.Screen 
                    name="InviteMembers" 
                    component={InviteMembersScreen}
                    options={{
                      gestureEnabled: false,
                      animation: 'slide_from_right'
                    }}
                  />
                  <Stack.Screen 
                    name="GroupDetails" 
                    component={GroupDetailsScreen}
                    options={{
                      gestureEnabled: false,
                      animation: 'slide_from_right'
                    }}
                  />
                  <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
                  <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
                  <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
                  <Stack.Screen name="Subscription" component={SubscriptionScreen} />
                  <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="Notifications" component={NotificationScreen} />
                  <Stack.Screen name="GroupChat" component={GroupChatScreen} />
                  <Stack.Screen name="AddMember" component={AddMemberScreen} />
                  <Stack.Screen name="AddExpenseInsideGroup" component={AddExpenseInsideGroup} />
                  <Stack.Screen name="EditGroupScreen" component={EditGroupScreen} />
                  <Stack.Screen name="EditExpenseInsideGroup" component={EditExpenseInsideGroup} />
                  <Stack.Screen name="ExpenseScreen" component={ExpensesScreen} />
                  <Stack.Screen name="Signup" component={SignupScreen} />
                  <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                  <Stack.Screen name="Login" component={LoginScreen} />
                </>
              ) : (
                <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
