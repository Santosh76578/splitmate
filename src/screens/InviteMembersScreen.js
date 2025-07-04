import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Share,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  DevSettings,
} from 'react-native';
import { Text, Icon } from '@rneui/themed';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/RootNavigation';
import Constants from 'expo-constants';
import { getAuth, signInAnonymously } from 'firebase/auth';
import DropDownPicker from 'react-native-dropdown-picker';
import { StackActions } from '@react-navigation/native';
import { normalizePhoneNumber, comparePhoneNumbers, debugPhoneNumbers, testPhoneNormalization } from '../utils/phoneUtils';

const InviteMembersScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId, code: routeCode } = route.params || {};
  const [emails, setEmails] = useState(['']);
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const functions = getFunctions();
  const [prefilledName, setPrefilledName] = useState('');
  const [prefilledPhone, setPrefilledPhone] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [groupDetails, setGroupDetails] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberSelection, setShowMemberSelection] = useState(false);
  const [showProfileUpdate, setShowProfileUpdate] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownItems, setDropdownItems] = useState([]);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Check if we're in development mode
  const isDevelopment = __DEV__;

  // Test phone normalization on component mount
  useEffect(() => {
    if (isDevelopment) {
      testPhoneNormalization();
    }
  }, []);

  useEffect(() => {
    // Handle invite code from route params
    if (routeCode) {
      console.log('Handling route code:', routeCode);
      handleInviteCode(routeCode);
      return;
    }

    // Handle deep link if the screen was opened via invite link
    const handleDeepLink = async () => {
      try {
        console.log('Checking for initial URL...');
        const initialUrl = await Linking.getInitialURL();
        console.log('Initial URL received:', initialUrl);
        
        if (initialUrl) {
          console.log('Processing URL:', initialUrl);
          // For development, handle both URL schemes and web URLs
          if (isDevelopment) {
            const { queryParams, path } = Linking.parse(initialUrl);
            console.log('Parsed URL details:', { queryParams, path });
            
            // Extract code from either queryParams or path
            const code = queryParams?.code || path?.split('/').pop();
            console.log('Extracted code:', code);
            
            if (code) {
              console.log('Found invite code, calling handleInviteCode with:', code);
              await handleInviteCode(code);
            } else {
              console.log('No invite code found in URL');
            }
          } else {
            // In production, only handle the app's URL scheme
            if (initialUrl.startsWith('splitmate://')) {
              const { queryParams } = Linking.parse(initialUrl);
              if (queryParams?.code) {
                await handleInviteCode(queryParams.code);
              }
            }
          }
        } else {
          console.log('No initial URL found');
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    handleDeepLink();

    // Listen for deep links while the app is running
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      console.log('Deep link received:', url);
      try {
        if (isDevelopment) {
          // In development, handle both URL schemes and web URLs
          const { queryParams, path } = Linking.parse(url);
          console.log('Parsed deep link details:', { queryParams, path });
          
          const code = queryParams?.code || path?.split('/').pop();
          console.log('Extracted code from deep link:', code);
          
          if (code) {
            console.log('Found invite code in deep link, calling handleInviteCode with:', code);
            await handleInviteCode(code);
          } else {
            console.log('No invite code found in deep link');
          }
        } else {
          // In production, only handle the app's URL scheme
          if (url.startsWith('splitmate://')) {
            const { queryParams } = Linking.parse(url);
            if (queryParams?.code) {
              await handleInviteCode(queryParams.code);
            }
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [routeCode]);

  useEffect(() => {
    if (groupDetails?.members) {
      setDropdownItems(
        groupDetails.members.map((member, index) => ({
          label: member.name,
          value: member.id,
          key: member.id ? member.id + '_' + index : index,
        }))
      );
    }
  }, [groupDetails]);

  useEffect(() => {
    if (shouldNavigate) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [shouldNavigate]);

  const handleInviteCode = async (code) => {
    try {
      console.log('=== handleInviteCode Debug ===');
      console.log('Starting handleInviteCode with code:', code);
      setIsLoading(true);
      
      // Get the invite document
      console.log('Looking for invite document with ID:', code);
      const inviteRef = doc(db, 'invites', code);
      const inviteDoc = await getDoc(inviteRef);
      
      if (!inviteDoc.exists()) {
        console.log('❌ Invite document not found for code:', code);
        console.log('Available invite documents:');
        // Let's check what invite documents exist
        try {
          const invitesSnapshot = await getDocs(collection(db, 'invites'));
          console.log('Total invite documents:', invitesSnapshot.size);
          invitesSnapshot.forEach(doc => {
            console.log('Invite doc ID:', doc.id, 'Data:', doc.data());
          });
        } catch (e) {
          console.log('Error fetching invite documents:', e);
        }
        throw new Error('Invalid or expired invite code');
      }
      
      const inviteData = inviteDoc.data();
      console.log('✅ Invite data retrieved:', inviteData);
      
      // Fetch group details
      console.log('Looking for group with ID:', inviteData.groupId);
      const groupRef = doc(db, 'groups', inviteData.groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        console.log('❌ Group document not found for ID:', inviteData.groupId);
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      console.log('✅ Group data retrieved:', groupData);
      console.log('Group inviteCode:', groupData.inviteCode);
      
      // Check if the group has reached its member limit (5 members + admin)
      const currentMembers = groupData.members || [];
      console.log('Current members count:', currentMembers.length);
      if (currentMembers.length >= 6) { // 5 members + admin
        console.log('❌ Group has reached member limit:', currentMembers.length);
        throw new Error('Group has reached its maximum member limit');
      }

      setGroupDetails({
        ...groupData,
        id: groupDoc.id,
        members: currentMembers
      });
      
      // Show join form regardless of user authentication status
      setShowJoinForm(true);
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error in handleInviteCode:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to join group. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const updateEmail = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const removeEmail = (index) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index);
      setEmails(newEmails);
    }
  };

  const generateInviteLink = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please log in to generate an invite link.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Call the Cloud Function to generate an invite
      const generateInvite = httpsCallable(functions, 'generateInvite');
      const result = await generateInvite({ groupId });
      
      const { inviteLink } = result.data;
      
      // Get group data for the share message
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      const groupData = groupDoc.data();
      
      await Share.share({
        message: `Join my group "${groupData.name}" on SplitMate! Click here: ${inviteLink}`,
        title: 'Invite to SplitMate Group',
      });
    } catch (error) {
      Alert.alert(
        'Error',
        error.message || 'Failed to generate invite link. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please log in to send email invites.');
      return;
    }

    const validEmails = emails.filter(email => email.trim() !== '');
    if (validEmails.length > 0) {
      try {
        setIsLoading(true);
        // TODO: Implement email invite logic
        // For example:
        // await api.sendEmailInvites(groupId, validEmails, user.uid);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        Alert.alert(
          'Success',
          'Invitations sent successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (error) {
        Alert.alert(
          'Error',
          'Failed to send invitations. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Only show invite options if user is a member or admin
  if (!showJoinForm && !isMember && routeCode) {
    // If user is not a member and has an invite code, don't show invite options
    return null;
  }

  if (showJoinForm) {
    return (
      <LinearGradient
        colors={['#23305A', '#1A1F3C']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView style={styles.content}>
            {/* <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View> */}

            {groupDetails && (
              <View style={styles.groupInfoContainer}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconContainer}>
                    <Text style={styles.groupIconText}>
                      {groupDetails.name ? groupDetails.name[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.groupDetails}>
                    <Text style={styles.groupName}>{groupDetails.name}</Text>
                    <Text style={styles.groupDescription} numberOfLines={2}>
                      {groupDetails.description || 'No description provided'}
                    </Text>
                  </View>
                </View>

                <View style={styles.membersSection}>
                  <Text style={styles.sectionTitle}>Members</Text>
                  <View style={styles.membersList}>
                    {groupDetails.members?.slice(0, 5).map((member, index) => (
                      <View key={member.id ? member.id + '_' + index : index} style={styles.memberItem}>
                        <View style={styles.memberInitialContainer}>
                          <Text style={styles.memberInitial}>
                            {member.name ? member.name[0].toUpperCase() : '?'}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.name || 'Unknown'}</Text>
                          {member.role === 'admin' && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminText}>Admin</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                    {groupDetails.members?.length > 5 && (
                      <Text style={styles.moreMembersText}>
                        +{groupDetails.members.length - 5} more members
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Join Group</Text>
              <Text style={styles.formSubtitle}>
                Select your name and enter your phone number to join
              </Text>

              {/* Member selection as dropdown */}
              <View style={[styles.inputContainer, { zIndex: 1000, marginBottom: 24 }]}>
                <Text style={styles.label}>Select Your Name</Text>
                <DropDownPicker
                  open={dropdownOpen}
                  value={selectedMember ? selectedMember.id : null}
                  items={dropdownItems}
                  setOpen={setDropdownOpen}
                  setValue={val => {
                    const member = groupDetails?.members.find(m => String(m.id) === String(val()));
                    setSelectedMember(member || null);
                  }}
                  setItems={setDropdownItems}
                  placeholder="Select your name"
                  style={{
                    backgroundColor: '#23305A',
                    borderColor: dropdownOpen ? '#FFDF3D' : '#1A1F3C',
                    borderWidth: 2,
                    borderRadius: 14,
                    minHeight: 54,
                    paddingHorizontal: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.18,
                    shadowRadius: 5,
                    elevation: 4,
                  }}
                  dropDownContainerStyle={{
                    backgroundColor: '#1A1F3C',
                    borderColor: '#23305A',
                    borderRadius: 14,
                    marginTop: 2,
                  }}
                  textStyle={{ color: '#fff', fontSize: 16, fontWeight: '500' }}
                  placeholderStyle={{ color: '#8B6AD2', fontSize: 16 }}
                  listItemLabelStyle={{ color: '#fff', fontSize: 16 }}
                  selectedItemLabelStyle={{ color: '#FFDF3D', fontWeight: 'bold' }}
                  arrowIconStyle={{ tintColor: '#FFDF3D' }}
                  TickIconComponent={({ style }) => (
                    <Ionicons name="checkmark" size={20} color="#FFDF3D" style={style} />
                  )}
                  ArrowDownIconComponent={({ style }) => (
                    <Ionicons name="chevron-down" size={22} color="#FFDF3D" style={style} />
                  )}
                  ArrowUpIconComponent={({ style }) => (
                    <Ionicons name="chevron-up" size={22} color="#FFDF3D" style={style} />
                  )}
                  listMode="SCROLLVIEW"
                  modalProps={{
                    animationType: 'fade',
                    transparent: true,
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={prefilledPhone}
                  onChangeText={setPrefilledPhone}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={{ borderRadius: 12, overflow: 'hidden', marginTop: 8 }}
                onPress={async () => {
                  try {
                    if (!selectedMember) {
                      Alert.alert('Error', 'Please select your name first');
                      return;
                    }
                    if (!prefilledPhone) {
                      Alert.alert('Error', 'Please enter your phone number');
                      return;
                    }

                    setIsLoading(true);

                    // Get group data
                    const groupRef = doc(db, 'groups', groupDetails.id);
                    // Get or create Firebase UID
                    let firebaseUid;
                    if (!user) {
                      const userCredential = await signInAnonymously(getAuth());
                      firebaseUid = userCredential.user.uid;
                    } else {
                      firebaseUid = user.uid;
                    }

                    // Use Firestore transaction for atomic update
                    await runTransaction(db, async (transaction) => {
                      const groupDoc = await transaction.get(groupRef);
                      if (!groupDoc.exists()) throw new Error('Group not found');
                      const groupData = groupDoc.data();
                      const members = groupData.members || [];

                      // Find the selected member in the group
                      let memberIndex = members.findIndex(m => String(m.id) === String(selectedMember.id));
                      if (memberIndex === -1) {
                        const enteredName = (selectedMember.name || '').trim().toLowerCase();
                        memberIndex = members.findIndex(m => {
                          const memberName = (m.name || '').trim().toLowerCase();
                          return memberName === enteredName;
                        });
                      }
                      if (memberIndex === -1) throw new Error('Selected member not found in group.');
                      const member = members[memberIndex];

                      // Validate phone number
                      if (!member.phone && !member.phoneNumber) {
                        throw new Error('No phone number is set for this member. Please contact the group admin.');
                      }
                      
                      // Get the stored phone number from the member
                      const storedPhone = member.phone || member.phoneNumber;
                      
                      console.log('=== Phone Validation Debug ===');
                      console.log('Selected member:', selectedMember);
                      console.log('Member from group:', member);
                      console.log('Stored phone:', storedPhone);
                      console.log('Entered phone:', prefilledPhone);
                      console.log('Member phone field:', member.phone);
                      console.log('Member phoneNumber field:', member.phoneNumber);
                      
                      // Compare phone numbers using the new utility function
                      if (!comparePhoneNumbers(storedPhone, prefilledPhone)) {
                        // Debug the phone numbers
                        debugPhoneNumbers(storedPhone, prefilledPhone);
                        
                        // Provide a more helpful error message
                        const storedNormalized = normalizePhoneNumber(storedPhone);
                        const enteredNormalized = normalizePhoneNumber(prefilledPhone);
                        
                        throw new Error(
                          `Phone number does not match our records.\n\n` +
                          `Expected: ${storedPhone}\n` +
                          `Entered: ${prefilledPhone}\n\n` +
                          `Normalized expected: ${storedNormalized}\n` +
                          `Normalized entered: ${enteredNormalized}\n\n` +
                          `Please check your phone number and try again.`
                        );
                      }
                      
                      console.log('Phone validation passed!');
                      console.log('=== End Phone Validation Debug ===');

                      // Check if already joined
                      if (member.hasFullAccess || member.isGuest === false) {
                        throw new Error('You are already a member of this group');
                      }

                      // Update member
                      const updatedMember = {
                        ...member,
                        id: firebaseUid,
                        isGuest: false,
                        hasFullAccess: true,
                        joinedViaInvite: true,
                        updatedAt: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        status: 'active'
                      };
                      members[memberIndex] = updatedMember;

                      transaction.update(groupRef, {
                        members,
                        memberIds: members.map(m => m.id),
                        updatedAt: new Date().toISOString(),
                      });
                    });

                    // Update user doc in Firestore
                    const normalizedPhone = normalizePhoneNumber(prefilledPhone);
                    await setDoc(doc(db, 'users', firebaseUid), {
                      ...selectedMember,
                      id: firebaseUid,
                      isGuest: false,
                      hasFullAccess: true,
                      joinedViaInvite: true,
                      phone: normalizedPhone,
                      phoneNumber: prefilledPhone,
                      createdAt: new Date().toISOString(),
                      lastActive: new Date().toISOString(),
                      status: 'active'
                    }, { merge: true });

                    // Update AsyncStorage
                    await AsyncStorage.setItem('user', JSON.stringify({
                      ...selectedMember,
                      id: firebaseUid,
                      isGuest: false,
                      hasFullAccess: true,
                      joinedViaInvite: true,
                      phone: normalizedPhone,
                      phoneNumber: prefilledPhone
                    }));
                    await AsyncStorage.setItem('userPhone', prefilledPhone);
                    await AsyncStorage.setItem('isGuest', 'false');

                    // Wait for Firestore to sync and confirm
                    let isNowMember = false;
                    let freshGroupData = null;
                    for (let i = 0; i < 5; i++) { // Try up to 5 times
                      const freshGroupDoc = await getDoc(groupRef);
                      freshGroupData = freshGroupDoc.data();
                      isNowMember = (freshGroupData.members || []).some(m => String(m.id) === String(firebaseUid));
                      if (isNowMember) break;
                      await new Promise(res => setTimeout(res, 300)); // Wait 300ms before retry
                    }
                    if (!isNowMember) {
                      throw new Error('Failed to join group. Please try again.');
                    }

                    // Show success alert and try all navigation methods after user presses OK
                    Alert.alert(
                      'Success',
                      'You have joined the group successfully!',
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            setTimeout(() => {
                              let navigated = false;
                              try {
                                navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                                navigated = true;
                              } catch (e) { }
                              if (!navigated) {
                                try {
                                  navigation.dispatch(StackActions.replace('MainTabs'));
                                  navigated = true;
                                } catch (e) { }
                              }
                              if (!navigated) {
                                try {
                                  navigation.navigate('MainTabs');
                                  navigated = true;
                                } catch (e) { }
                              }
                              if (!navigated && navigationRef.current) {
                                try {
                                  navigationRef.current.navigate('MainTabs');
                                  navigated = true;
                                } catch (e) { }
                              }
                              if (!navigated) {
                                DevSettings.reload();
                              }
                            }, 200);
                          }
                        }
                      ]
                    );
                    return;
                  } catch (error) {
                    Alert.alert('Error', error.message || 'Failed to join group. Please try again.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                <LinearGradient
                  colors={['#FFDF3D', '#FA8500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 12 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#2D5586" />
                  ) : (
                    <Text style={{ color: '#222', fontSize: 18, fontWeight: 'bold' }}>Join Group</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4C49ED" />
        <Text style={styles.loadingText}>Processing...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Invite Members</Text>
        <Text style={styles.subtitle}>
          Choose how you want to invite members to your group
        </Text>

        {/* Email Invites Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite via Email</Text>
          {emails.map((email, index) => (
            <View key={index} style={styles.emailContainer}>
              <View style={styles.emailInputContainer}>
                <Icon name="email" type="material" color="#666" size={20} style={styles.emailIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(value) => updateEmail(index, value)}
                  placeholder="Enter email address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {emails.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeEmail(index)}
                >
                  <Icon name="close" type="material" color="#FF6B6B" size={20} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={styles.addEmailButton}
            onPress={addEmailField}
          >
            <Icon name="add" type="material" color="#4C49ED" size={20} />
            <Text style={styles.addEmailText}>Add another email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inviteButton}
            onPress={handleInvite}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.inviteButtonText}>Send Invites</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Share Link Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Invite Link</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={generateInviteLink}
            disabled={isLoading}
          >
            <Icon name="share" type="material" color="#fff" size={20} />
            <Text style={styles.shareButtonText}>Share Invite Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#23305A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  groupIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupIconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
  },
  membersSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
  },
  memberInitialContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B6AD2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberName: {
    fontSize: 16,
    color: '#fff',
  },
  adminBadge: {
    backgroundColor: '#FF4B55',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  moreMembersText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  emailInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  emailIcon: {
    marginRight: 10,
  },
  addEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
    marginTop: 5,
    marginBottom: 20,
  },
  addEmailText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inviteButton: {
    backgroundColor: '#6C63FF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#4C49ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  memberSelectionSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  memberSelectionList: {
    maxHeight: 200,
  },
  selectedMemberSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectedMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  changeMemberButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  changeMemberText: {
    color: '#FFDF3D',
    fontSize: 14,
    fontWeight: '600',
  },
  memberSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberSelectionName: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
});

export default InviteMembersScreen; 