import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Image,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import CategoryGrid from '../components/CategoryGrid';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import RegisteredUsersModal from '../components/RegisteredUsersModal';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import NotificationTriggers from '../utils/NotificationTriggers';

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

const EditExpenseInsideGroup = ({ navigation, route }) => {
  const { expenseId, groupId } = route.params || {};
  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
    category: '',
    paidBy: '',
    paidById: '',
    splitMethod: 'Equally',
    image: null,
    date: new Date().toISOString(),
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPaidByModal, setShowPaidByModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showContactListModal, setShowContactListModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [splitError, setSplitError] = useState('');
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [originalAmount, setOriginalAmount] = useState(null);

  // Fetch expense data on mount
  useEffect(() => {
    const fetchExpense = async () => {
      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        const isGuestUser = currentUser?.isAnonymous;
        let expense = null;
        
        if (isGuestUser) {
          // First try to find expense in AsyncStorage (legacy guest expenses)
          const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
          expense = guestExpenses.find(e => e.id === expenseId);
          
          // If not found in AsyncStorage, try Firestore (new guest expenses)
          if (!expense) {
            try {
              const expenseRef = doc(db, 'expenses', expenseId);
              const expenseSnap = await getDoc(expenseRef);
              if (expenseSnap.exists()) {
                expense = expenseSnap.data();
                console.log('Found guest expense in Firestore:', expenseId);
              }
            } catch (firestoreError) {
              console.log('Error fetching from Firestore:', firestoreError);
            }
          } else {
            console.log('Found guest expense in AsyncStorage:', expenseId);
          }
          
          if (expense) {
            setExpenseData({
              amount: expense.amount.toString(),
              description: expense.description,
              category: expense.category,
              paidBy: expense.paidBy,
              paidById: expense.paidById,
              splitMethod: expense.splitMethod || 'Equally',
              image: expense.image || null,
              date: route.params?.date || (expense.date?.toDate ? expense.date.toDate().toISOString() : (expense.date || new Date().toISOString())),
            });
            setOriginalAmount(parseFloat(expense.amount));
            
            // Fetch group data to get admin information
            let membersWithAdmin = expense.members || [];
            console.log('Original expense members:', expense.members);
            console.log('Expense groupId:', expense.groupId);
            
            if (expense.groupId) {
              try {
                if (isGuestUser) {
                  // For guest users, check AsyncStorage first
                  const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
                  const groupData = guestGroups.find(g => g.id === expense.groupId);
                  console.log('Guest group data found:', groupData);
                  if (groupData && groupData.members) {
                    console.log('Group members with admin info:', groupData.members);
                    // Merge admin information from group data
                    membersWithAdmin = expense.members.map(member => {
                      const groupMember = groupData.members.find(gm => gm.id === member.id);
                      const memberWithAdmin = {
                        ...member,
                        isAdmin: groupMember?.isAdmin || groupMember?.role === 'admin',
                        role: groupMember?.role || 'member'
                      };
                      console.log(`Member ${member.name} admin info:`, memberWithAdmin);
                      return memberWithAdmin;
                    });
                  }
                } else {
                  // For regular users, fetch from Firestore
                  const groupRef = doc(db, 'groups', expense.groupId);
                  const groupDoc = await getDoc(groupRef);
                  if (groupDoc.exists()) {
                    const groupData = groupDoc.data();
                    console.log('Firestore group data found:', groupData);
                    if (groupData.members) {
                      console.log('Group members with admin info:', groupData.members);
                      // Merge admin information from group data
                      membersWithAdmin = expense.members.map(member => {
                        const groupMember = groupData.members.find(gm => gm.id === member.id);
                        const memberWithAdmin = {
                          ...member,
                          isAdmin: groupMember?.isAdmin || groupMember?.role === 'admin',
                          role: groupMember?.role || 'member'
                        };
                        console.log(`Member ${member.name} admin info:`, memberWithAdmin);
                        return memberWithAdmin;
                      });
                    }
                  }
                }
              } catch (error) {
                console.log('Error fetching group data for admin info:', error);
              }
            }
            
            console.log('Final members with admin info:', membersWithAdmin);
            setMembers(membersWithAdmin);
            // Set split amounts for custom/unequal
            if (expense.splitMethod !== 'Equally' && expense.splits) {
              const splits = {};
              expense.splits.forEach(s => { splits[s.memberId] = s.amount.toString(); });
              setSplitAmounts(splits);
            } else if (expense.splitMethod === 'Equally' && expense.splits) {
              const splits = {};
              expense.splits.forEach(s => { splits[s.memberId] = s.amount.toString(); });
              setSplitAmounts(splits);
            }
          } else {
            console.log('Expense not found for guest user:', expenseId);
            setError('Expense not found');
          }
        } else {
          // Regular user - fetch from Firestore
          const expenseRef = doc(db, 'expenses', expenseId);
          const expenseSnap = await getDoc(expenseRef);
          if (expenseSnap.exists()) {
            const expense = expenseSnap.data();
            setExpenseData({
              amount: expense.amount.toString(),
              description: expense.description,
              category: expense.category,
              paidBy: expense.paidBy,
              paidById: expense.paidById,
              splitMethod: expense.splitMethod || 'Equally',
              image: expense.image || null,
              date: route.params?.date || (expense.date?.toDate ? expense.date.toDate().toISOString() : (expense.date || new Date().toISOString())),
            });
            setOriginalAmount(parseFloat(expense.amount));
            
            // Fetch group data to get admin information
            let membersWithAdmin = expense.members || [];
            console.log('Original expense members:', expense.members);
            console.log('Expense groupId:', expense.groupId);
            
            if (expense.groupId) {
              try {
                if (isGuestUser) {
                  // For guest users, check AsyncStorage first
                  const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
                  const groupData = guestGroups.find(g => g.id === expense.groupId);
                  console.log('Guest group data found:', groupData);
                  if (groupData && groupData.members) {
                    console.log('Group members with admin info:', groupData.members);
                    // Merge admin information from group data
                    membersWithAdmin = expense.members.map(member => {
                      const groupMember = groupData.members.find(gm => gm.id === member.id);
                      const memberWithAdmin = {
                        ...member,
                        isAdmin: groupMember?.isAdmin || groupMember?.role === 'admin',
                        role: groupMember?.role || 'member'
                      };
                      console.log(`Member ${member.name} admin info:`, memberWithAdmin);
                      return memberWithAdmin;
                    });
                  }
                } else {
                  // For regular users, fetch from Firestore
                  const groupRef = doc(db, 'groups', expense.groupId);
                  const groupDoc = await getDoc(groupRef);
                  if (groupDoc.exists()) {
                    const groupData = groupDoc.data();
                    console.log('Firestore group data found:', groupData);
                    if (groupData.members) {
                      console.log('Group members with admin info:', groupData.members);
                      // Merge admin information from group data
                      membersWithAdmin = expense.members.map(member => {
                        const groupMember = groupData.members.find(gm => gm.id === member.id);
                        const memberWithAdmin = {
                          ...member,
                          isAdmin: groupMember?.isAdmin || groupMember?.role === 'admin',
                          role: groupMember?.role || 'member'
                        };
                        console.log(`Member ${member.name} admin info:`, memberWithAdmin);
                        return memberWithAdmin;
                      });
                    }
                  }
                }
              } catch (error) {
                console.log('Error fetching group data for admin info:', error);
              }
            }
            
            console.log('Final members with admin info:', membersWithAdmin);
            setMembers(membersWithAdmin);
            if (expense.splitMethod !== 'Equally' && expense.splits) {
              const splits = {};
              expense.splits.forEach(s => { splits[s.memberId] = s.amount.toString(); });
              setSplitAmounts(splits);
            } else if (expense.splitMethod === 'Equally' && expense.splits) {
              const splits = {};
              expense.splits.forEach(s => { splits[s.memberId] = s.amount.toString(); });
              setSplitAmounts(splits);
            }
          }
        }
      } catch (err) {
        setError('Failed to load expense data');
      } finally {
        setLoading(false);
      }
    };
    if (expenseId) fetchExpense();
  }, [expenseId]);

  const formatDate = (date) => {
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' && !isNaN(Date.parse(date))) {
      dateObj = new Date(date);
    } else {
      dateObj = new Date();
    }
    return dateObj.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const date = selectedDate instanceof Date ? selectedDate.toISOString() : new Date(selectedDate).toISOString();
      setExpenseData({ ...expenseData, date });
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (!result.canceled) {
        setExpenseData({ ...expenseData, image: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const calculateEqualSplits = (amount, membersList) => {
    if (!amount || !membersList?.length) return {};
    const perMemberAmount = parseFloat(amount) / membersList.length;
    const splits = {};
    membersList.forEach(member => {
      splits[member.id] = perMemberAmount.toFixed(2);
    });
    return splits;
  };

  const handleSelectPaidBy = (member) => {
    setExpenseData({ 
      ...expenseData, 
      paidBy: member.name,
      paidById: member.id 
    });
    if (expenseData.amount) {
      if (expenseData.splitMethod === 'Equally') {
        setSplitAmounts(calculateEqualSplits(expenseData.amount, members));
      } else {
        setSplitAmounts({});
        setRemainingAmount(parseFloat(expenseData.amount));
      }
    }
    setShowPaidByModal(false);
  };

  const handleSplitAmountChange = (memberId, value) => {
    const newAmount = parseFloat(value) || 0;
    const newSplitAmounts = { ...splitAmounts, [memberId]: value };
    setSplitAmounts(newSplitAmounts);
    const totalSplit = Object.entries(newSplitAmounts)
      .filter(([id]) => id !== expenseData.paidById)
      .reduce((sum, [_, amt]) => sum + (parseFloat(amt) || 0), 0);
    const remaining = parseFloat(expenseData.amount) - totalSplit;
    setRemainingAmount(remaining);
  };

  const validateSplitAmounts = () => {
    if (!expenseData.amount || !expenseData.paidById) {
      setSplitError('Please enter amount and select who paid first');
      return false;
    }
    const totalAmount = parseFloat(expenseData.amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setSplitError('Please enter a valid amount');
      return false;
    }
    if (expenseData.splitMethod !== 'Equally') {
      const totalSplit = Object.entries(splitAmounts)
        .filter(([id]) => id !== expenseData.paidById)
        .reduce((sum, [_, amt]) => sum + (parseFloat(amt) || 0), 0);
      if (totalSplit > totalAmount) {
        setSplitError(`Split amounts cannot exceed total amount (${totalAmount}). Current total: ${totalSplit.toFixed(2)}`);
        return false;
      }
    }
    setSplitError('');
    return true;
  };

  const handleSplitMethodChange = (method) => {
    setExpenseData({ ...expenseData, splitMethod: method });
    setSplitError('');
    if (expenseData.amount && expenseData.paidById) {
      if (method === 'Equally') {
        setSplitAmounts(calculateEqualSplits(expenseData.amount, members));
        setShowSplitModal(false);
      } else {
        // For unequal splits: preserve existing amounts if user has already entered them
        const hasUserEnteredAmounts = Object.keys(splitAmounts).length > 0 && 
          Object.values(splitAmounts).some(amount => amount && parseFloat(amount) > 0);
        
        if (hasUserEnteredAmounts) {
          // User has already entered amounts, preserve them
          setSplitAmounts(splitAmounts);
          
          // Calculate remaining amount based on existing splits
          const totalSplit = Object.values(splitAmounts)
            .reduce((sum, amt) => sum + (parseFloat(amt) || 0), 0);
          setRemainingAmount(parseFloat(expenseData.amount) - totalSplit);
        } else {
          // First time opening unequal split, start with empty fields
          setSplitAmounts({});
          setRemainingAmount(parseFloat(expenseData.amount));
        }
        setShowSplitModal(true);
      }
    } else {
      if (method !== 'Equally') {
        setShowSplitModal(true);
      }
    }
  };

  const handleAddFriend = async (friends) => {
    try {
      setMembers(prev => {
        const newMembers = [...prev];
        friends.forEach(friend => {
          if (!newMembers.some(m => m.id === friend.id)) {
            newMembers.push(friend);
          }
        });
        return newMembers;
      });
      // Optionally update group members in Firestore here if needed
    } catch (error) {
      Alert.alert('Error', 'Failed to add members to group');
    }
    setShowContactListModal(false);
  };

  const getMembersText = () => {
    if (members.length === 0) return 'Add Friend';
    if (members.length === 1) return members[0].name;
    return `${members.length} Members`;
  };

  const handleUpdateExpense = async () => {
    setLoading(true);
    setError('');
    try {
      if (!groupId) throw new Error('No group selected');
      if (!expenseData.amount || !expenseData.description || !expenseData.category || !expenseData.paidBy || members.length === 0) {
        setError('Please fill all fields and add at least one member.');
        setLoading(false);
        return;
      }
      if (!validateSplitAmounts()) {
        setError(splitError);
        setLoading(false);
        return;
      }
      const currentUser = auth.currentUser;
      const isGuestUser = currentUser?.isAnonymous;
      let splits = [];
      if (expenseData.splitMethod === 'Equally') {
        const perMember = parseFloat(expenseData.amount) / members.length;
        splits = members.map(m => ({ 
          memberId: m.id, 
          name: m.name, 
          amount: parseFloat(perMember.toFixed(2)),
          avatar: m.avatar || null
        }));
      } else {
        // For Unequally/Custom: add payer's share as remaining
        const totalSplit = members
          .filter(m => m.id !== expenseData.paidById)
          .reduce((sum, m) => sum + (parseFloat(splitAmounts[m.id]) || 0), 0);
        const payerShare = parseFloat(expenseData.amount) - totalSplit;
        splits = members
          .filter(m => m.id !== expenseData.paidById)
          .map(m => ({
            memberId: m.id,
            name: m.name,
            amount: parseFloat(splitAmounts[m.id] || 0),
            avatar: m.avatar || null
          }));
        // Add payer's share
        const payer = members.find(m => m.id === expenseData.paidById);
        if (payer) {
          splits.push({
            memberId: payer.id,
            name: payer.name,
            amount: parseFloat(payerShare.toFixed(2)),
            avatar: payer.avatar || null
          });
        }
      }
      if (isGuestUser) {
        // First try to update in AsyncStorage (legacy guest expenses)
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        const idx = guestExpenses.findIndex(e => e.id === expenseId);
        
        if (idx !== -1) {
          // Update in AsyncStorage
          guestExpenses[idx] = {
            ...guestExpenses[idx],
            ...expenseData,
            amount: parseFloat(expenseData.amount),
            members,
            splits,
            date: expenseData.date,
            image: expenseData.image || '',
            isPersonal: false,
            groupId: groupId,
          };
          await AsyncStorage.setItem('guestExpenses', JSON.stringify(guestExpenses));
          console.log('Updated guest expense in AsyncStorage:', expenseId);
          
          // Send notification for expense edit (guest users)
          const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
          const groupData = guestGroups.find(g => g.id === groupId);
          if (groupData && groupData.memberIds && groupData.memberIds.length > 0) {
            await NotificationTriggers.onExpenseEdited(
              groupId,
              groupData.name,
              expenseData.description,
              currentUser.uid,
              groupData.memberIds
            );
          }
        } else {
          // Try to update in Firestore (new guest expenses)
          try {
            const expenseRef = doc(db, 'expenses', expenseId);
            await updateDoc(expenseRef, {
              ...expenseData,
              amount: parseFloat(expenseData.amount),
              members,
              splits,
              date: Timestamp.fromDate(new Date(expenseData.date)),
              image: expenseData.image || '',
            });
            console.log('Updated guest expense in Firestore:', expenseId);
            
            // Send notification for expense edit (Firestore guest expenses)
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            if (groupDoc.exists()) {
              const groupData = groupDoc.data();
              const memberIds = groupData.memberIds || [];
              if (memberIds.length > 0) {
                await NotificationTriggers.onExpenseEdited(
                  groupId,
                  groupData.name,
                  expenseData.description,
                  currentUser.uid,
                  memberIds
                );
              }
            }
          } catch (firestoreError) {
            console.error('Error updating expense in Firestore:', firestoreError);
            setError('Failed to update expense');
            setLoading(false);
            return;
          }
        }
      } else {
        // Update in Firestore
        const expenseRef = doc(db, 'expenses', expenseId);
        await updateDoc(expenseRef, {
          ...expenseData,
          amount: parseFloat(expenseData.amount),
          members,
          splits,
          date: Timestamp.fromDate(new Date(expenseData.date)),
          image: expenseData.image || '',
        });
      }
      // Check if amount increased
      if (originalAmount !== null && parseFloat(expenseData.amount) > originalAmount) {
        // Reopen all settlements for this group by setting status to 'pending'
        const settlementsQuery = query(
          collection(db, 'settlements'),
          where('groupId', '==', groupId)
        );
        const settlementsSnapshot = await getDocs(settlementsQuery);
        for (const docSnap of settlementsSnapshot.docs) {
          await updateDoc(doc(db, 'settlements', docSnap.id), { status: 'pending' });
        }
      }
      
      // Let GroupDetailsScreen handle settlement recalculation automatically
      // No need to manually manage settlements here
      
      setLoading(false);
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to update expense');
      setLoading(false);
    }
  };

  const handleSelectCategory = (category) => {
    setExpenseData({ ...expenseData, category: category.name });
    setShowCategoryModal(false);
  };

  const renderSplitModal = () => (
    <Modal
      visible={showSplitModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSplitModal(false)}
    >
      <View style={styles.splitModalOverlay}>
        <View style={styles.splitModalContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', position: 'relative', marginBottom: 8 }}>
            <Text style={[styles.splitModalTitle, { textAlign: 'left', alignSelf: 'flex-start' }]}>{expenseData.splitMethod} Split</Text>
            <TouchableOpacity 
              style={{ position: 'absolute', right: 0, top: 0, padding: 10, zIndex: 10 }}
              onPress={() => setShowSplitModal(false)}
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ marginBottom: 8 }}>
          <Text style={styles.totalAmountText}>
            Total: ${parseFloat(expenseData.amount || 0).toFixed(2)}
          </Text>
          {remainingAmount !== 0 && (
            <Text style={[
              styles.remainingText,
                { color: remainingAmount < 0 ? '#FF4B55' : '#4CAF50', marginTop: 2 }
            ]}>
              Remaining: ${remainingAmount.toFixed(2)}
            </Text>
          )}
          </View>

          {splitError ? (
            <Text style={styles.errorText}>{splitError}</Text>
          ) : null}

          <ScrollView style={styles.splitMembersList}>
            {members.map((member, idx) => {
              const isPayer = member.id === expenseData.paidById;
              const nonPayerMembers = members.filter(m => m.id !== expenseData.paidById);
              const totalNonPayerSplit = nonPayerMembers.reduce((sum, m) => sum + (parseFloat(splitAmounts[m.id]) || 0), 0);
              const payerShare = parseFloat(expenseData.amount || 0) - totalNonPayerSplit;
              
              return (
                <View key={member.id ? member.id + '_' + idx : idx} style={[
                  styles.splitMemberRow,
                  isPayer && styles.payerRow
                ]}>
                  <View style={styles.memberInfo}>
                    <View style={[
                      styles.splitMemberInitialAvatar,
                      isPayer && styles.payerAvatar
                    ]}>
                      <Text style={styles.splitMemberInitialText}>
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View>
                    <Text style={styles.splitMemberName}>{member.name}</Text>
                      {isPayer && (
                        <Text style={styles.payerLabel}>Paid for this expense</Text>
                      )}
                  </View>
                  </View>
                  <View style={{ position: 'relative', width: 100 }}>
                    <Text style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: [{ translateY: -12 }],
                      color: '#666',
                      fontSize: 16,
                      zIndex: 1,
                    }}>$</Text>
                  <TextInput
                      style={[
                        styles.splitAmountInput, 
                        { paddingLeft: 22 },
                        isPayer && styles.payerAmountInput
                      ]}
                      placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                      value={isPayer ? payerShare.toFixed(2) : (splitAmounts[member.id]?.toString() || '')}
                    onChangeText={text => handleSplitAmountChange(member.id, text)}
                      editable={!isPayer}
                  />
                </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.splitSubmitButton}
            onPress={() => {
              if (validateSplitAmounts()) {
                setShowSplitModal(false);
              }
            }}
          >
            <LinearGradient
              colors={['#FFD96D', '#FFA211']}
              style={styles.splitSubmitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.splitSubmitText}>Confirm Split</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2D5586" translucent />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Edit Expense</Text>
            <Text style={styles.headerSubtitle}>Edit Expense Details</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Members</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsScroll}>
              <TouchableOpacity style={styles.friendChipAdd} onPress={() => setShowContactListModal(true)}>
                <LinearGradient
                  colors={['#FFD96D', '#FFA211']}
                  style={styles.friendChipGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.friendInitialAvatar}>
                    <Text style={styles.friendInitialText}>+</Text>
                  </View>
                <Text style={styles.friendAddText}>Add Members</Text>
                </LinearGradient>
              </TouchableOpacity>
              {console.log('Members in EditExpenseInsideGroup:', members)}
              {members.map((member) => (
                <View key={member.id} style={styles.friendChip}>
                  {member.avatar ? (
                    <Image source={member.avatar} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendInitialAvatar}>
                      <Text style={styles.friendInitialText}>{member.name?.charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                  )}
                  <Text style={styles.friendName}>{member.name}</Text>
                  {(member.isAdmin || member.role === 'admin') && (
                    <View style={{
                      backgroundColor: '#FF4B55',
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginLeft: 6,
                      alignSelf: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Admin</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={styles.dateSection}>
            <Text style={styles.sectionLabel}>Date</Text>
            <TouchableOpacity 
              style={styles.dateContainer}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.dateContent}>
                <Icon name="calendar" size={24} color="#fff" />
                <Text style={styles.dateText}>{formatDate(expenseData.date)}</Text>
              </View>
              <Icon name="chevron-down" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={
                  expenseData.date instanceof Date
                    ? expenseData.date
                    : (typeof expenseData.date === 'string' && !isNaN(Date.parse(expenseData.date)))
                      ? new Date(expenseData.date)
                      : new Date()
                }
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                style={styles.datePicker}
                textColor="#fff"
                themeVariant="dark"
                maximumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.iosDatePickerActions}>
                  <TouchableOpacity 
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          <View style={styles.expenseForm}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseTitle}>Expense</Text>
              {/* <TouchableOpacity>
                <Icon name="plus" size={24} color="#fff" />
              </TouchableOpacity> */}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={expenseData.amount}
                onChangeText={(text) => setExpenseData({ ...expenseData, amount: text })}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter description"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={expenseData.description}
                onChangeText={(text) => setExpenseData({ ...expenseData, description: text })}
              />
            </View>
            <TouchableOpacity 
              style={styles.selectButton}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={styles.label}>Category</Text>
              <View style={styles.selectContent}>
                <Text style={styles.selectText}>
                  {expenseData.category || 'Select category'}
                </Text>
                <Icon name="chevron-down" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.selectButton}
              onPress={() => setShowPaidByModal(true)}
            >
              <Text style={styles.label}>Paid By</Text>
              <View style={styles.selectContent}>
                <Text style={styles.selectText}>
                  {expenseData.paidBy || 'Select paid by'}
                </Text>
                <Icon name="chevron-down" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.splitMethodContainer}>
              <Text style={styles.label}>Split Method</Text>
              <View style={styles.splitButtons}>
                {['Equally', 'Unequally', 'Custom'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.splitButton,
                      expenseData.splitMethod === method && styles.splitButtonActive
                    ]}
                    onPress={() => handleSplitMethodChange(method)}
                  >
                    <Text style={[
                      styles.splitButtonText,
                      expenseData.splitMethod === method && styles.splitButtonTextActive
                    ]}>
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
        <TouchableOpacity onPress={handleUpdateExpense}>
          <LinearGradient
            colors={['#FFD96D', '#FFA211']}
            style={styles.saveButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.saveButtonText}>Update Expense</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* Category Modal */}
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
                      style={styles.categoryItem}
                      onPress={() => handleSelectCategory(category)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#8B6AD2', '#211E83']}
                        style={[
                          styles.categoryGradient,
                          category.name === expenseData.category && styles.selectedCategoryGradient
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Image source={category.icon} style={styles.categoryIcon} />
                        <Text style={styles.categoryName} numberOfLines={1} ellipsizeMode="tail">{category.name}</Text>
                        {category.name === expenseData.category && (
                          <View style={styles.selectedIndicator}>
                            <Text style={styles.checkmark}>✓</Text>
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
        {/* Paid By Modal */}
        <Modal
          visible={showPaidByModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPaidByModal(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#2D5586', '#171E45']}
              style={styles.modalContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Who Paid</Text>
                <TouchableOpacity onPress={() => setShowPaidByModal(false)}>
                  <Icon name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberItem}
                    onPress={() => handleSelectPaidBy(member)}
                  >
                    <Image source={member.avatar} style={styles.memberAvatar} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {(member.isAdmin || member.role === 'admin') && (
                        <View style={{
                          backgroundColor: '#FF4B55',
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          marginLeft: 6,
                          alignSelf: 'center',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Admin</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </View>
        </Modal>
        <RegisteredUsersModal
          visible={showContactListModal}
          onClose={() => setShowContactListModal(false)}
          onSelectUsers={handleAddFriend}
        />
        {renderSplitModal()}
        {loading && <Text style={{ color: 'yellow', textAlign: 'center', marginVertical: 10 }}>Saving...</Text>}
        {error ? <Text style={{ color: 'red', textAlign: 'center', marginVertical: 10 }}>{error}</Text> : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 12,
  },
  friendsScroll: {
    flexGrow: 0,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    marginRight: 5,
  },
  friendChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    marginRight: 5,
    overflow: 'hidden',
  },
  friendChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 15,
  },
  friendInitialAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  friendInitialText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  friendName: {
    color: '#fff',
    fontSize: 14,
  },
  friendAddText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  dateSection: {
    marginHorizontal: 0,
    marginTop: 5,
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  datePickerContainer: {
    backgroundColor: '#171E45',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  datePicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 200 : 'auto',
  },
  iosDatePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
  },
  datePickerButton: {
    backgroundColor: '#FFD96D',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  datePickerButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  expenseForm: {
    gap: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  selectButton: {
    gap: 8,
  },
  selectContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 8,
  },
  selectText: {
    color: '#fff',
    fontSize: 16,
  },
  splitMethodContainer: {
    gap: 8,
  },
  splitButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    padding: 4,
  },
  splitButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  splitButtonActive: {
    backgroundColor: '#6C63FF',
  },
  splitButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  splitButtonTextActive: {
    fontWeight: '600',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  saveButton: {
    margin: 20,
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
  },
  splitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitModalContent: {
    width: '90%',
    backgroundColor: '#1B3D6E',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  splitModalHeader: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  totalAmountText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
  },
  remainingText: {
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    color: '#FF4B55',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  splitMembersList: {
    maxHeight: 300,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  splitMemberInitialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  splitMemberInitialText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  splitMemberName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  splitAmountInput: {
    width: 100,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    textAlign: 'right',
    color: '#000',
  },
  splitSubmitButton: {
    marginTop: 16,
  },
  splitSubmitGradient: {
    borderRadius: 25,
    padding: 16,
  },
  splitSubmitText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  payerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  payerAvatar: {
    backgroundColor: '#FF4B55',
  },
  payerLabel: {
    color: '#FF4B55',
    fontSize: 12,
    fontWeight: 'bold',
  },
  payerAmountInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  categoryItem: {
    width: '22%',
    aspectRatio: 1,
    marginBottom: 18,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryGradient: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    position: 'relative',
  },
  selectedCategoryGradient: {
    borderWidth: 2,
    borderColor: '#FFD96D',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  categoryName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'transparent',
  },
  checkmark: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: '#211E83',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  iconText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  categoryList: {
    paddingVertical: 8,
  },
});

export default EditExpenseInsideGroup; 