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
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import AddFriendModal from '../components/AddFriendModal';
import RegisteredUsersModal from '../components/RegisteredUsersModal';
import NotificationTriggers from '../utils/NotificationTriggers';

const { width } = Dimensions.get('window');

const EditGroupScreen = ({ navigation, route }) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [groupData, setGroupData] = useState({
    name: '',
    description: '',
    category: 'Trip',
    categoryIconKey: 'Trip',
  });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errors, setErrors] = useState({});
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showContactListModal, setShowContactListModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const categories = [
    { name: 'Food', key: 'Food', icon: require('../../assets/category/Food.png') },
    { name: 'Drinks', key: 'Drinks', icon: require('../../assets/category/Drinks.png') },
    { name: 'Trip', key: 'Trip', icon: require('../../assets/category/trip.png') },
    { name: 'Party', key: 'Party', icon: require('../../assets/category/party.png') },
    { name: 'Groccery', key: 'Groccery', icon: require('../../assets/category/grocery.png') },
    { name: 'Gift', key: 'Gift', icon: require('../../assets/category/Gift.png') },
    { name: 'Entertainment', key: 'Entertainment', icon: require('../../assets/category/Entertainment.png') },
    { name: 'Office', key: 'Office', icon: require('../../assets/category/Office.png') },
    { name: 'Booking', key: 'Booking', icon: require('../../assets/category/Bookings.png') },
    { name: 'Travel', key: 'Travel', icon: require('../../assets/category/travel.png') },
    { name: 'Miscellaneous', key: 'Miscellaneous', icon: require('../../assets/category/misscelenous.png') },
  ];

  useEffect(() => {
    const fetchGroup = async () => {
      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (currentUser?.isAnonymous) {
          // Guest user: load from AsyncStorage
          const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
          const group = guestGroups.find(g => g.id === groupId);
          if (group) {
            setGroupData({
              name: group.name,
              description: group.description,
              category: group.category,
              categoryIconKey: group.categoryIconKey,
            });
            setMembers(group.members || []);
          }
        } else {
          // Regular user: load from Firestore
          const docRef = doc(db, 'groups', groupId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setGroupData({
              name: data.name,
              description: data.description,
              category: data.category,
              categoryIconKey: data.categoryIconKey,
            });
            setMembers(data.members || []);
          }
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load group data.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId]);

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateGroup = async () => {
    if (!validateForm()) return;
    setUpdating(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser?.isAnonymous) {
        // Guest user: update in AsyncStorage
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        const idx = guestGroups.findIndex(g => g.id === groupId);
        if (idx !== -1) {
          const oldGroup = guestGroups[idx];
          guestGroups[idx] = {
            ...guestGroups[idx],
            ...groupData,
            members,
            updatedAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem('guestGroups', JSON.stringify(guestGroups));
          
          // Send notification for group update (guest users)
          const memberIds = members.map(m => m.id);
          if (memberIds.length > 0) {
            await NotificationTriggers.sendCustomNotification(
              memberIds,
              'Group Updated',
              `"${groupData.name}" has been updated`,
              'group_updated',
              {
                screen: 'GroupDetails',
                params: { groupId }
              }
            );
          }
        }
      } else {
        // Regular user: update in Firestore
        const docRef = doc(db, 'groups', groupId);
        await updateDoc(docRef, {
          ...groupData,
          members,
          memberIds: members.map(m => m.id),
          updatedAt: new Date().toISOString(),
        });
      }
      Alert.alert('Success', 'Group updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update group.');
    } finally {
      setUpdating(false);
    }
  };

  // Add/Remove member handlers
  const handleAddFriend = async (contacts) => {
    try {
      const currentUser = auth.currentUser;
      const isGuestUser = currentUser?.isAnonymous;
      
      // Get group data for notifications
      let groupData = null;
      if (isGuestUser) {
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        groupData = guestGroups.find(g => g.id === groupId);
      }
      
      for (const contact of contacts) {
        const isAlreadyMember = members.some(member => member.id === contact.id);
        if (!isAlreadyMember) {
          setMembers(prev => [...prev, contact]);
          
          // Send notification for new member (guest users)
          if (isGuestUser && groupData) {
            await NotificationTriggers.onMemberAdded(
              groupId,
              groupData.name,
              contact.name,
              currentUser.uid,
              [contact.id]
            );
          }
        }
      }
      setShowContactListModal(false);
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };
  const handleRemoveContact = (contactId) => {
    setMembers(prev => prev.filter(member => member.id !== contactId));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#23305A' }}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={{ flex: 2, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20,marginTop:25, }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>Edit Group</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={{ color: '#fff', fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Group Name */}
            <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Group Name</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12 }}
              placeholder="Enter a group name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={groupData.name}
              onChangeText={text => setGroupData({ ...groupData, name: text })}
            />
            {errors.name && <Text style={{ color: 'red', marginBottom: 8 }}>{errors.name}</Text>}
            {/* Description */}
            <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Description</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, height: 100, textAlignVertical: 'top' }}
              placeholder="Enter a description (optional)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={groupData.description}
              multiline
              numberOfLines={4}
              onChangeText={text => setGroupData({ ...groupData, description: text })}
            />
            {/* Category */}
            <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Category</Text>
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{groupData.category}</Text>
              <Text style={{ color: '#fff', fontSize: 18, marginLeft: 8 }}>▼</Text>
            </TouchableOpacity>
            {/* Members */}
            <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {members.map((member) => (
                <View key={member.id} style={{ alignItems: 'center', marginRight: 16 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B537D', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{member.name ? member.name[0].toUpperCase() : '?'}</Text>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 12, maxWidth: 60, textAlign: 'center' }} numberOfLines={1}>{member.name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveContact(member.id)} style={{ marginTop: 2 }}>
                    <Text style={{ color: '#FF4D4F', fontSize: 12 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setShowContactListModal(true)} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFB800', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: '#222', fontSize: 28, fontWeight: 'bold' }}>+</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 12 }}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
            {/* Update Button */}
            <TouchableOpacity
              style={{ backgroundColor: '#FFB800', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 }}
              onPress={handleUpdateGroup}
              disabled={updating}
            >
              <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 18 }}>{updating ? 'Updating...' : 'Update Group'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <LinearGradient
              colors={['#2D5586', '#171E45']}
              style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: '80%' }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 5 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {categories.map((cat, idx) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={{ width: (width - 50) / 4, height: (width - 50) / 4, marginBottom: 15 }}
                      onPress={() => {
                        setGroupData({ ...groupData, category: cat.name, categoryIconKey: cat.key });
                        setShowCategoryModal(false);
                      }}
                    >
                      <LinearGradient
                        colors={['#8B6AD2', '#211E83']}
                        style={{ flex: 1, borderRadius: 15, justifyContent: 'center', alignItems: 'center', position: 'relative' }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Image source={cat.icon} style={{ width: 32, height: 32, resizeMode: 'contain', marginBottom: 5 }} />
                        <Text style={{ color: 'white', marginTop: 8, fontSize: 12, textAlign: 'center' }}>{cat.name}</Text>
                        {cat.name === groupData.category && (
                          <View style={{ position: 'absolute', top: 5, right: 5 }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>✓</Text>
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
        {/* Registered Users Modal */}
        <RegisteredUsersModal
          visible={showContactListModal}
          onClose={() => setShowContactListModal(false)}
          onSelectUsers={handleAddFriend}
        />
        {/* Add Friend Modal (for removing) */}
        <AddFriendModal
          visible={showAddFriendModal}
          onClose={() => setShowAddFriendModal(false)}
          onAddFriend={handleAddFriend}
          onRemoveContact={handleRemoveContact}
          selectedContacts={members}
        />
        {/* Loading Overlay */}
        {updating && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FFB800" />
          </View>
        )}
      </View>
    </ImageBackground>
  );
};

export default EditGroupScreen; 