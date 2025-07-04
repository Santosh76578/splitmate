import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../config/firebase';
import { doc, updateDoc, arrayUnion, Timestamp, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import NotificationTriggers from '../utils/NotificationTriggers';

const AddMemberScreen = ({ navigation, route }) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [memberData, setMemberData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  const handleAddMember = async () => {
    if (!memberData.name.trim()) {
      Alert.alert('Error', 'Please enter member name');
      return;
    }

    setLoading(true);
    try {
      const groupRef = doc(db, 'groups', groupId);
      
      // Check if member already exists in the system
      let existingUserId = null;
      if (memberData.phone || memberData.email) {
        const usersRef = collection(db, 'users');
        let userQuery;
        
        if (memberData.phone) {
          userQuery = query(usersRef, where('phone', '==', memberData.phone));
        } else if (memberData.email) {
          userQuery = query(usersRef, where('email', '==', memberData.email));
        }
        
        if (userQuery) {
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            existingUserId = userDoc.id;
          }
        }
      }

      const newMember = {
        id: existingUserId || Date.now().toString(), // Use existing user ID or temporary ID
        name: memberData.name,
        phone: memberData.phone,
        email: memberData.email,
        joinedAt: Timestamp.now(),
        role: 'member'
      };

      await updateDoc(groupRef, {
        members: arrayUnion(newMember),
        memberIds: arrayUnion(newMember.id),
        updatedAt: Timestamp.now()
      });

      // If member exists, update their user document to include this group
      if (existingUserId) {
        const userRef = doc(db, 'users', existingUserId);
        const groupData = (await getDoc(groupRef)).data();
        const groupName = groupData?.name || 'Group';
        
        await updateDoc(userRef, {
          groups: arrayUnion({
            id: groupId,
            name: groupName,
            role: 'member',
            joinedAt: Timestamp.now()
          })
        });
      }

      // Fetch group data for notification
      const groupSnap = await groupRef.get();
      let groupName = 'Group';
      let memberIds = [newMember.id];
      if (groupSnap.exists) {
        const groupData = groupSnap.data();
        groupName = groupData.name || 'Group';
        memberIds = groupData.memberIds || [newMember.id];
      }
      
      // Always notify the member being added
      await NotificationTriggers.onMemberAdded(
        groupId,
        groupName,
        newMember.name,
        user?.uid || '',
        [newMember.id]
      );

      Alert.alert('Success', 'Member added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member. Please try again.');
    } finally {
      setLoading(false);
    }
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Member</Text>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.inputContainer}>
              <Icon name="account" size={24} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Member Name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={memberData.name}
                onChangeText={(text) => setMemberData({ ...memberData, name: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Icon name="email" size={24} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email (Optional)"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                keyboardType="email-address"
                value={memberData.email}
                onChangeText={(text) => setMemberData({ ...memberData, email: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Icon name="phone" size={24} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number (Optional)"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                keyboardType="phone-pad"
                value={memberData.phone}
                onChangeText={(text) => setMemberData({ ...memberData, phone: text })}
              />
            </View>

            <TouchableOpacity 
              style={styles.addButtonContainer}
              onPress={handleAddMember}
              disabled={loading}
            >
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.addButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>{loading ? 'Adding...' : 'Add Member'}</Text>
                <Icon name="arrow-right" size={24} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 15,
    fontSize: 16,
  },
  addButtonContainer: {
    marginTop: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
});

export default AddMemberScreen; 