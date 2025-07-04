import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  StatusBar,
  ImageBackground,
  Dimensions,
  Clipboard,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, setDoc, getDoc, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { auth } from '../config/firebase';
import AddFriendModal from '../components/AddFriendModal';
import RegisteredUsersModal from '../components/RegisteredUsersModal';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WaveBottom from '../../assets/wave-bottom.png'; // adjust path if needed
import { v4 as uuidv4 } from 'uuid';
import NotificationTriggers from '../utils/NotificationTriggers';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { normalizePhoneNumber, comparePhoneNumbers } from '../utils/phoneUtils';
import { ensureGuestName } from '../utils/guestNameUtils';

const { width } = Dimensions.get('window');
const MEMBER_WIDTH = 100;
const itemSize = (width - 50) / 4; // 3 items per row with spacing

const CreateGroupScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [groupData, setGroupData] = useState({
    name: '',
    description: '',
    category: 'Trip',
    categoryIconKey: 'Trip',
  });
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showRegisteredUsersModal, setShowRegisteredUsersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const memberBackgrounds = [
    require('../../assets/Multiplier.png'),
    require('../../assets/Multiplier-2.png'),
    require('../../assets/Multiplier-3.png'),
    require('../../assets/Multiplier-4.png'),
  ];

  const categories = [
    { id: 1, name: 'Food', key: 'Food', icon: require('../../assets/category/Food.png') },
    { id: 2, name: 'Drinks', key: 'Drinks', icon: require('../../assets/category/Drinks.png') },
    { id: 3, name: 'Trip', key: 'Trip', icon: require('../../assets/category/trip.png') },
    { id: 4, name: 'Party', key: 'Party', icon: require('../../assets/category/party.png') },
    { id: 5, name: 'Groccery', key: 'Groccery', icon: require('../../assets/category/grocery.png') },
    { id: 6, name: 'Gift', key: 'Gift', icon: require('../../assets/category/Gift.png') },
    { id: 7, name: 'Entertainment', key: 'Entertainment', icon: require('../../assets/category/Entertainment.png') },
    { id: 8, name: 'Office', key: 'Office', icon: require('../../assets/category/Office.png') },
    { id: 9, name: 'Booking', key: 'Booking', icon: require('../../assets/category/Bookings.png') },
    { id: 10, name: 'Travel', key: 'Travel', icon: require('../../assets/category/travel.png') },
    { id: 11, name: 'Miscellaneous', key: 'Miscellaneous', icon: require('../../assets/category/misscelenous.png') },
  ];

  const defaultCategory = categories.find(cat => cat.name === 'Trip');

  const getRandomBackground = () => {
    return memberBackgrounds[Math.floor(Math.random() * memberBackgrounds.length)];
  };

  const handleAddFriend = async (users) => {
    const currentUser = auth.currentUser;
    
    for (const user of users) {
      // Check if user is already in members
      const isAlreadyMember = members.some(member => member.id === user.id);
      if (!isAlreadyMember) {
        const phoneNumber = user.phoneNumber || user.phone || '';
        // Use the new phone normalization function
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        const newMember = {
          id: user.id,
          name: user.displayName || user.name || 'Unknown',
          phoneNumber: phoneNumber, // Keep original format for display
          phone: normalizedPhone, // Store normalized version for comparison
          email: user.email || '',
          displayName: (user.displayName || user.name || 'Unknown').substring(0, 8),
          background: getRandomBackground(),
        };
        setMembers(prevMembers => [...prevMembers, newMember]);
        setSelectedUsers(prevUsers => [...prevUsers, user]);
      }
    }
    setShowRegisteredUsersModal(false);
  };

  const handleRemoveContact = (userId) => {
    setMembers(prevMembers => prevMembers.filter(member => member.id !== userId));
    setSelectedUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
  };

  const getRandomColor = () => {
    const colors = ['#7CFF6B', '#FFA73B', '#FFB23B', '#95FF6B', '#FF5C3B'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!groupData.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (groupData.name.trim().length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    }
    
    if (!groupData.category) {
      newErrors.category = 'Please select a category';
    }

    if (members.length === 0) {
      newErrors.members = 'Please add at least one member';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Function to check for duplicate group name
  const checkDuplicateGroupName = async (groupName) => {
    const currentUser = auth.currentUser;
    if (currentUser?.isAnonymous) {
      // Guest user: check AsyncStorage
      const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
      return guestGroups.some(g => g.name.trim().toLowerCase() === groupName.trim().toLowerCase());
    } else {
      // Logged-in user: check Firestore for groups created by this user
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      return groupsSnapshot.docs.some(doc =>
        doc.data().name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
        doc.data().createdBy?.id === currentUser.uid
      );
    }
  };

  const handleCreateGroup = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate all required fields
      if (!validateForm()) {
        setLoading(false);
        return;
      }

      // Check for duplicate group name
      const isDuplicate = await checkDuplicateGroupName(groupData.name);
      if (isDuplicate) {
        setError('A group with this name already exists.');
        Alert.alert('Duplicate Group', 'You already have a group with this name. Please choose a different name.', [
          {
            text: 'OK',
            onPress: () => {
              setLoading(false);
            }
          }
        ]);
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        setLoading(false);
        setError('User not authenticated. Please log in again.');
        return;
      }
      const isGuestUser = currentUser.isAnonymous;
      
      // Get user data from AsyncStorage for guest users
      let userName;
      if (isGuestUser) {
        userName = await ensureGuestName(currentUser);
      } else {
        userName = currentUser.displayName || currentUser.email.split('@')[0];
      }
      const userPhone = await AsyncStorage.getItem('userPhone') || '';
      const userAvatar = await AsyncStorage.getItem('userAvatar') || currentUser.photoURL;

      // Prepare member details - ensure unique IDs
      const memberDetails = members.map(member => ({
        id: member.id, // do not replace creator's id with uuid
        name: member.name,
        phoneNumber: member.phoneNumber, // Keep original format for display
        phone: member.phone, // Use normalized version for comparison
        email: member.email || '',
        avatar: member.avatar || null,
        role: 'member',
        joinedAt: new Date().toISOString()
      }));

      // Add creator to members if not already included
      if (!memberDetails.some(m => m.id === currentUser.uid)) {
        const userPhoneNormalized = normalizePhoneNumber(userPhone);
        memberDetails.push({
          id: currentUser.uid,
          name: userName,
          phoneNumber: userPhone, // Keep original format for display
          phone: userPhoneNormalized, // Use normalized version for comparison
          email: isGuestUser ? '' : currentUser.email,
          avatar: userAvatar ? { uri: userAvatar } : null,
          role: 'admin',
          joinedAt: new Date().toISOString()
        });
      }

      // Create group document
      const groupDataToCreate = {
        name: groupData.name,
        description: groupData.description || '',
        category: groupData.category,
        categoryIconKey: groupData.categoryIconKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: {
          id: currentUser.uid,
          name: userName,
          phoneNumber: userPhone, // Keep original format for display
          phone: normalizePhoneNumber(userPhone), // Use normalized version for comparison
          email: isGuestUser ? '' : currentUser.email,
          avatar: userAvatar ? { uri: userAvatar } : null
        },
        members: memberDetails,
        memberIds: memberDetails.map(m => m.id),
        expenses: [],
        settings: {
          allowMemberAdd: true,
          allowMemberRemove: true,
          allowExpenseAdd: true,
          allowExpenseEdit: true,
          allowExpenseDelete: true
        }
      };

      let groupRef;

      // Always create group in Firestore, even for guest users
      try {
        // First create the group
        groupRef = await addDoc(collection(db, 'groups'), groupDataToCreate);

        // Then update the user's groups array
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // Update existing user document
          await updateDoc(userDocRef, {
            groups: arrayUnion({
              id: groupRef.id,
              name: groupData.name,
              role: 'admin',
              joinedAt: Timestamp.now()
            })
          });
        } else {
          // Create new user document
          await setDoc(userDocRef, {
            groups: [{
              id: groupRef.id,
              name: groupData.name,
              role: 'admin',
              joinedAt: Timestamp.now()
            }]
          });
        }

        // Send notification to group members (excluding creator)
        const memberIdsToNotify = memberDetails
          .filter(member => member.id !== currentUser.uid)
          .map(member => member.id);

        // Update existing users' documents to include this group
        for (const member of memberDetails) {
          if (member.id !== currentUser.uid) {
            // Check if this is an existing user (not a temporary ID)
            const userDocRef = doc(db, 'users', member.id);
            try {
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                await updateDoc(userDocRef, {
                  groups: arrayUnion({
                    id: groupRef.id,
                    name: groupData.name,
                    role: 'member',
                    joinedAt: Timestamp.now()
                  })
                });
              }
            } catch (error) {
              // Handle error silently
            }
          }
        }

        if (memberIdsToNotify.length > 0) {
          await NotificationTriggers.onGroupCreated(
            groupRef.id,
            groupData.name,
            currentUser.uid,
            memberIdsToNotify,
            groupDataToCreate.categoryIconKey || groupDataToCreate.category || 'Miscellaneous'
          );
        }

        // Send notification to the creator
        await NotificationTriggers.onGroupCreated(
          groupRef.id,
          groupData.name,
          currentUser.uid,
          [currentUser.uid],
          groupDataToCreate.categoryIconKey || groupDataToCreate.category || 'Miscellaneous'
        );

      } catch (error) {
        throw new Error('Failed to create group in database');
      }

      // Show simple success alert and navigate back
      setShowSuccessModal(true);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (category) => {
    setGroupData({ ...groupData, category: category.name, categoryIconKey: category.key });
    setShowCategoryModal(false);
  };

  const formatCategoryName = (name, maxLen = 7) => {
    if (!name) return '';
    if (name.length > maxLen) {
      const spaceIdx = name.indexOf(' ', maxLen - 2);
      if (spaceIdx !== -1 && spaceIdx < name.length - 1) {
        return name.slice(0, spaceIdx) + '\n' + name.slice(spaceIdx + 1);
      }
      return name.slice(0, maxLen) + '\n' + name.slice(maxLen);
    }
    return name;
  };

  return (
    <>
      <ImageBackground
        source={require('../../assets/background.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={styles.safeArea}>
            <View style={{ flex: 1, position: 'relative' }}>
              {/* Header with back button */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Group</Text>
                <View style={styles.headerSpacer} />
              </View>
              
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.logoSection}>
                  <Image
                    source={require('../../assets/Group28.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <MaskedView
                    style={{ height: 60 }}
                    maskElement={
                      <Text style={styles.logoText}>
                        Splitmate
                      </Text>
                    }
                  >
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    >
                      <Text style={[styles.logoText, { opacity: 0 }]}>
                        Splitmate
                      </Text>
                    </LinearGradient>
                  </MaskedView>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Group Name</Text>
                  <TextInput
                    style={[styles.input, errors.name && styles.inputError]}
                    placeholder="Enter a group name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={groupData.name}
                    onChangeText={(text) => {
                      setGroupData({ ...groupData, name: text });
                      if (errors.name) {
                        setErrors({ ...errors, name: null });
                      }
                    }}
                  />
                  {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.descriptionInput]}
                    placeholder="Write description"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    multiline
                    numberOfLines={4}
                    value={groupData.description}
                    onChangeText={(text) => setGroupData({ ...groupData, description: text })}
                  />
                </View>

                <View style={styles.inviteSection}>
                  <Text style={styles.sectionTitle}>Add Friend</Text>
                  {errors.members && <Text style={styles.errorText}>{errors.members}</Text>}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {members.map((member) => (
                      <View key={member.id} style={styles.memberWrapper}>
                        <View style={styles.memberShadow}>
                          <ImageBackground
                            source={member.background}
                            style={styles.memberContent}
                          >
                            <View style={styles.notch} />
                            <View style={styles.memberChip}>
                              <Text style={styles.memberName}>{member.displayName}</Text>
                            </View>
                          </ImageBackground>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.addFriendWrapper}
                    onPress={() => {
                      setShowRegisteredUsersModal(true);
                    }}
                  >
                    <LinearGradient
                      colors={['#FFD96D', '#FFA211']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.addFriendButton}
                    >
                      <ImageBackground
                        source={require('../../assets/wave-pattern.png')}
                        style={styles.waveBackground}
                        resizeMode="stretch"
                      >
                        <Text style={styles.addFriendText}>Add Friend</Text>
                      </ImageBackground>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Top Row: Left, Middle, Right */}
                <View style={styles.rowContainer}>
                  {/* Left Box */}
                  <LinearGradient
                      colors={['#6C47F5', '#3B2A8C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.categoryBox}
                    >
                      <Text style={styles.categoryBoxTitle}>Category</Text>
                      <TouchableOpacity 
                        style={styles.categoryOption}
                        onPress={() => handleSelectCategory({ name: 'Trip', key: 'Trip' })}
                      >
                        <Image source={require('../../assets/category/trip.png')} style={styles.categoryIcon} />
                        <Text style={styles.optionText}>Trip</Text>
                        {groupData.category === 'Trip' && (
                          <View style={styles.checkmarkBox}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.categorySeparator} />
                      <TouchableOpacity 
                        style={styles.categoryOption}
                        onPress={() => handleSelectCategory({ name: 'Party', key: 'Party' })}
                      >
                        <Image source={require('../../assets/category/party.png')} style={styles.categoryIcon} />
                        <Text style={styles.optionText}>Party</Text>
                        {groupData.category === 'Party' && (
                          <View style={styles.checkmarkBox}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.categorySeparator} />
                      {groupData.category && groupData.category !== 'Trip' && groupData.category !== 'Party' ? (
                        <TouchableOpacity 
                          style={styles.categoryOption}
                          onPress={() => setShowCategoryModal(true)}
                        >
                          <Image source={categories.find(cat => cat.name === groupData.category)?.icon || require('../../assets/category/misscelenous.png')} style={styles.categoryIcon} />
                          <Text style={styles.optionText}>{formatCategoryName(groupData.category)}</Text>
                          <View style={styles.checkmarkBox}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={styles.categoryOption}
                          onPress={() => setShowCategoryModal(true)}
                        >
                          <Image source={require('../../assets/category/misscelenous.png')} style={styles.categoryIcon} />
                          <Text style={styles.optionText}>Other</Text>
                          {groupData.category && groupData.category !== 'Trip' && groupData.category !== 'Party' && (
                            <View style={styles.checkmarkBox}>
                              <Text style={styles.checkmarkText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )}
                    </LinearGradient>

                  {/* Center Circle */}
                  <View style={styles.circleContainer}>
                    <TouchableOpacity 
                      style={styles.createButton}
                      onPress={handleCreateGroup}
                    >
                      <Text style={styles.createText}>CREATE</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Right Box */}
                  <LinearGradient
                    colors={['#6C47F5', '#3B2A8C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.memberBox}
                  >
                    <View style={styles.memberBoxRow}>
                      <Text style={styles.memberBoxNumberMembers}>{members.length}</Text>
                      <Text style={styles.memberBoxLabel}> Members</Text>
                    </View>
                    <View style={styles.memberBoxSeparator} />
                    <View style={styles.memberBoxRow}>
                      <Text style={styles.memberBoxNumberExpenses}>0</Text>
                      <Text style={styles.memberBoxLabel}> Expenses</Text>
                    </View>
                  </LinearGradient>
                </View>
              </ScrollView>
              <View style={styles.waveContainer}>
                <TouchableOpacity 
                  style={styles.waveButton}
                  onPress={() => {
                    // Add your navigation or action here
                  }}
                >
                  <Svg height="150" width={Dimensions.get('window').width} viewBox="0 0 400 150" preserveAspectRatio="none" style={styles.waveSvg}>
                    <Defs>
                      <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#8B6AD2" stopOpacity="1" />
                        <Stop offset="1" stopColor="#211E83" stopOpacity="1" />
                      </SvgLinearGradient>
                      <SvgLinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#3A8DFF" stopOpacity="0.25" />
                        <Stop offset="1" stopColor="#3A8DFF" stopOpacity="0.05" />
                      </SvgLinearGradient>
                    </Defs>
                    {/* Blue glow behind the main wave */}
                    <Path
                      d="M0,90 C100,10 150,10 100,60 C250,120 300,20 400,30 L400,150 L0,150 Z"
                      fill="url(#glow)"
                      filter="url(#blur)"
                    />
                    {/* Main wave shape */}
                    <Path
                      d="M0,80 C100,0 150,0 200,40 C250,100 300,50 400,5 L400,150 L0,150 Z"
                      fill="url(#grad)"
                    />
                  </Svg>
                  <Text style={styles.waveText}>Add Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>

      <RegisteredUsersModal
        visible={showRegisteredUsersModal}
        onClose={() => setShowRegisteredUsersModal(false)}
        onSelectUsers={handleAddFriend}
        selectedUsers={selectedUsers}
      />

      <AddFriendModal
        visible={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onAddFriend={handleAddFriend}
        onRemoveContact={handleRemoveContact}
        selectedContacts={selectedUsers}
      />

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#2D5586', '#171E45']}
            style={styles.modalContent}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.iconText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryList}>
              <View style={styles.gridContainer}>
                {categories.map((category, idx) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryItem,
                      (idx + 1) % 4 === 0 && { marginRight: 0 }
                    ]}
                    onPress={() => handleSelectCategory(category)}
                  >
                    <LinearGradient
                      colors={['#8B6AD2', '#211E83']}
                      style={styles.categoryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Image source={category.icon} style={{ width: 32, height: 32, resizeMode: 'contain', marginBottom: 5 }} />
                      <Text style={styles.categoryName}>{category.name}</Text>
                      {category.name === groupData.category && (
                        <View style={styles.selectedIndicator}>
                          <Text style={styles.iconText}>✓</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

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
              onPress={() => {
                setShowSuccessModal(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', state: { routes: [{ name: 'GroupsTab' }] } }],
                });
              }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {/* Success Text */}
            <Text style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 'bold',
              marginTop: 10,
              marginBottom: 30,
              textAlign: 'center'
            }}>
              Group Created Successfully!
            </Text>
            {/* Great Button */}
            <TouchableOpacity
              style={{
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
              }}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', state: { routes: [{ name: 'GroupsTab' }] } }],
                });
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
                  Great
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
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
    paddingTop: 10,
    marginTop: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopWidth: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 5,
  },
  logoSection: {
    marginBottom: 30,
    alignItems: 'flex-start',
    paddingHorizontal: 5,
  },
  logo: {
    width: 100,
    height: 30,
    marginBottom: 5,
  },
  logoText: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputSection: {
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  label: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  descriptionInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  inviteSection: {
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 15,
  },
  memberWrapper: {
    marginRight: 10,
    marginBottom: 10,
    padding: 3,
  },
  memberShadow: {
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  memberContent: {
    width: 120,
    height: 60,
    overflow: 'hidden',
    borderRadius: 5,
  },
  notch: {
    height: 25,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    marginTop: -15,
    transform: [{ scaleX: 1.2 }],
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#FFD700',
  },
  memberChip: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    alignItems: 'center',
    marginTop: -10,
  },
  memberName: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    paddingTop:10,
  },
  addFriendWrapper: {
    borderRadius: 15,
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  addFriendButton: {
    borderRadius: 15,
  },
  waveBackground: {
    width: '100%',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 5,
    marginBottom: 0,
  },
  sideBox: {
    backgroundColor: '#5f27cd',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    width: 120,
    height:180,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    paddingBottom:10,
    borderBottomWidth:1,
    borderColor:'#DBDBDBBD',
  },
  optionText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
  circleContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 35,
    overflow: 'hidden',
    borderWidth:10,
    borderColor:'#FFA211',
    borderRadius:100,
    shadowColor: '#888',
  },
  createButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    width: 100,
    height: 100,
    borderRadius: 100,
    shadowColor: '#888',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  createText: {
    fontWeight: 900,
    fontStyle:'italic',
    color: '#FFA211',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  statText: {
    fontWeight: '600',
    fontSize: 14,
    marginVertical: 12,
  },
  waveContainer: {
    height: 100,
    position: 'relative',
    left: 0,
    right: 0,
    zIndex:1000
  },
  waveButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  waveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    position: 'absolute',
    top: 50,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  categoryBox: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'stretch',
    borderWidth:1,
    borderColor:'#fff',
  },
  categoryBoxTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
    marginLeft: 0,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 0,
    minHeight: 32,
    marginLeft:-8,
  },
  categoryIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    marginRight: 0,
  },
  checkmarkBox: {
    backgroundColor: '#3DDC5A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    minWidth: 22,
    minHeight: 22,
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  categorySeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 2,
    marginLeft: 2,
    marginRight: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  categoryList: {
    padding: 5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  categoryItem: {
    width: itemSize,
    height: itemSize,
    marginBottom: 15,
    marginRight: 10,
  },
  categoryGradient: {
    flex: 1,
    borderRadius: 15,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  categoryName: {
    color: 'white',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  inputError: {
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberBox: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    width: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    minHeight: 148,
  },
  memberBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 32,
    marginLeft: 2,
  },
  memberBoxNumberMembers: {
    color: '#ff6b81',
    fontWeight: 'bold',
    fontSize: 18,
  },
  memberBoxNumberExpenses: {
    color: '#feca57',
    fontWeight: 'bold',
    fontSize: 18,
  },
  memberBoxLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  memberBoxSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 6,
    marginLeft: 2,
    marginRight: 2,
  },
  waveSvg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default CreateGroupScreen; 