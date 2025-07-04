import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RegisteredUsersModal = ({ visible, onClose, onSelectUsers, selectedUsers = [] }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(selectedUsers.map(u => u.id));

  useEffect(() => {
    if (visible) {
      loadRegisteredUsers();
    } else {
      setUsers([]);
      setFilteredUsers([]);
    }
  }, [visible]);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadRegisteredUsers = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      // Get all users from Firestore (including guests)
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const usersList = snapshot.docs
        .map(doc => {
          const userData = doc.data();
          // Improve name fallback logic
          let displayName = userData.displayName || userData.name;
          
          // If no display name, try to extract from email
          if (!displayName && userData.email && userData.email !== 'guest') {
            displayName = userData.email.split('@')[0];
            // Capitalize first letter
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
          }
          
          // If still no name, use a default
          if (!displayName) {
            displayName = 'User';
          }
          
          return {
            id: doc.id,
            ...userData,
            displayName: displayName // Override with improved name
          };
        })
        .filter(user => user.id !== currentUser.uid); // Exclude current user
      
      setUsers(usersList);
      setFilteredUsers(usersList);
    } catch (error) {
      console.error('Error loading registered users:', error);
      // Set empty arrays on error
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => {
      const name = (user.displayName || user.name || '').toLowerCase();
      const phone = (user.phoneNumber || user.phone || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
    
    setFilteredUsers(filtered);
  };

  const toggleUserSelection = (user) => {
    const isSelected = selectedUserIds.includes(user.id);
    let newSelectedIds;
    
    if (isSelected) {
      newSelectedIds = selectedUserIds.filter(id => id !== user.id);
    } else {
      newSelectedIds = [...selectedUserIds, user.id];
    }
    
    setSelectedUserIds(newSelectedIds);
  };

  const handleConfirm = () => {
    const selectedUsersList = users.filter(user => selectedUserIds.includes(user.id));
    onSelectUsers(selectedUsersList);
    onClose();
  };

  const renderUserItem = (user) => {
    const isSelected = selectedUserIds.includes(user.id);
    const hasPhone = !!(user.phoneNumber || user.phone);
    const isGuest = user.isGuest || user.isAnonymous;
    
    // Use the improved displayName logic
    const displayName = user.displayName || user.name || 'User';
    
    return (
      <TouchableOpacity
        key={user.id}
        style={[styles.userItem, isSelected && styles.selectedUserItem]}
        onPress={() => toggleUserSelection(user)}
      >
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>
              {displayName[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>
                {displayName}
              </Text>
              {isGuest && (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeText}>Guest</Text>
                </View>
              )}
            </View>
            {hasPhone && (
              <Text style={styles.userPhone}>
                {user.phoneNumber || user.phone}
              </Text>
            )}
            {user.email && user.email !== 'guest' && (
              <Text style={styles.userEmail}>{user.email}</Text>
            )}
          </View>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#2D5586', '#171E45']}
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add Friends & Users</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, phone, or email..."
                  placeholderTextColor="#fff"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#8B6AD2" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.content}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFD96D" />
                  <Text style={styles.loadingText}>Loading registered users...</Text>
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#8B6AD2" />
                  <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No users found' : 'No users available'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery 
                      ? 'Try adjusting your search terms'
                      : `Total users available: ${users.length}`
                    }
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.usersList} showsVerticalScrollIndicator={false}>
                  {filteredUsers.map(renderUserItem)}
                </ScrollView>
              )}
            </View>

            <View style={styles.footer}>
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionText}>
                  {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.confirmButton, selectedUserIds.length === 0 && styles.disabledButton]}
                onPress={handleConfirm}
                disabled={selectedUserIds.length === 0}
              >
                <LinearGradient
                  colors={['#FFD96D', '#FFA211']}
                  style={styles.confirmButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmButtonText}>
                    Add {selectedUserIds.length} Friend{selectedUserIds.length !== 1 ? 's' : ''}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 20,
    paddingTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8B6AD2',
    textAlign: 'center',
    lineHeight: 20,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  selectedUserItem: {
    backgroundColor: 'rgba(255, 217, 109, 0.2)',
    borderColor: '#FFD96D',
    borderWidth: 1,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B6AD2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userPhone: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 2,
  },
  userEmail: {
    color: '#FFD96D',
    fontSize: 12,
  },
  guestBadge: {
    backgroundColor: '#FFD96D',
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 5,
  },
  guestBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  guestNote: {
    color: '#8B6AD2',
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B6AD2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#FFD96D',
    borderColor: '#FFD96D',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectionInfo: {
    marginBottom: 15,
  },
  selectionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RegisteredUsersModal; 