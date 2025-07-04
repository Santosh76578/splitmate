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
import CustomAlertModal from '../components/CustomAlertModal';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NotificationTriggers from '../utils/NotificationTriggers';
import { ensureGuestName } from '../utils/guestNameUtils';

const AddExpenseScreen = ({ navigation }) => {
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [splitMembers, setSplitMembers] = useState([]);
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
  const [isPaidByModalVisible, setIsPaidByModalVisible] = useState(false);
  const [members, setMembers] = useState([]);
  const [adminInfo, setAdminInfo] = useState(null);
  const [adminName, setAdminName] = useState('');
  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
    category: '',
    paidBy: '',
    paidById: '',
    splitMethod: 'Equally',
    date: new Date(),
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRegisteredUsersModal, setShowRegisteredUsersModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [splitError, setSplitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({
    amount: false,
    description: false,
    category: false,
    paidBy: false,
    members: false
  });
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    icon: 'alert-circle-outline',
    iconColor: '#FFD96D'
  });

  useEffect(() => {
    const init = async () => {
      await loadAdminName();
      await loadMembers();
      await loadAdminInfo();
    };
    init();
  }, []);

  const loadAdminName = async () => {
    try {
      const currentUser = auth.currentUser;
      let userName = currentUser?.displayName;
      if (!userName) {
        const storedName = await AsyncStorage.getItem('userName');
        userName = storedName || currentUser?.email?.split('@')[0] || 'User';
      }
      
      // For anonymous users, ensure they have a proper guest name
      if (currentUser?.isAnonymous) {
        userName = await ensureGuestName(currentUser);
      }
      
      setAdminName(userName);
    } catch (error) {
      console.error('Error loading admin name:', error);
    }
  };

  const loadAdminInfo = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const isGuestUser = currentUser.isAnonymous;
        let userName;
        
        if (isGuestUser) {
          userName = await ensureGuestName(currentUser);
        } else {
          userName = currentUser.displayName || 'User';
        }
        
        const userAvatar = isGuestUser
          ? await AsyncStorage.getItem('userAvatar')
          : currentUser.photoURL;
          
        setAdminInfo({
          name: userName,
          id: currentUser.uid,
          avatar: userAvatar ? { uri: userAvatar } : null,
        });

        // Add admin to members list if not already present
        setMembers(prevMembers => {
          const isAdminInMembers = prevMembers.some(member => member.id === currentUser.uid);
          if (!isAdminInMembers) {
            return [...prevMembers, {
              id: currentUser.uid,
              name: userName,
              avatar: userAvatar ? { uri: userAvatar } : null,
              isAdmin: true
            }];
          }
          return prevMembers;
        });
      }
    } catch (error) {
      console.error('Error loading admin info:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const isGuestUser = currentUser.isAnonymous;
        const userName = isGuestUser 
          ? await ensureGuestName(currentUser)
          : currentUser.displayName || 'User';
        const userAvatar = isGuestUser
          ? await AsyncStorage.getItem('userAvatar')
          : currentUser.photoURL;

        // Always add the admin as the first member
        setMembers([{
          id: currentUser.uid,
          name: userName,
          avatar: userAvatar ? { uri: userAvatar } : null,
          isAdmin: true
        }]);

        // Set the admin as the default payer
        setPaidBy(currentUser.uid);
        setExpenseData(prev => ({
          ...prev,
          paidBy: adminName || userName,
          paidById: currentUser.uid
        }));
      }
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const getMembersText = () => {
    return 'Add Friend';
  };

  const handleSelectUsers = (selectedUsers) => {
    // Handle multiple selected users
    selectedUsers.forEach(user => {
      // Check if user is already in members
      const isAlreadyMember = members.some(member => member.id === user.id);
      
      if (!isAlreadyMember) {
        const newMember = {
          id: user.id,
          name: user.displayName || user.name || 'Unknown',
          phoneNumber: user.phoneNumber || user.phone || '',
          email: user.email || '',
          isAdmin: false
        };
        setMembers(prevMembers => [...prevMembers, newMember]);
        console.log('Added member for expense tracking:', newMember.name);
      }
    });
    setShowRegisteredUsersModal(false);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setExpenseData({ ...expenseData, date: selectedDate });
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleSaveExpense = async () => {
    setLoading(true);
    setError('');

    // Reset all errors
    setErrors({
      amount: false,
      description: false,
      category: false,
      paidBy: false,
      members: false
    });

    // Check if there are any friends added
    if (members.length <= 1) {
      setCustomAlert({
        visible: true,
        title: 'Add Friends Required',
        message: 'Please add at least one friend before saving the expense.',
        buttons: [
          { 
            text: 'Add Friends',
            onPress: () => setShowRegisteredUsersModal(true)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ],
        icon: 'account-plus-outline',
        iconColor: '#FFD96D'
      });
      setLoading(false);
      return;
    }

    // Validate required fields
    const newErrors = {
      amount: !expenseData.amount || !expenseData.amount.trim(),
      description: !expenseData.description || !expenseData.description.trim(),
      category: !expenseData.category,
      paidBy: !expenseData.paidBy,
      members: members.length <= 1
    };

    // If any errors exist, set them and return
    if (Object.values(newErrors).some(error => error)) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    // Validate amount is a valid number
    const amount = parseFloat(expenseData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0');
      setLoading(false);
      return;
    }

    // Validate split amounts if not equal split
    if (expenseData.splitMethod !== 'Equally') {
      if (!validateSplitAmounts()) {
        setError(splitError);
        setLoading(false);
        return;
      }
    }

    try {
      const currentUser = auth.currentUser;
      const isGuestUser = currentUser?.isAnonymous || false;
      const userId = currentUser?.uid || '';
      const now = new Date();

      // Prepare Firestore fields
      const docToSave = {
        amount: amount,
        category: expenseData.category,
        categoryIcon: expenseData.categoryIcon || 'office-building-outline',
        createdAt: now,
        date: expenseData.date instanceof Date ? expenseData.date : new Date(expenseData.date),
        description: expenseData.description,
        isPersonal: true,
        members: members.map(m => ({
          id: m.id,
          name: m.isAdmin ? (adminName || m.name) : m.name,
          avatar: m.avatar || null,
          phoneNumber: m.phoneNumber || '',
        })),
        paidBy: expenseData.paidBy,
        paidById: expenseData.paidById,
        splitMethod: expenseData.splitMethod,
        splitAmounts: expenseData.splitMethod === 'Equally' ? calculateEqualSplits() : splitAmounts,
        status: 'active',
        userId,
      };

      const memberIds = members.map(m => m.id).filter(id => id !== expenseData.paidById);

      console.log('AddExpenseScreen - memberIds for notification:', memberIds);
      console.log('AddExpenseScreen - expenseData.paidById:', expenseData.paidById);
      console.log('AddExpenseScreen - members:', members);

      // Send notification to the expense creator (all user types)
      const currentUserId = currentUser?.uid;
      
      console.log('=== PERSONAL EXPENSE NOTIFICATION DEBUG ===');
      console.log('AddExpenseScreen - Current user:', currentUser);
      console.log('AddExpenseScreen - Current user ID:', currentUserId);
      console.log('AddExpenseScreen - Is guest user:', isGuestUser);
      console.log('AddExpenseScreen - Current user type:', isGuestUser ? 'Guest' : 'Regular/Member');
      console.log('AddExpenseScreen - Notification details:', {
        description: expenseData.description,
        amount: expenseData.amount,
        category: expenseData.category || 'Miscellaneous'
      });
      console.log('==========================================');

      if (isGuestUser) {
        // Save to guestExpenses in AsyncStorage
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        const newExpense = {
          ...docToSave,
          id: `guest-expense-${Date.now()}`,
        };
        guestExpenses.push(newExpense);
        await AsyncStorage.setItem('guestExpenses', JSON.stringify(guestExpenses));
        console.log('AddExpenseScreen - Guest expense saved to AsyncStorage');
      } else {
        await addDoc(collection(db, 'personalExpenses'), docToSave);
        console.log('AddExpenseScreen - Regular expense saved to Firestore');
      }

      // Send notification to the expense creator (all user types)
      if (currentUserId) {
        console.log('AddExpenseScreen - About to send notification to user:', currentUserId);
        try {
          await NotificationTriggers.onPersonalExpenseAdded(
            expenseData.description,
            expenseData.amount,
            [currentUserId], // Send to the creator only
            expenseData.category || 'Miscellaneous'
          );
          console.log('AddExpenseScreen - Notification sent successfully to expense creator');
        } catch (notificationError) {
          console.error('AddExpenseScreen - Error sending notification:', notificationError);
          console.error('AddExpenseScreen - Error stack:', notificationError.stack);
        }
      } else {
        console.log('AddExpenseScreen - No current user ID available for notification');
      }

      setLoading(false);
      navigation.navigate('MainTabs', { screen: 'ExpensesTab' });
    } catch (err) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense');
      setLoading(false);
    }
  };

  const handleSelectCategory = (category) => {
    setExpenseData({ ...expenseData, category: category.name });
    setShowCategoryModal(false);
  };

  const handleSplitMethodChange = (method) => {
    // If user selects Unequally or Custom, check for at least one member
    if ((method === 'Unequally' || method === 'Custom') && members.length <= 1) {
      setCustomAlert({
        visible: true,
        title: 'Add Members',
        message: 'You should add at least one member to split the expenses.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {}
          }
        ],
        icon: 'account-group-outline',
        iconColor: '#FFD96D'
      });
      setExpenseData({ ...expenseData, splitMethod: 'Equally' });
      return;
    }

    setExpenseData({ ...expenseData, splitMethod: method });
    setSplitError('');

    if (expenseData.amount && expenseData.paidById) {
      if (method === 'Equally') {
        setSplitAmounts(calculateEqualSplits());
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
        setCustomAlert({
          visible: true,
          title: 'Error',
          message: 'Please enter amount and select who paid first',
          buttons: [
            {
              text: 'OK',
              onPress: () => {}
            }
          ],
          icon: 'alert-circle-outline',
          iconColor: '#FF6B6B'
        });
        setExpenseData({ ...expenseData, splitMethod: 'Equally' });
      }
    }
  };

  const calculateEqualSplits = () => {
    if (!expenseData.amount || members.length === 0) return {};
    const perMemberAmount = parseFloat(expenseData.amount) / members.length;
    const splits = {};
    members.forEach(member => {
      if (member.id !== expenseData.paidById) {
        splits[member.id] = perMemberAmount.toFixed(2);
      }
    });
    return splits;
  };

  const handleSplitAmountChange = (memberId, value) => {
    if (!memberId) return;
    
    const newAmount = parseFloat(value) || 0;
    const totalAmount = parseFloat(expenseData.amount);
    
    // Cap the input value to the expense amount
    const cappedAmount = Math.min(newAmount, totalAmount);
    const newSplitAmounts = { ...splitAmounts, [memberId]: cappedAmount.toString() };
    setSplitAmounts(newSplitAmounts);

    // Calculate remaining amount
    const totalSplit = Object.values(newSplitAmounts)
      .reduce((sum, amt) => sum + (parseFloat(amt) || 0), 0);
    const remaining = totalAmount - totalSplit;
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
      // Validate each split is a valid decimal number
      for (const value of Object.values(splitAmounts)) {
        const normalized = value.replace(',', '.');
        if (isNaN(normalized) || normalized === '') {
          setSplitError('Please enter valid numbers for all splits (decimals allowed)');
          setCustomAlert({
            visible: true,
            title: 'Error',
            message: 'Please enter valid numbers for all splits (decimals allowed)',
            buttons: [
              {
                text: 'OK',
                onPress: () => {}
              }
            ],
            icon: 'alert-circle-outline',
            iconColor: '#FF6B6B'
          });
          return false;
        }
      }
      const splitTotal = Object.values(splitAmounts)
        .reduce((sum, amount) => sum + (parseFloat(amount.replace(',', '.')) || 0), 0);
      const difference = Math.abs(totalAmount - splitTotal);
      if (difference > 0.01) {
        setSplitError(`Split amounts must equal total amount (${totalAmount}). Current total: ${splitTotal.toFixed(2)}`);
        setCustomAlert({
          visible: true,
          title: 'Error',
          message: `Split amounts must equal total amount (${totalAmount}). Current total: ${splitTotal.toFixed(2)}`,
          buttons: [
            {
              text: 'OK',
              onPress: () => {}
            }
          ],
          icon: 'alert-circle-outline',
          iconColor: '#FF6B6B'
        });
        return false;
      }
    }

    setSplitError('');
    return true;
  };

  const handleSelectPaidBy = (member) => {
    if (!member) return;
    
    // Get the correct name for the member
    const memberName = member.isAdmin 
      ? (adminName || member.name || 'You')  // Use adminName if available, fallback to member.name or 'You'
      : member.name;
    
    setExpenseData({ 
      ...expenseData, 
      paidBy: memberName,
      paidById: member.id 
    });
    
    if (expenseData.amount) {
      if (expenseData.splitMethod === 'Equally') {
        setSplitAmounts(calculateEqualSplits());
      } else {
        // Preserve existing split amounts when payer changes
        const existingSplits = Object.keys(splitAmounts).length > 0 ? splitAmounts : {};
        setSplitAmounts(existingSplits);
        
        // Recalculate remaining amount
        if (Object.keys(existingSplits).length > 0) {
          const totalSplit = Object.values(existingSplits)
            .reduce((sum, amt) => sum + (parseFloat(amt) || 0), 0);
          setRemainingAmount(parseFloat(expenseData.amount) - totalSplit);
        } else {
          setRemainingAmount(parseFloat(expenseData.amount));
        }
      }
    }
    
    setIsPaidByModalVisible(false);
  };

  const toggleSplitMember = (memberId) => {
    if (!memberId) return;
    
    setSplitMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const renderSplitModal = () => (
    <Modal
      visible={showSplitModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSplitModal(false)}
    >
      <View style={styles.splitModalOverlayCard}>
        <View style={styles.splitModalContentCard}>
          <View style={styles.splitModalHeaderCard}>
            <Text style={styles.splitModalTitleCard}>Select member</Text>
            <TouchableOpacity 
              onPress={() => setShowSplitModal(false)}
              style={styles.splitModalCloseButton}
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.splitMembersListCard}>
            {members.map((member) => (
              <View key={member.id} style={styles.splitMemberRowCard2}>
                <View style={styles.memberInfoCard}>
                  {member.avatar ? (
                    <Image source={member.avatar} style={styles.splitMemberAvatarCard} />
                  ) : (
                    <View style={styles.splitMemberInitialAvatarCard}>
                      <Text style={styles.splitMemberInitialTextCard}>
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.splitMemberNameCard}>{member.isAdmin ? 'You' : member.name}</Text>
                </View>
                <View style={{ position: 'relative', width: 90 }}>
                  <Text style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: [{ translateY: -12 }],
                    color: '#222',
                    fontSize: 18,
                    zIndex: 1,
                  }}>$</Text>
                  <TextInput
                    style={[styles.splitAmountInputCard2, { paddingLeft: 22 }]}
                    placeholder="00"
                    placeholderTextColor="#222"
                    keyboardType="default"
                    inputMode="decimal"
                    value={splitAmounts[member.id] ?? ''}
                    onChangeText={text => handleSplitAmountChange(member.id, text)}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
          {splitError ? (
            <Text style={{ color: 'red', textAlign: 'center', marginVertical: 8 }}>
              {splitError}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.splitSubmitButtonCard2}
            onPress={() => {
              if (validateSplitAmounts()) {
                setShowSplitModal(false);
              }
            }}
          >
            <LinearGradient
              colors={["#FFD96D", "#FFA211"]}
              style={styles.splitSubmitGradientCard2}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.splitSubmitTextCard2}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderSplitMembersList = () => (
    <ScrollView style={styles.membersList}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={[
            styles.memberItem,
            splitMembers.includes(member.id) && styles.selectedMember,
          ]}
          onPress={() => toggleSplitMember(member.id)}
        >
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>
              {member.id === adminInfo?.id ? (adminName || member.name) : member.name}
            </Text>
            {member.id === adminInfo?.id && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          {splitMembers.includes(member.id) && (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderFriendsList = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsScroll}>
      <TouchableOpacity 
        style={styles.friendChipAdd} 
        onPress={() => setShowRegisteredUsersModal(true)}
      >
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
      {members.map((member) => (
        <View key={member.id} style={styles.friendChip}>
          {member.avatar ? (
            <Image source={member.avatar} style={styles.friendAvatar} />
          ) : (
            <View style={styles.friendInitialAvatar}>
              <Text style={styles.friendInitialText}>
                {member.isAdmin ? (adminName?.charAt(0).toUpperCase() || '?') : (member.name?.charAt(0).toUpperCase() || '?')}
              </Text>
            </View>
          )}
          <Text style={styles.friendName}>
            {member.isAdmin ? (adminName || member.name) : member.name}
          </Text>
          {member.isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderPaidByMembersList = () => (
    <ScrollView style={styles.membersList}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={[
            styles.memberItem,
            paidBy === member.id && styles.selectedMember,
          ]}
          onPress={() => handleSelectPaidBy(member)}
        >
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>
              {member.isAdmin ? adminName : member.name}
            </Text>
            {member.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          {paidBy === member.id && (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
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
            <Text style={styles.headerTitle}>Add PersonalExpense</Text>
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
            {renderFriendsList()}
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
                value={expenseData.date}
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
            {/* <View style={styles.expenseHeader}>
              <Text style={styles.expenseTitle}>Expense 1</Text>
              <TouchableOpacity>
                <Icon name="plus" size={24} color="#fff" />
              </TouchableOpacity>
            </View> */}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, errors.amount && styles.errorLabel]}>Amount *</Text>
              <View style={{ position: 'relative', width: '100%' }}>
                <Text style={styles.dollarPrefix}>$</Text>
                <TextInput
                  style={[styles.input, errors.amount && styles.errorInput, { paddingLeft: 28 }]}
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={expenseData.amount}
                  onChangeText={(text) => {
                    setExpenseData({ ...expenseData, amount: text });
                    setErrors(prev => ({ ...prev, amount: false }));
                  }}
                  keyboardType="numeric"
                />
              </View>
              {errors.amount && <Text style={styles.errorText}>Amount is required</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, errors.description && styles.errorLabel]}>Description *</Text>
              <TextInput
                style={[styles.input, errors.description && styles.errorInput]}
                placeholder="Enter description"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={expenseData.description}
                onChangeText={(text) => {
                  setExpenseData({ ...expenseData, description: text });
                  setErrors(prev => ({ ...prev, description: false }));
                }}
              />
              {errors.description && <Text style={styles.errorText}>Description is required</Text>}
            </View>

            <TouchableOpacity 
              style={[styles.selectButton, errors.category && styles.errorSelectButton]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={[styles.label, errors.category && styles.errorLabel]}>Category *</Text>
              <View style={[styles.selectContent, errors.category && styles.errorSelectContent]}>
                <Text style={[styles.selectText, errors.category && styles.errorText]}>
                  {expenseData.category || 'Select category'}
                </Text>
                <Icon name="chevron-down" size={24} color={errors.category ? '#FF6B6B' : '#fff'} />
              </View>
              {errors.category && <Text style={styles.errorText}>Category is required</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.selectButton, errors.paidBy && styles.errorSelectButton]}
              onPress={() => setIsPaidByModalVisible(true)}
            >
              <View style={styles.selectLabelContainer}>
                <Text style={[styles.label, errors.paidBy && styles.errorLabel]}>Paid By *</Text>
              </View>
              <View style={[styles.selectContent, errors.paidBy && styles.errorSelectContent]}>
                <Text style={[styles.selectText, errors.paidBy && styles.errorText]}>
                  {expenseData.paidBy || 'Select paid by'}
                </Text>
                <Icon name="chevron-down" size={24} color={errors.paidBy ? '#FF6B6B' : '#fff'} />
              </View>
              {errors.paidBy && <Text style={styles.errorText}>Paid by is required</Text>}
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
              <CategoryGrid onSelectCategory={handleSelectCategory}
              onClose={() => setShowCategoryModal(false)} />
            </View>
          </View>
        </Modal>

        {/* Paid By Modal */}
        <Modal
          visible={isPaidByModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPaidByModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#2D5586', '#171E45']}
              style={styles.modalContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>Select Who Paid</Text>
                </View>
                <TouchableOpacity onPress={() => setIsPaidByModalVisible(false)}>
                  <Icon name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {renderPaidByMembersList()}
            </LinearGradient>
          </View>
        </Modal>

        <RegisteredUsersModal
          visible={showRegisteredUsersModal}
          onClose={() => setShowRegisteredUsersModal(false)}
          onSelectUsers={handleSelectUsers}
        />

        <CustomAlertModal
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          buttons={customAlert.buttons}
          icon={customAlert.icon}
          iconColor={customAlert.iconColor}
          onClose={() => setCustomAlert({ ...customAlert, visible: false })}
        />

        {renderSplitModal()}
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
    marginRight: 8,
  },
  friendChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    marginRight: 8,
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
    marginRight: 8,
  },
  friendInitialAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  friendInitialText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  friendName: {
    color: '#fff',
    fontSize: 14,
  },
  friendAddText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
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
  splitModalOverlayCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitModalContentCard: {
    width: '90%',
    backgroundColor: '#1B3D6E',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  splitModalHeaderCard: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitModalTitleCard: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  splitMembersListCard: {
    maxHeight: 300,
  },
  splitMemberRowCard2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitMemberAvatarCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#fff',
  },
  splitMemberInitialAvatarCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  splitMemberInitialTextCard: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 18,
  },
  splitMemberNameCard: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  splitAmountInputCard2: {
    width: 90,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    textAlign: 'right',
    color: '#222',
    fontWeight: '600',
    borderWidth: 2,
    borderColor: '#FFD96D',
    shadowColor: 'transparent',
  },
  splitSubmitButtonCard2: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginBottom: 8,
    width: '100%',
    alignSelf: 'center',
  },
  splitSubmitGradientCard2: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  splitSubmitTextCard2: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  payerRow: {
    backgroundColor: 'rgba(255, 217, 109, 0.1)', // Light gold background
    marginBottom: 16,
  },
  payerAvatar: {
    backgroundColor: '#FFD96D', // Gold background for payer
  },
  payerLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  payerAmount: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'flex-end',
  },
  payerAmountText: {
    color: '#FFD96D',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    backgroundColor: 'rgba(255, 217, 109, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFD96D',
  },
  adminBadgeText: {
    color: '#FFD96D',
    fontSize: 10,
    fontWeight: '600',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberInitialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitialText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  createdByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createdByLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  selectLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  membersList: {
    maxHeight: 300,
  },
  selectedMember: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorLabel: {
    color: '#FF6B6B',
  },
  errorInput: {
    borderColor: '#FF6B6B',
    borderWidth: 1,
  },
  errorSelectButton: {
    marginBottom: 4,
  },
  errorSelectContent: {
    borderColor: '#FF6B6B',
    borderWidth: 1,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
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
  splitModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddExpenseScreen; 