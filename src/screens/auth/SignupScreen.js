import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SignupScreen = ({ route }) => {
  const navigation = useNavigation();
  const { signup, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Get guestId and phone from params if present
  const guestId = route?.params?.guestId;
  const guestPhone = route?.params?.phone;

  // Helper: migrate guest to full user
  const migrateGuestToUser = async (newUid) => {
    try {
      console.log('Starting guest migration for:', guestId, 'to new UID:', newUid);
      
      // Get guest data first
      const guestDoc = await getDoc(doc(db, 'users', guestId));
      let guestData = {};
      if (guestDoc.exists()) {
        guestData = guestDoc.data();
      }
      
      // 1. Migrate guest groups from AsyncStorage to Firestore
      const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
      console.log('Migrating guest groups:', guestGroups.length);
      
      for (const group of guestGroups) {
        // Check if group already exists in Firestore
        const existingGroupDoc = await getDoc(doc(db, 'groups', group.id));
        
        if (!existingGroupDoc.exists()) {
          // Create new group in Firestore
          const groupData = {
            name: group.name,
            description: group.description || '',
            category: group.category || 'Miscellaneous',
            categoryIconKey: group.categoryIconKey || 'Miscellaneous',
            members: group.members || [],
            memberIds: group.memberIds || [],
            createdBy: {
              id: newUid, // Update creator to new UID
              name: guestData?.displayName || 'User',
              email: email
            },
            createdAt: group.createdAt ? new Date(group.createdAt) : new Date(),
            updatedAt: new Date(),
            isActive: true
          };
          
          // If the group has a guest-group- prefix, create a new Firestore document
          if (group.id.startsWith('guest-group-')) {
            const newGroupRef = await addDoc(collection(db, 'groups'), groupData);
            console.log('Created new Firestore group:', newGroupRef.id, 'from guest group:', group.id);
            
            // Update the group ID in the group data for expense migration
            group.newFirestoreId = newGroupRef.id;
          } else {
            // Group already exists in Firestore, just update the creator
            await updateDoc(doc(db, 'groups', group.id), {
              createdBy: {
                id: newUid,
                name: guestData?.displayName || 'User',
                email: email
              }
            });
            group.newFirestoreId = group.id;
          }
        } else {
          // Group exists, update member info
          const existingData = existingGroupDoc.data();
          const updatedMembers = existingData.members?.map(member => 
            member.id === guestId 
              ? { ...member, id: newUid, isGuest: false, hasFullAccess: true }
              : member
          ) || [];
          
          await updateDoc(doc(db, 'groups', group.id), {
            members: updatedMembers,
            memberIds: updatedMembers.map(m => m.id)
          });
          group.newFirestoreId = group.id;
        }
      }
      
      // 2. Migrate guest expenses from AsyncStorage to Firestore
      const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
      console.log('Migrating guest expenses:', guestExpenses.length);
      
      let personalExpenseCount = 0;
      let groupExpenseCount = 0;
      
      for (const expense of guestExpenses) {
        if (expense.isPersonal === true) {
          // Migrate personal expenses to personalExpenses collection
          const personalExpenseData = {
            amount: expense.amount,
            category: expense.category,
            categoryIcon: expense.categoryIcon || 'office-building-outline',
            createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date(),
            date: expense.date ? new Date(expense.date) : new Date(),
            description: expense.description,
            isPersonal: true,
            members: expense.members || [],
            paidBy: expense.paidBy,
            paidById: expense.paidById || newUid,
            splitMethod: expense.splitMethod || 'Equally',
            splitAmounts: expense.splitAmounts || {},
            status: expense.status || 'active',
            userId: newUid
          };
          
          const personalExpenseRef = await addDoc(collection(db, 'personalExpenses'), personalExpenseData);
          console.log('Migrated personal expense:', expense.description, 'with ID:', personalExpenseRef.id, 'for userId:', newUid);
          personalExpenseCount++;
        } else if (expense.groupId) {
          // Migrate group expenses to expenses collection
          const groupExpenseData = {
            amount: expense.amount,
            category: expense.category,
            categoryIcon: expense.categoryIcon || 'office-building-outline',
            createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date(),
            date: expense.date ? new Date(expense.date) : new Date(),
            description: expense.description,
            groupId: expense.groupId.startsWith('guest-group-') 
              ? guestGroups.find(g => g.id === expense.groupId)?.newFirestoreId || expense.groupId
              : expense.groupId,
            members: expense.members || [],
            paidBy: expense.paidBy,
            paidById: expense.paidById || newUid,
            splitMethod: expense.splitMethod || 'Equally',
            splits: expense.splits || [],
            status: expense.status || 'active'
          };
          
          const groupExpenseRef = await addDoc(collection(db, 'expenses'), groupExpenseData);
          console.log('Migrated group expense:', expense.description, 'with ID:', groupExpenseRef.id);
          groupExpenseCount++;
        }
      }
      
      console.log(`Migration summary: ${personalExpenseCount} personal expenses, ${groupExpenseCount} group expenses migrated`);
      
      // 3. Migrate guest settlements from AsyncStorage to Firestore
      const guestSettlements = JSON.parse(await AsyncStorage.getItem('guestSettlements') || '[]');
      console.log('Migrating guest settlements:', guestSettlements.length);
      
      for (const settlement of guestSettlements) {
        const settlementData = {
          groupId: settlement.groupId.startsWith('guest-group-') 
            ? guestGroups.find(g => g.id === settlement.groupId)?.newFirestoreId || settlement.groupId
            : settlement.groupId,
          amount: settlement.amount,
          note: settlement.note || '',
          from: {
            id: settlement.from?.id === guestId ? newUid : settlement.from?.id,
            name: settlement.from?.name || 'User',
            email: settlement.from?.email || ''
          },
          to: {
            id: settlement.to?.id === guestId ? newUid : settlement.to?.id,
            name: settlement.to?.name || 'User',
            email: settlement.to?.email || ''
          },
          status: settlement.status || 'pending',
          createdAt: settlement.createdAt ? new Date(settlement.createdAt) : new Date(),
          settledAt: settlement.settledAt ? new Date(settlement.settledAt) : null,
          settledBy: settlement.settledBy ? {
            id: settlement.settledBy.id === guestId ? newUid : settlement.settledBy.id,
            name: settlement.settledBy.name || 'User'
          } : null,
          createdBy: {
            id: settlement.createdBy?.id === guestId ? newUid : settlement.createdBy?.id,
            name: settlement.createdBy?.name || 'User',
            email: settlement.createdBy?.email || ''
          }
        };
        
        await addDoc(collection(db, 'settlements'), settlementData);
        console.log('Migrated settlement:', settlement.amount);
      }
      
      // 4. Update existing Firestore groups where guest was a member
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        if (groupData.members?.some(m => m.id === guestId)) {
          // Replace guestId with newUid in members
          const updatedMembers = groupData.members.map(m =>
            m.id === guestId
              ? { ...m, id: newUid, isGuest: false, hasFullAccess: true }
              : m
          );
          await updateDoc(doc(db, 'groups', groupDoc.id), {
            members: updatedMembers,
            memberIds: updatedMembers.map(m => m.id),
          });
          console.log('Updated group membership in:', groupDoc.id);
        }
      }
      
      // 5. Copy guest profile to new user profile
      const phoneValue = guestPhone || guestData.phone;
      const userUpdate = {
        ...guestData,
        email: email,
        displayName: guestData?.displayName || 'User',
        isGuest: false,
        hasFullAccess: true,
        role: 'member',
        groups: [],
        createdAt: guestData?.createdAt || new Date(),
        updatedAt: new Date(),
        isActive: true,
        permissions: {
          canAddExpenses: true,
          canViewExpenses: true,
          canEditExpenses: true,
          canDeleteExpenses: true,
          canAddMembers: true,
          canRemoveMembers: true,
          canViewAnalytics: true,
          canViewSettlements: true,
          canCreateSettlements: true,
        }
      };
      
      if (phoneValue !== undefined && phoneValue !== null) {
        userUpdate.phone = phoneValue;
      }
      
      await setDoc(doc(db, 'users', newUid), userUpdate, { merge: true });
      console.log('Created new user profile for:', newUid);
      
      // 6. Clean up guest data from AsyncStorage (optional - keep for backup)
      // await AsyncStorage.multiRemove(['guestGroups', 'guestExpenses', 'guestSettlements']);
      
      console.log('Guest migration completed successfully!');
      
    } catch (err) {
      console.error('Migration Error:', err);
      Alert.alert('Migration Error', err.message || 'Failed to migrate guest data.');
      throw err;
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    try {
      setSignupLoading(true);
      const userCredential = await signup(email, password);
      if (userCredential.error && userCredential.error.includes('email-already-in-use')) {
        Alert.alert('Signup Failed', 'This email is already registered. Please use a different email or log in.');
        return;
      }
      // Check if this was a guest user upgrading to full account
      if (guestId) {
        // Migrate guest data to new user account
        await migrateGuestToUser(userCredential.uid);
        // Navigate directly to Profile screen after guest upgrade
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        // For new users, update user state
        if (setUser) {
          setUser({
            ...userCredential,
            isGuest: false,
            hasFullAccess: true,
          });
        }
      }
      await AsyncStorage.setItem('signupJustCompleted', 'true');
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setGuestLoading(true);
    navigation.navigate('Login');
    setGuestLoading(false);
  };

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.content}>
              <View style={styles.headerContainer}>
                <Image 
                  source={require('../../../assets/Group 28.png')}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
                <Text style={styles.headerTitle}>Sign up to Splitmate</Text>
                <Text style={styles.headerSubtitle}>
                  Start splitting smarter. Join and simplify{'\n'}group expenses.
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email.."
                    placeholderTextColor="#8E8E93"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!signupLoading && !guestLoading}
                  />
                </View>
                {guestPhone ? (
                  <>
                    <Text style={styles.label}>Phone Number</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        value={guestPhone}
                        editable={false}
                      />
                    </View>
                  </>
                ) : null}

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password.."
                    placeholderTextColor="#8E8E93"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!signupLoading && !guestLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={signupLoading || guestLoading}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={24}
                      color="#8E8E93"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password.."
                    placeholderTextColor="#8E8E93"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!signupLoading && !guestLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={signupLoading || guestLoading}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={24}
                      color="#8E8E93"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.signUpButton, signupLoading && styles.disabledButton]}
                  onPress={handleSignup}
                  disabled={signupLoading || guestLoading}
                >
                  <LinearGradient
                    colors={['#FFDF3D', '#FA8500']}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.buttonContent}>
                      {signupLoading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <>
                          <Text style={styles.signUpButtonText}>Sign up</Text>
                          <Ionicons name="arrow-forward" size={20} color="#000" />
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.appleButton, (signupLoading || guestLoading) && styles.disabledButton]}
                  disabled={signupLoading || guestLoading}
                >
                  <Ionicons
                    name="logo-apple"
                    size={24}
                    color="#000"
                    style={styles.appleIcon}
                  />
                  <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.guestButton, guestLoading && styles.disabledButton]}
                  onPress={handleGuestLogin}
                  disabled={signupLoading || guestLoading}
                >
                  <View style={styles.buttonContent}>
                    {guestLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Login')}
                  disabled={signupLoading || guestLoading}
                >
                  <Text style={styles.signInText}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: 'flex-start',
    marginTop: 40,
    marginBottom: 40,
  },
  logoIcon: {
    width: 120,
    height: 60,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFDF3D',
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 5,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  buttonContainer: {
    gap: 20,
  },
  signUpButton: {
    height: 55,
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.7,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signUpButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#fff',
    height: 55,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: {
    marginRight: 10,
  },
  appleButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  guestButton: {
    height: 55,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#fff',
    fontSize: 16,
  },
  signInText: {
    color: '#FFDF3D',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
});

export default SignupScreen; 