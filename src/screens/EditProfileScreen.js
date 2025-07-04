import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView, StatusBar } from 'react-native';
import { Text, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updateEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ensureGuestName, clearGuestNameCache } from '../utils/guestNameUtils';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, updateUserState } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCreateAccountOption, setShowCreateAccountOption] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: null,
  });

  // Load user data when screen mounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const phone = await AsyncStorage.getItem('userPhone');
        const storedAvatar = await AsyncStorage.getItem('userAvatar');
        const storedName = await AsyncStorage.getItem('userName');
        
        // Get name from either displayName, stored name, or extract from email
        let userName = user?.displayName;
        if (!userName) {
          userName = storedName || user?.email?.split('@')[0] || '';
        }

        // For anonymous users, ensure they have a proper guest name
        if (user?.isAnonymous) {
          userName = await ensureGuestName(user);
        }

        // Get phone number from Firestore if available
        let userPhone = phone;
        if (user?.uid) {
          // Try to get phone from user's Firestore document
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = await userDoc.data();
            userPhone = userData.phone || phone || '';
          }

          // Try to get phone from group membership if not found above
          if (!userPhone) {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const memberGroupsQuery = query(
              collection(db, 'groups'),
              where('memberIds', 'array-contains', user.uid)
            );
            const memberGroupsSnapshot = await getDocs(memberGroupsQuery);
            let phoneFromGroup = '';
            memberGroupsSnapshot.forEach(docSnap => {
              const groupData = docSnap.data();
              const member = (groupData.members || []).find(m => m.id === user.uid);
              if (member && member.phone) {
                phoneFromGroup = member.phone;
              }
            });
            if (phoneFromGroup) {
              userPhone = phoneFromGroup;
            }
          }
        }
        
        setProfileData(prev => ({
          ...prev,
          name: userName,
          email: user?.email || '',
          phone: userPhone !== undefined && userPhone !== null ? String(userPhone) : '', // Ensure string
          avatar: storedAvatar ? { uri: storedAvatar } : null,
        }));
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please try again.');
      }
    };

    loadUserData();
  }, [user]);

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage({ uri: result.assets[0].uri });
        setIsImagePreviewVisible(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleConfirmImage = async () => {
    try {
      if (selectedImage?.uri) {
        setProfileData(prev => ({
          ...prev,
          avatar: selectedImage,
        }));
        // Save to AsyncStorage
        await AsyncStorage.setItem('userAvatar', selectedImage.uri);
        // Update Firebase Auth profile
        const currentUser = auth.currentUser;
        if (currentUser) {
          await updateProfile(currentUser, {
            photoURL: selectedImage.uri
          });
        }
        // Update Firestore user document
        if (currentUser?.uid) {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            photoURL: selectedImage.uri
          });
        }
        // Update user context
        await updateUserState({
          displayName: profileData.name,
          photoURL: selectedImage.uri
        });

        // Clear guest name cache to ensure new name is used
        clearGuestNameCache();
      }
      setIsImagePreviewVisible(false);
      setSelectedImage(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    }
  };

  // Add validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    // Basic phone validation - allows numbers, +, -, and spaces
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
  };

  // Modify handleUpdateProfile to include validations
  const handleUpdateProfile = async () => {
    if (!profileData.name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    // Validate phone if provided
    if (profileData.phone && !validatePhone(profileData.phone)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    // Validate email if changed and not empty
    if (profileData.email !== user?.email && profileData.email && !validateEmail(profileData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = auth.currentUser;

      // --- PHONE/EMAIL DUPLICATE VALIDATION ---
      if (profileData.phone) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('phone', '==', profileData.phone)
        );
        const snapshot = await getDocs(q);
        let duplicateFound = false;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          // Exclude current user and check for different email
          if (docSnap.id !== currentUser.uid && data.email && data.email !== profileData.email) {
            duplicateFound = true;
          }
        });
        if (duplicateFound) {
          setIsLoading(false);
          Alert.alert('Error', 'This phone number is already associated with another account.');
          return;
        }
      }
      // --- END DUPLICATE VALIDATION ---

      // Handle image upload if there's a new avatar
      let photoURL = profileData.avatar?.uri;
      // Only use the local file path, do not upload to Firebase Storage
      // Check if user is anonymous (guest)
      if (currentUser.isAnonymous) {
        // For guest users, only update the display name and avatar in AsyncStorage
        await AsyncStorage.setItem('userName', profileData.name);
        if (photoURL) {
          await AsyncStorage.setItem('userAvatar', photoURL);
        }
        if (profileData.phone) {
          await AsyncStorage.setItem('userPhone', profileData.phone);
        }

        // Update display name in Firebase (this is allowed for anonymous users)
        await updateProfile(currentUser, {
          displayName: profileData.name,
          photoURL: photoURL || null,
        });

        // Save/update guest user in Firestore
        if (currentUser.uid) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            displayName: profileData.name,
            phone: profileData.phone || '',
            photoURL: photoURL || null,
            isGuest: true,
            isAnonymous: true,
            updatedAt: new Date(),
          }, { merge: true });
        }

        // Update the user context
        await updateUserState({
          displayName: profileData.name,
          photoURL: photoURL || null,
        });

        // Clear guest name cache to ensure new name is used
        clearGuestNameCache();

        // After updating guest profile, update all groups created by this guest user
        const guestUid = currentUser.uid;
        const newName = profileData.name;

        // 1. Update guest groups in AsyncStorage
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        let updated = false;
        guestGroups.forEach(group => {
          if (group.createdBy && group.createdBy.id === guestUid) {
            group.createdBy.name = newName;
            updated = true;
          }
        });
        if (updated) {
          await AsyncStorage.setItem('guestGroups', JSON.stringify(guestGroups));
        }

        // 2. Update Firestore groups where createdBy.id === guestUid
        try {
          const { collection, query, where, getDocs, updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
          const groupsRef = collection(db, 'groups');
          const q = query(groupsRef, where('createdBy.id', '==', guestUid));
          const snapshot = await getDocs(q);
          for (const groupDoc of snapshot.docs) {
            await updateDoc(firestoreDoc(db, 'groups', groupDoc.id), {
              'createdBy.name': newName
            });
          }
        } catch (e) {
          // Ignore Firestore errors for guest-only users
        }

        setSuccessMessage('Your name has been updated successfully! To access more features, consider creating a full account.');
        setShowCreateAccountOption(true);
        setShowSuccessModal(true);
        return;
      }

      // For non-guest users, proceed with full profile update
      // First update Firebase profile
      await updateProfile(currentUser, {
        displayName: profileData.name,
        photoURL: photoURL || null,
      });

      // Then update AsyncStorage
      await AsyncStorage.setItem('userName', profileData.name);
      if (photoURL) {
        await AsyncStorage.setItem('userAvatar', photoURL);
      }
      if (profileData.phone) {
        await AsyncStorage.setItem('userPhone', profileData.phone);
      }

      // Update the user context
      await updateUserState({
        displayName: profileData.name,
        photoURL: photoURL || null,
      });

      // Update phone and photoURL in Firestore
      if (currentUser.uid) {
        await updateDoc(doc(db, 'users', currentUser.uid), { 
          phone: profileData.phone || '',
          photoURL: photoURL || null,
          displayName: profileData.name
        });
      }

      // Only update email if it's changed and user didn't login with email
      if (profileData.email !== user?.email && !user?.providerData?.[0]?.providerId?.includes('password')) {
        await updateEmail(currentUser, profileData.email);
      }

      // Clear guest name cache to ensure new name is used
      clearGuestNameCache();

      setSuccessMessage('Profile updated successfully!');
      setShowCreateAccountOption(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Profile update error:', error);
      // Show more user-friendly error messages
      let errorMessage = 'Failed to update profile. Please try again.';
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, please sign out and sign in again to make these changes.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use by another account.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    navigation.navigate('Signup', { guestId: user.uid });
  };

  // Modify the form to disable email and password fields for guest users
  const isGuestUser = auth.currentUser?.isAnonymous;

  // Modify the email input field to be disabled if user logged in with email
  const isEmailLogin = user?.providerData?.[0]?.providerId?.includes('password');

  // Determine if phone should be editable: only disable for users who joined via invitation
  const isPhoneEditable = !user?.joinedViaInvite;
  
  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#2D5586"
        translucent={true}
      />
      <LinearGradient
        colors={['#2D5586', '#171E45']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Profile</Text>
            </View>
          </View>

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Profile Image */}
            <View style={styles.imageContainer}>
              {profileData.avatar ? (
                <Image
                  source={profileData.avatar}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImage, styles.profileIconContainer]}>
                  <Ionicons name="person" size={60} color="#8F9BB3" />
                </View>
              )}
              <TouchableOpacity 
                style={styles.editImageButton}
                onPress={handleImagePick}
              >
                <Icon name="edit" color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Icon name="person" color="#8F9BB3" size={24} />
                <TextInput
                  style={styles.input}
                  value={profileData.name}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
                  placeholder="Name"
                  placeholderTextColor="#8F9BB3"
                  autoCapitalize="words"
                />
              </View>

              <View style={[styles.inputContainer, (isGuestUser || isEmailLogin) && styles.disabledInput]}>
                <Icon name="email" color="#8F9BB3" size={24} />
                <TextInput
                  style={styles.input}
                  value={isGuestUser ? 'guest' : profileData.email}
                  placeholder="Email"
                  placeholderTextColor="#8F9BB3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={false}
                />
              </View>

              {!isGuestUser && (
                <View style={[styles.inputContainer, !isPhoneEditable && styles.disabledInput]}>
                  <Icon name="phone" color="#8F9BB3" size={24} />
                  {isPhoneEditable ? (
                    <TextInput
                      style={styles.input}
                      value={profileData.phone}
                      onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
                      placeholder="Phone (e.g., +1234567890)"
                      placeholderTextColor="#8F9BB3"
                      keyboardType="phone-pad"
                      editable={true}
                    />
                  ) : (
                    <Text style={[styles.input, { color: '#8F9BB3', marginLeft: 15 }]}> 
                      {profileData.phone}
                    </Text>
                  )}
                </View>
              )}

              {isGuestUser && (
                <View style={styles.guestWarning}>
                  <Icon name="info" color="#FFB800" size={20} />
                  <Text style={styles.guestWarningText}>
                    Create an account to update email
                  </Text>
                </View>
              )}
            </View>

            {/* Image Preview Modal */}
            <Modal
              visible={isImagePreviewVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setIsImagePreviewVisible(false);
                setSelectedImage(null);
              }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Confirm Profile Picture</Text>
                  
                  {selectedImage && (
                    <Image
                      source={selectedImage}
                      style={styles.previewImage}
                    />
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsImagePreviewVisible(false);
                        setSelectedImage(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.confirmButton}
                      onPress={handleConfirmImage}
                    >
                      <Text style={styles.confirmButtonText}>OK</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Add extra padding at the bottom for the update button */}
            <View style={styles.buttonSpacing} />
          </ScrollView>

          {/* Update Button */}
          <View style={styles.buttonContainer}>
            {isGuestUser ? (
              <View style={styles.guestButtonContainer}>
                <TouchableOpacity 
                  style={[styles.updateButton, styles.guestUpdateButton]}
                  onPress={handleUpdateProfile}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.updateButtonText}>Update Profile</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.createAccountButton}
                  onPress={handleCreateAccount}
                >
                  <Text style={styles.createAccountText}>Create Full Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.updateButton, isLoading && styles.disabledButton]}
                onPress={handleUpdateProfile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.updateButtonText}>Update Profile</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            width: '85%',
            backgroundColor: '#233A5A',
            borderRadius: 20,
            alignItems: 'center',
            padding: 25,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10,
          }}>
            {/* Close Icon */}
            <TouchableOpacity
              style={{ position: 'absolute', top: 15, right: 15, zIndex: 2 }}
              onPress={() => setShowSuccessModal(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {/* Success Text */}
            <Text style={{
              color: '#fff',
              fontSize: 20,
              fontWeight: 'bold',
              marginTop: 10,
              marginBottom: 30,
              textAlign: 'center'
            }}>
              {successMessage}
            </Text>
            {/* Buttons */}
            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={{
                  width: '100%',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.goBack();
                }}
              >
                <LinearGradient
                  colors={['#FFD96D', '#FFA211']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderRadius: 12,
                  }}
                >
                  <Text style={{
                    color: '#222',
                    fontWeight: 'bold',
                    fontSize: 18,
                  }}>
                    OK
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {showCreateAccountOption && (
                <TouchableOpacity
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: '#FFD96D',
                  }}
                  onPress={() => {
                    setShowSuccessModal(false);
                    handleCreateAccount();
                  }}
                >
                  <View style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: 'transparent',
                  }}>
                    <Text style={{
                      color: '#FFD96D',
                      fontWeight: 'bold',
                      fontSize: 18,
                    }}>
                      Create Account
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    marginTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: '#171E45',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileIconContainer: {
    backgroundColor: '#13386B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D5586',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#13386B',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2D5586',
  },
  formContainer: {
    paddingHorizontal: 20,
    marginTop:50,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13386B',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    marginLeft: 15,
    fontSize: 16,
  },
  buttonSpacing: {
    height: 80, // Space for the update button
  },
  buttonContainer: {
    position: 'relative',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  updateButton: {
    backgroundColor: '#FFB800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#13386B',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#FFB800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledInput: {
    opacity: 0.7,
    backgroundColor: '#0B2442',
  },
  guestWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  guestWarningText: {
    color: '#FFB800',
    marginLeft: 8,
    fontSize: 14,
  },
  guestButtonContainer: {
    gap: 10,
  },
  guestUpdateButton: {
    backgroundColor: '#FFB800',
  },
  createAccountButton: {
    backgroundColor: '#2D5586',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  createAccountText: {
    color: '#FFB800',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfileScreen; 