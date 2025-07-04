import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FAB } from '@rneui/themed';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native'; // Adjust the path as needed
import * as Linking from 'expo-linking';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import ExpenseDetailsScreen from '../screens/ExpenseDetailsScreen';
import InviteMembersScreen from '../screens/InviteMembersScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationScreen from '../screens/NotificationScreen';
import AddMemberScreen from '../screens/AddMemberScreen';
import EditGroupScreen from '../screens/EditGroupScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
};

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsScreen}
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-group" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => (
            <Icon name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const MainStack = () => {
  const [data, setData] = useState([]);

  console.log('Data:', data);

  try {
    // Firestore access code
  } catch (error) {
    console.error('Error loading theme preference:', error);
  }

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          headerShown: false,
          presentation: 'card'
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: false,
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="EditGroupScreen"
        component={EditGroupScreen}
        options={{
          headerShown: false,
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="AddMember"
        component={AddMemberScreen}
        options={{
          title: 'Add Member',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          title: 'Add Expense',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="GroupDetails"
        component={GroupDetailsScreen}
        options={{
          title: 'Group Details',
          headerShown: false,
          headerTintColor: '#fff'
        }}
      />
      <Stack.Screen
        name="SettleUp"
        component={SettleUpScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          title: 'Create New Group',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="ExpenseDetails"
        component={ExpenseDetailsScreen}
        options={{
          title: 'Expense Details',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{
          title: 'Invite Members',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{
          title: 'Group Settings',
          headerStyle: {
            backgroundColor: '#6C63FF',
          },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

const linking = {
  prefixes: ['https://heroic-cannoli-2a304c.netlify.app', 'splitmate://'],
  config: {
    screens: {
      Main: {
        screens: {
          InviteMembers: {
            path: 'invite',
            parse: {
              code: (code) => `${code}`,
            },
          },
          // ...other screens
        },
      },
      // ...other stacks
    },
  },
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 