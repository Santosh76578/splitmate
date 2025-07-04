import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Image, Dimensions, SafeAreaView, StatusBar, TextInput, Modal, Clipboard } from 'react-native';
import { Text, Icon } from '@rneui/themed';
import { useAuth } from '../context/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RefreshableScrollView from '../components/RefreshableScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { ensureGuestName } from '../utils/guestNameUtils';
import CustomAlertModal from '../components/CustomAlertModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, deleteAccount } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: require('../../assets/avatar1.png'),
  });
  const [mergedUser, setMergedUser] = useState(user);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    icon: 'alert-circle-outline',
    iconColor: '#FFD96D'
  });

  const loadUserData = async () => {
    try {
      setIsLoadingProfile(true);
      const phone = await AsyncStorage.getItem('userPhone');
      const storedName = await AsyncStorage.getItem('userName');
      const storedAvatar = await AsyncStorage.getItem('userAvatar');

      // Get name from either displayName, stored name, or extract from email
      let userName = user?.displayName;
      if (!userName) {
        userName = storedName || user?.email?.split('@')[0] || 'User';
      }

      // For anonymous users, ensure they have a proper guest name
      if (user?.isAnonymous) {
        userName = await ensureGuestName(user);
      }

      // Handle avatar source with priority order
      let avatarSource;
      
      // First try user's photoURL from context
      if (user?.photoURL) {
        avatarSource = { uri: user.photoURL };
      }
      // Then try stored avatar
      else if (storedAvatar) {
        avatarSource = { uri: storedAvatar };
      }
      // Finally fallback to default avatar
      else {
        avatarSource = require('../../assets/avatar1.png');
      }

      // Get phone number from either user object or AsyncStorage
      const userPhone = user?.phone || phone || '';

      setUserProfile(prev => ({
        ...prev,
        name: userName,
        email: user?.email || '',
        phone: userPhone,
        avatar: avatarSource,
      }));
    } catch (error) {
      // Set default avatar on error
      setUserProfile(prev => ({
        ...prev,
        avatar: require('../../assets/avatar1.png'),
      }));
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    }
    
    // Add focus listener to reload data when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        loadUserData();
      }
    });

    // Fetch user data from Firestore
    const fetchUserFromFirestore = async (uid) => {
      if (!uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Create merged user data with proper flags
          const mergedUserData = {
            ...user,
            ...userData,
            email: user?.email || userData.email || '', // Always prefer context user email
            // Only use the actual joinedViaInvite field, not hasFullAccess
            joinedViaInvite: userData.joinedViaInvite || false,
            phone: userData.phone || user.phone || '',
            displayName: userData.displayName || user.displayName || '',
            photoURL: userData.photoURL || user.photoURL || null,
            isAnonymous: userData.isAnonymous || user.isAnonymous || false,
            hasFullAccess: userData.hasFullAccess || false
          };
          
          setMergedUser(mergedUserData);
          // Don't override the profile data here to prevent blinking
        }
      } catch (error) {
        // Handle error silently
      }
    };
    
    if (user?.uid) {
      fetchUserFromFirestore(user.uid);
    }

    return unsubscribe;
  }, [user, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserData();
    } catch (error) {
      setCustomAlert({
        visible: true,
        title: 'Error',
        message: 'Failed to refresh data. Please try again.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {}
          }
        ],
        icon: 'alert-circle-outline',
        iconColor: '#FF6B6B'
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLogout = () => {
    setCustomAlert({
      visible: true,
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              setCustomAlert({
                visible: true,
                title: 'Error',
                message: 'Failed to log out. Please try again.',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => {}
                  }
                ],
                icon: 'alert-circle-outline',
                iconColor: '#FF6B6B'
              });
            }
          },
        },
      ],
      icon: 'logout',
      iconColor: '#FFD96D'
    });
  };

  const handleDeleteAccount = () => {
    if (user?.isAnonymous) {
      // For guest users, show a simple confirmation dialog
      setCustomAlert({
        visible: true,
        title: 'Delete Account',
        message: 'This will permanently delete your guest account and all associated data.',
        buttons: [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            onPress: async () => {
              try {
                setIsDeleting(true);
                // Delete guest data from AsyncStorage
                await AsyncStorage.removeItem('userPhone');
                await AsyncStorage.removeItem('userName');
                await AsyncStorage.removeItem('userAvatar');
                await AsyncStorage.removeItem('guestGroups');
                
                // Sign out the guest user
                await auth.signOut();
                
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Auth' }] } }],
                  })
                );
              } catch (error) {
                setCustomAlert({
                  visible: true,
                  title: 'Error',
                  message: 'Failed to delete account. Please try again.',
                  buttons: [
                    {
                      text: 'OK',
                      onPress: () => {}
                    }
                  ],
                  icon: 'alert-circle-outline',
                  iconColor: '#FF3B30'
                });
              } finally {
                setIsDeleting(false);
              }
            }
          }
        ],
        icon: 'delete-forever',
        iconColor: '#FF3B30'
      });
    } else {
      // For regular users, show the password modal
      setIsDeleteModalVisible(true);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setCustomAlert({
        visible: true,
        title: 'Error',
        message: 'Please enter your password to confirm deletion',
        buttons: [
          {
            text: 'OK',
            onPress: () => {}
          }
        ],
        icon: 'alert-circle-outline',
        iconColor: '#FF6B6B'
      });
      return;
    }

    try {
      setIsDeleting(true);
      const result = await deleteAccount(deletePassword);
      
      if (result.success) {
        setIsDeleteModalVisible(false);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Auth' }] } }],
          })
        );
      } else {
        setCustomAlert({
          visible: true,
          title: 'Error',
          message: 'Incorrect Password. Please try again.',
          buttons: [
            {
              text: 'OK',
              onPress: () => {}
            }
          ],
          icon: 'alert-circle-outline',
          iconColor: '#FF6B6B'
        });
      }
    } catch (error) {
      setCustomAlert({
        visible: true,
        title: 'Error',
        message: 'Incorrect Password. Please try again.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {}
          }
        ],
        icon: 'alert-circle-outline',
        iconColor: '#FF6B6B'
      });
    } finally {
      setIsDeleting(false);
      setDeletePassword('');
    }
  };

  const handleNavigateToSignup = () => {
    navigation.navigate('Signup', { guestId: user.uid });
  };

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
              <Text style={styles.headerTitle}>Profile</Text>
            </View>
          </View>

          <RefreshableScrollView
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.profileCard}>
              {userProfile.avatar && userProfile.avatar.uri ? (
                <Image
                  source={userProfile.avatar}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.profileIconContainer]}>
                  <Ionicons name="person" size={60} color="#8F9BB3" />
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                {isLoadingProfile ? (
                  <View style={styles.nameLoadingContainer}>
                    <ActivityIndicator size="small" color="#FFB800" />
                    <Text style={[styles.name, styles.loadingText]}>Loading...</Text>
                  </View>
                ) : (
                  <Text style={styles.name}>{userProfile.name}</Text>
                )}
                {mergedUser && !mergedUser.isAnonymous && mergedUser.joinedViaInvite && (
                  <View style={styles.memberTag}>
                    <Text style={styles.memberTagText}>Member</Text>
                  </View>
                )}
                {mergedUser?.isAnonymous && (
                  <View style={styles.badgeGuest}>
                    <Text style={styles.badgeText}>Guest</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{userProfile.email}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
                <View style={styles.menuItemContent}>
                  <Icon name="edit" color="#FFF" size={24} />
                  <Text style={styles.menuItemText}>Edit Profile</Text>
                </View>
                <Icon name="chevron-right" color="#8F9BB3" size={24} />
              </TouchableOpacity>
              {/* {user?.isAnonymous && !mergedUser?.hasFullAccess && (
                <TouchableOpacity 
                  style={[styles.menuItem, styles.createAccountItem]} 
                  onPress={() => navigation.navigate('Signup', { guestId: user.uid })}
                >
                  <View style={styles.menuItemContent}>
                    <Icon name="add" color="#FFB800" size={24} />
                    <Text style={[styles.menuItemText, styles.createAccountText]}>
                      Create Full Account
                    </Text>
                  </View>
                  <Icon name="chevron-right" color="#8F9BB3" size={24} />
                </TouchableOpacity>
              )} */}
            </View>
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('Notifications')}
              >
                <View style={styles.menuItemContent}>
                  <Icon name="notifications" color="#FFF" size={24} />
                  <Text style={styles.menuItemText}>Notifications</Text>
                </View>
                <Icon name="chevron-right" color="#8F9BB3" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.dangerSection}>
              <TouchableOpacity style={styles.dangerMenuItem} onPress={handleDeleteAccount}>
                <View style={styles.menuItemContent}>
                  <Icon name="delete" color="#FF3B30" size={24} />
                  <Text style={styles.dangerMenuItemText}>Delete Account</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </RefreshableScrollView>

          {/* Delete Account Modal */}
          <Modal
            visible={isDeleteModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsDeleteModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Delete Account</Text>
                <Text style={styles.modalText}>
                  Warning: Deleting your account will permanently remove all your data and cannot be recovered.
                  To proceed, please enter your password below.
                </Text>
                
                <View style={styles.passwordContainer}>
                  <Icon name="lock" color="#8F9BB3" size={24} />
                  <TextInput
                    style={styles.passwordInput}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#8F9BB3"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsDeleteModalVisible(false);
                      setDeletePassword('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.deleteButton, isDeleting && styles.disabledButton]}
                    onPress={confirmDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Delete Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <CustomAlertModal
            visible={customAlert.visible}
            title={customAlert.title}
            message={customAlert.message}
            buttons={customAlert.buttons}
            icon={customAlert.icon}
            iconColor={customAlert.iconColor}
            onClose={() => setCustomAlert({ ...customAlert, visible: false })}
          />
        </SafeAreaView>
      </LinearGradient>
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
  headerIcons: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#13386B',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#8F9BB3',
  },
  section: {
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#13386B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 15,
  },
  dangerSection: {
    marginTop: 5,
    marginBottom: 20,
  },
  dangerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13386B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  dangerMenuItemText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 15,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  phone: {
    fontSize: 16,
    color: '#8F9BB3',
    marginTop: 5,
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
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    color: '#FFF',
    marginLeft: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  profileIconContainer: {
    backgroundColor: '#13386B',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#FFB800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  createAccountItem: {
    backgroundColor: '#1A2B4D',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  createAccountText: {
    color: '#FFB800',
  },
  badgeAdmin: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeMember: {
    backgroundColor: '#4C49ED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeGuest: {
    backgroundColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  memberTag: {
    backgroundColor: '#4C49ED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  memberTagText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#8F9BB3',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#13386B',
    borderRadius: 10,
    padding: 15,
    color: '#FFF',
  },
  nameLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    opacity: 0.7,
  },
});

export default ProfileScreen; 