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
import DateTimePicker from '@react-native-community/datetimepicker';
import RegisteredUsersModal from '../components/RegisteredUsersModal';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import NotificationTriggers from '../utils/NotificationTriggers';

const AddExpenseScreen = ({ navigation, route }) => {
  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
    category: '',
    paidBy: '',
    paidById: '',
    splitMethod: 'Equally',
    date: new Date().toISOString(),
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPaidByModal, setShowPaidByModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRegisteredUsersModal, setShowRegisteredUsersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [splitError, setSplitError] = useState('');
  const [remainingAmount, setRemainingAmount] = useState(0);

  const { groupId } = route.params || {};

  // Initialize members from route params if available
  useEffect(() => {
    if (route.params?.members) {
      setMembers(route.params.members);
    }
  }, [route.params?.members]);

  // Fallback UI if no groupId
  if (!groupId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#171E45' }}>
        <Text style={{ color: 'red', fontSize: 18, marginBottom: 20 }}>No group selected.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 12, backgroundColor: '#FFD96D', borderRadius: 8 }}>
          <Text style={{ color: '#000', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (date) => {
    // Ensure date is a valid Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
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
      // Store as ISO string
      const date = selectedDate instanceof Date ? selectedDate.toISOString() : new Date(selectedDate).toISOString();
      setExpenseData({ ...expenseData, date });
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
      // Calculate total of all non-payer splits
      const nonPayerMembers = members.filter(m => m.id !== expenseData.paidById);
      const totalSplit = nonPayerMembers.reduce((sum, m) => sum + (parseFloat(splitAmounts[m.id]) || 0), 0);
      const payerShare = totalAmount - totalSplit;

      // Check for empty or negative fields
      const anyEmpty = nonPayerMembers.some(m => splitAmounts[m.id] === undefined || splitAmounts[m.id] === '' || isNaN(parseFloat(splitAmounts[m.id])) || parseFloat(splitAmounts[m.id]) < 0);

      if (anyEmpty) {
        setSplitError('Please enter a valid split amount for each member.');
        return false;
      }

      if (payerShare < 0) {
        setSplitError('Split amounts exceed total amount.');
        return false;
      }

      setSplitError('');
      return true;
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

  const handleSplitAmountChange = (memberId, value) => {
    const newAmount = parseFloat(value) || 0;
    const totalAmount = parseFloat(expenseData.amount);
    
    // Cap the input value to the expense amount
    const cappedAmount = Math.min(newAmount, totalAmount);
    const newSplitAmounts = { ...splitAmounts, [memberId]: cappedAmount.toString() };
    setSplitAmounts(newSplitAmounts);

    const totalSplit = Object.values(newSplitAmounts)
      .reduce((sum, amt) => sum + (parseFloat(amt) || 0), 0);
    const remaining = totalAmount - totalSplit;
    setRemainingAmount(remaining);
  };

  const handleSelectUsers = async (selectedUsers) => {
    try {
      // Update local state first
      const updatedMembers = [...members];
      selectedUsers.forEach(user => {
        if (!updatedMembers.some(m => m.id === user.id)) {
          updatedMembers.push({
            id: user.id,
            name: user.displayName || user.name || 'Unknown User',
            phone: user.phoneNumber || user.phone || '',
            avatar: user.avatar || null
          });
        }
      });
      
      // Update local state immediately
      setMembers(updatedMembers);
      
      // Recalculate splits if expense amount and paidBy are already set
      if (expenseData.amount && expenseData.paidById) {
        if (expenseData.splitMethod === 'Equally') {
          // Recalculate equal splits with new members
          const perMember = parseFloat(expenseData.amount) / updatedMembers.length;
          const newSplitAmounts = {};
          updatedMembers.forEach(member => {
            newSplitAmounts[member.id] = perMember.toFixed(2);
          });
          setSplitAmounts(newSplitAmounts);
        } else {
          // For unequal splits, add new members without auto-filling amounts
          const newSplitAmounts = { ...splitAmounts };
          selectedUsers.forEach(user => {
            if (!newSplitAmounts.hasOwnProperty(user.id)) {
              // Don't auto-fill amounts for new members in unequal splits
              // Let user manually enter the amounts
            }
          });
          setSplitAmounts(newSplitAmounts);
          
          // Recalculate remaining amount
          const nonPayerMembers = updatedMembers.filter(m => m.id !== expenseData.paidById);
          const totalSplit = nonPayerMembers.reduce((sum, m) => sum + (parseFloat(newSplitAmounts[m.id]) || 0), 0);
          setRemainingAmount(parseFloat(expenseData.amount) - totalSplit);
        }
      }

      // Update group members in Firestore
      const groupRef = doc(db, 'groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const currentMembers = groupDoc.data().members || [];
        
        // Process existing members to ensure no serverTimestamp objects
        const processedCurrentMembers = currentMembers.map(member => ({
          ...member,
          joinedAt: member.joinedAt?.toDate?.()?.toISOString() || member.joinedAt || new Date().toISOString()
        }));
        
        const newMembers = [...processedCurrentMembers];
        selectedUsers.forEach(user => {
          if (!newMembers.some(m => m.id === user.id)) {
            newMembers.push({
              id: user.id,
              name: user.displayName || user.name || 'Unknown User',
              phone: user.phoneNumber || user.phone || '',
              joinedAt: new Date().toISOString(),
              role: 'member'
            });
          }
        });

        await updateDoc(groupRef, {
          members: newMembers,
          memberIds: newMembers.map(m => m.id),
          updatedAt: serverTimestamp()
        });
        
        console.log('[AddExpenseInsideGroup] Members updated successfully:', {
          newMembersCount: newMembers.length,
          addedUsers: selectedUsers.map(u => u.name)
        });
      } else {
        console.error('Group document not found');
        Alert.alert('Error', 'Group not found');
      }
    } catch (error) {
      console.error('Error updating group members:', error);
      Alert.alert('Error', 'Failed to add members to group');
    }
    
    setShowRegisteredUsersModal(false);
  };

  const handleSaveExpense = async () => {
    setLoading(true);
    setError('');
    try {
      if (!groupId) throw new Error('No group selected');
      if (!expenseData.amount || !expenseData.description || !expenseData.category || !expenseData.paidBy || members.length === 0) {
        setError('Please fill all fields and add at least one member.');
        setLoading(false);
        return;
      }

      // Ensure all members are included in the expense
      if (members.length === 0) {
        setError('No members found. Please add members to the group.');
        setLoading(false);
        return;
      }

      // Validate split amounts before saving
      if (!validateSplitAmounts()) {
        setError(splitError);
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      const isGuestUser = currentUser.isAnonymous;

      // Get user data from AsyncStorage for guest users
      const userName = await AsyncStorage.getItem('userName') || 'guest';
      const userPhone = await AsyncStorage.getItem('userPhone') || '';
      const userAvatar = await AsyncStorage.getItem('userAvatar') || null;

      // Prepare split details based on split method
      let splits = [];
      if (expenseData.splitMethod === 'Equally') {
        // For equal splits, calculate per member amount
        const perMember = parseFloat(expenseData.amount) / members.length;
        splits = members.map(m => ({ 
          memberId: m.id, 
          name: m.name, 
          amount: parseFloat(perMember.toFixed(2)),
          avatar: m.avatar || null
        }));
      } else {
        // For unequal/custom splits, include ALL members (including payer)
        const nonPayerMembers = members.filter(m => m.id !== expenseData.paidById);
        const totalNonPayerSplit = nonPayerMembers.reduce((sum, m) => sum + (parseFloat(splitAmounts[m.id]) || 0), 0);
        const payerShare = parseFloat(expenseData.amount) - totalNonPayerSplit;
        
        splits = members.map(m => ({
          memberId: m.id,
          name: m.name,
          amount: m.id === expenseData.paidById ? payerShare : parseFloat(splitAmounts[m.id] || 0),
          avatar: m.avatar || null
        }));
      }

      console.log('[AddExpenseInsideGroup] Creating expense with members:', {
        totalMembers: members.length,
        memberNames: members.map(m => m.name),
        splits: splits.map(s => `${s.name}: $${s.amount}`)
      });

      console.log('AddExpenseInsideGroup - Final splits array:', splits);
      console.log('AddExpenseInsideGroup - Total amount:', expenseData.amount);
      console.log('AddExpenseInsideGroup - Sum of splits:', splits.reduce((sum, split) => sum + split.amount, 0));

      // Prepare expense object
      const expenseToSave = {
        groupId,
        amount: parseFloat(expenseData.amount),
        description: expenseData.description,
        category: expenseData.category,
        paidBy: expenseData.paidBy,
        paidById: expenseData.paidById,
        splitMethod: expenseData.splitMethod,
        date: Timestamp.fromDate(new Date(expenseData.date)),
        members: members.map(m => ({ 
          id: m.id, 
          name: m.name,
          avatar: m.avatar || null
        })),
        splits,
        createdAt: isGuestUser ? new Date().toISOString() : serverTimestamp(),
        createdBy: {
          id: currentUser.uid,
          name: userName,
          phone: userPhone,
          email: isGuestUser ? '' : currentUser.email,
          avatar: userAvatar ? { uri: userAvatar } : null
        }
      };

      console.log('[AddExpenseInsideGroup] Final expense object:', {
        membersInExpense: expenseToSave.members.length,
        splitsInExpense: expenseToSave.splits.length,
        totalAmount: expenseToSave.amount
      });

      if (isGuestUser) {
        // For guest users, check if this group exists in Firestore first
        try {
          const groupDocRef = doc(db, 'groups', groupId);
          const groupDocSnap = await getDoc(groupDocRef);
          
          if (groupDocSnap.exists()) {
            // Group exists in Firestore, save expense to Firestore
            const expenseRef = await addDoc(collection(db, 'expenses'), expenseToSave);
            
            // Send notification for Firestore group
            const groupData = groupDocSnap.data();
            if (groupData.memberIds && groupData.memberIds.length > 0) {
              await NotificationTriggers.onGroupExpenseAdded(
                groupId,
                groupData.name,
                expenseToSave.description,
                expenseToSave.amount,
                currentUser.uid,
                groupData.memberIds,
                groupData.categoryIconKey || expenseToSave.category || 'Miscellaneous'
              );
            }
          } else {
            // Group doesn't exist in Firestore, save to AsyncStorage (legacy guest group)
            const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
            
            // Add new expense with a unique ID
            const newExpense = {
              ...expenseToSave,
              id: `guest-expense-${Date.now()}`,
              isPersonal: false,
              groupId: groupId,
            };
            guestExpenses.push(newExpense);
            
            // Update group's expense list in AsyncStorage
            const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
            const groupIndex = guestGroups.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
              if (!guestGroups[groupIndex].expenses) {
                guestGroups[groupIndex].expenses = [];
              }
              guestGroups[groupIndex].expenses.push(newExpense.id);
              await AsyncStorage.setItem('guestGroups', JSON.stringify(guestGroups));
            }
            
            // Save updated expenses
            await AsyncStorage.setItem('guestExpenses', JSON.stringify(guestExpenses));
            
            // Send notification for guest users
            const groupData = guestGroups.find(g => g.id === groupId);
            if (groupData) {
              const groupName = groupData.name;
              const memberIds = groupData.memberIds || [];
              const categoryIconKey = groupData.categoryIconKey || expenseToSave.category || 'Miscellaneous';
              await NotificationTriggers.onGroupExpenseAdded(
                groupId,
                groupName,
                expenseToSave.description,
                expenseToSave.amount,
                currentUser.uid,
                memberIds,
                categoryIconKey
              );
            }
          }
        } catch (error) {
          throw new Error('Failed to save expense data');
        }
      } else {
        // For regular users, save to Firestore
        const expenseRef = await addDoc(collection(db, 'expenses'), expenseToSave);
        // Fetch group data to get group name, members, and categoryIconKey
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          const groupName = groupData.name;
          const memberIds = groupData.memberIds || [];
          const categoryIconKey = groupData.categoryIconKey || expenseToSave.category || 'Miscellaneous';
          await NotificationTriggers.onGroupExpenseAdded(
            groupId,
            groupName,
            expenseToSave.description,
            expenseToSave.amount,
            currentUser.uid,
            memberIds,
            categoryIconKey
          );
        }
      }

      setLoading(false);
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to save expense');
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
          <View style={styles.splitModalHeader}>
            <Text style={styles.splitModalTitle}>
              {expenseData.splitMethod} Split
            </Text>
            <Text style={styles.totalAmountText}>
              Total: ${parseFloat(expenseData.amount || 0).toFixed(2)}
            </Text>
            {remainingAmount !== 0 && (
              <Text style={[
                styles.remainingText,
                { color: remainingAmount < 0 ? '#FF4B55' : '#4CAF50' }
              ]}>
                Remaining: ${remainingAmount.toFixed(2)}
              </Text>
            )}
            <TouchableOpacity
              style={{ position: 'absolute', top: 0, right: 0, padding: 10, zIndex: 10 }}
              onPress={() => setShowSplitModal(false)}
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Add Expense</Text>
            <Text style={styles.headerSubtitle}>Add Expense Details</Text>
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
              <TouchableOpacity style={styles.friendChipAdd} onPress={() => setShowRegisteredUsersModal(true)}>
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
              {members.map((member, idx) => (
                <View key={member.id ? member.id + '_' + idx : idx} style={styles.friendChip}>
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
                value={expenseData.date instanceof Date ? expenseData.date : new Date(expenseData.date)}
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount</Text>
              <View style={{ position: 'relative', width: '100%' }}>
                <Text style={styles.dollarPrefix}>$</Text>
                <TextInput
                  style={[styles.input, { paddingLeft: 28 }]}
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={expenseData.amount}
                  onChangeText={(text) => setExpenseData({ ...expenseData, amount: text })}
                  keyboardType="numeric"
                />
              </View>
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

        <TouchableOpacity onPress={handleSaveExpense}>
          <LinearGradient
            colors={['#FFD96D', '#FFA211']}
            style={styles.saveButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.saveButtonText}>Save Expense</Text>
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
            <View style={styles.modalContent}>
              <CategoryGrid
                onSelectCategory={handleSelectCategory}
                onClose={() => setShowCategoryModal(false)}
              />
            </View>
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
                {members.map((member, idx) => (
                  <TouchableOpacity
                    key={member.id ? member.id + '_' + idx : idx}
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
          visible={showRegisteredUsersModal}
          onClose={() => setShowRegisteredUsersModal(false)}
          onSelectUsers={handleSelectUsers}
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  dollarPrefix: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    color: '#fff',
    fontSize: 18,
    zIndex: 1,
  },
  payerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  payerAvatar: {
    backgroundColor: '#FFB800',
  },
  payerLabel: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '600',
  },
  payerAmountInput: {
    backgroundColor: '#FFB800',
  },
});

export default AddExpenseScreen; 