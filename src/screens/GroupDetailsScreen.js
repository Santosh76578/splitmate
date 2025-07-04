import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import ScreenWithBottomNav from '../components/ScreenWithBottomNav';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, updateDoc, serverTimestamp, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { calculateSettlements, simplifySettlements, calculateNetBalance } from '../utils/settlementCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import NotificationTriggers from '../utils/NotificationTriggers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.8;

const categoryIcons = {
  Food: require('../../assets/category/Food.png'),
  Drinks: require('../../assets/category/Drinks.png'),
  Trip: require('../../assets/category/trip.png'),
  Party: require('../../assets/category/party.png'),
  Groccery: require('../../assets/category/grocery.png'),
  Gift: require('../../assets/category/Gift.png'),
  Entertainment: require('../../assets/category/Entertainment.png'),
  Office: require('../../assets/category/Office.png'),
  Booking: require('../../assets/category/Bookings.png'),
  Travel: require('../../assets/category/travel.png'),
  Miscellaneous: require('../../assets/category/misscelenous.png'),
};

function normalizeMembers(members) {
  return (members || []).map(member => ({
    ...member,
    isAdmin: member.isAdmin || member.role === 'admin',
  }));
}

// Ensure group is in guestGroups for guest users
async function ensureGroupInGuestGroups(groupId, guestUid) {
  const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
  if (!guestGroups.some(g => g.id === groupId)) {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists()) {
      const data = groupDoc.data();
      guestGroups.push({
        id: groupId,
        name: data.name,
        description: data.description || '',
        category: data.category || 'Miscellaneous',
        categoryIconKey: data.categoryIconKey || 'Miscellaneous',
        members: data.members || [],
        createdBy: data.createdBy,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        memberIds: data.memberIds || []
      });
      await AsyncStorage.setItem('guestGroups', JSON.stringify(guestGroups));
    }
  }
}

const GroupDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState('Expenses');
  const [groupData, setGroupData] = useState(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [groupSettlements, setGroupSettlements] = useState([]);
  const [firestoreUpdateTrigger, setFirestoreUpdateTrigger] = useState(0);
  const { groupId, guestId: guestIdFromParams, expenseId: highlightExpenseId } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const [expenseMenuVisible, setExpenseMenuVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseMenuPosition, setExpenseMenuPosition] = useState({ x: 0, y: 0 });
  const expenseButtonRefs = useRef({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [splitError, setSplitError] = useState('');
  const expenseListRef = useRef(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [guestName, setGuestName] = useState('');
  const firestoreSettlementsRef = useRef([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Get current user and their permissions
  const currentUser = auth.currentUser;
  const isAnonymousUser = currentUser?.isAnonymous;
  const currentUserPermissions = groupData?.members?.find(m => m.id === (currentUser?.uid || currentUserId))?.permissions;

  // Always use the real UID if available
  const effectiveUserId = currentUser?.uid || currentUserId;
  // Consider admin as member
  const isCurrentUserMember = groupData?.members?.some(m => String(m.id) === String(effectiveUserId) || (m.role === 'admin' && m.id === String(effectiveUserId)));

  // This is the core data fetching logic
  const loadGroupData = useCallback(async () => {
    if (!groupId) {
      setGroupLoading(false);
      return;
    }
    
    setGroupLoading(true);

    try {
      const user = auth.currentUser;
      const isGuest = user?.isAnonymous;
      const userId = user?.uid || guestIdFromParams;

      if (!userId) {
        setGroupData(null);
        setGroupLoading(false);
        return;
      }
      
      setCurrentUserId(userId);
      
      if (isGuest) {
        await ensureGroupInGuestGroups(groupId, userId);
        // Guest user: first try to load from AsyncStorage (groups they created)
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        let group = guestGroups.find(g => g.id === groupId);
        
        // If not found in AsyncStorage, check Firestore (groups they're a member of)
        if (!group) {
          try {
            const groupDocRef = doc(db, 'groups', groupId);
            const groupDocSnap = await getDoc(groupDocRef);
            if (groupDocSnap.exists()) {
              const data = groupDocSnap.data();
              // Check if this guest user is a member of this group
              const isMember = data.memberIds && data.memberIds.includes(userId);
              if (isMember) {
                group = {
                  ...data,
                  id: groupDocSnap.id,
                  members: normalizeMembers(data.members)
                };
                // Add to guestGroups in AsyncStorage if not already present
                const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
                if (!guestGroups.some(g => g.id === groupId)) {
                  guestGroups.push({
                    id: groupId,
                    name: data.name,
                    description: data.description || '',
                    category: data.category || 'Miscellaneous',
                    categoryIconKey: data.categoryIconKey || 'Miscellaneous',
                    members: data.members || [],
                    createdBy: data.createdBy,
                    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                    memberIds: data.memberIds || []
                  });
                  await AsyncStorage.setItem('guestGroups', JSON.stringify(guestGroups));
                }
              }
            }
          } catch (error) {
            // Error checking Firestore for guest group
          }
        } else {
          // Group found in AsyncStorage, normalize members
          group = {
            ...group,
            id: groupId,
            members: normalizeMembers(group.members)
          };
        }
        
        if (group) {
          setGroupData(group);
        } else {
          setGroupData(null);
          // Show error for deleted group
          Alert.alert(
            'Group Not Found',
            'This group has been deleted or you no longer have access to it.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.goBack();
                }
              }
            ]
          );
        }
      } else {
        // Regular user: load from Firestore
        const groupDocRef = doc(db, 'groups', groupId);
        const groupDocSnap = await getDoc(groupDocRef);
        
        if (groupDocSnap.exists()) {
          const data = groupDocSnap.data();
          setGroupData({
            ...data,
            id: groupDocSnap.id,
            members: normalizeMembers(data.members)
          });
        } else {
          setGroupData(null);
          // Show error for deleted group
          Alert.alert(
            'Group Not Found',
            'This group has been deleted or you no longer have access to it.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.goBack();
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      // Error loading group data
      setGroupData(null);
      Alert.alert(
        'Error',
        'Unable to load group information. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            }
          }
        ]
      );
    } finally {
      setGroupLoading(false);
    }
  }, [groupId, guestIdFromParams, navigation]);
  
  // Load data when the component mounts or groupId changes
  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  // Add real-time listener for group data changes (for new members)
  useEffect(() => {
    if (!groupId || !currentUser) return;


    
    const groupDocRef = doc(db, 'groups', groupId);
    const unsubscribe = onSnapshot(groupDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const normalizedMembers = normalizeMembers(data.members);
        

        
        setGroupData({
          ...data,
          id: doc.id,
          members: normalizedMembers
        });
        
        // Trigger settlement recalculation when members change
        setFirestoreUpdateTrigger(prev => prev + 1);
      } else {

      }
    }, (error) => {
      console.error('[GroupListener] Error listening to group changes:', error);
    });

    return () => {

      unsubscribe();
    };
  }, [groupId, currentUser]);
  
  // Clear settlements on mount to prevent stale data
  useEffect(() => {
    setGroupSettlements([]);
  }, []);
  
  // Refresh data when the screen is focused
  useFocusEffect(
    useCallback(() => {

      loadGroupData();
      // Also trigger settlement recalculation when screen is focused
      setFirestoreUpdateTrigger(prev => prev + 1);
    }, [loadGroupData])
  );

  const handleMemberNavigation = (screenName, params = {}) => {
    if (isCurrentUserMember) {
      navigation.navigate(screenName, { ...params, groupId });
    } else {
      Alert.alert(
        'Access Denied',
        'You need to be a member of this group to access this feature.',
        [{ text: 'OK' }]
      );
    }
  };

  // Update the chat button navigation
  const handleChatNavigation = () => {
    handleMemberNavigation('GroupChat');
  };

  // Update the add expense button navigation
  const handleAddExpenseNavigation = () => {
    handleMemberNavigation('AddExpenseInsideGroup', { members: groupData?.members || [] });
  };

  // Move fetchExpenses out so it can be reused
  const fetchExpenses = async () => {
    try {
      setExpensesLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const isGuestUser = currentUser.isAnonymous;

      if (isGuestUser) {
        // For guest users, first try to get expenses from AsyncStorage
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        let groupExpenses = guestExpenses.filter(expense => expense.groupId === groupId);
        // If no expenses found in AsyncStorage, check if this group is from Firestore
        if (groupExpenses.length === 0) {
          try {
            // Check if this group exists in Firestore and guest user is a member
            const groupDocRef = doc(db, 'groups', groupId);
            const groupDocSnap = await getDoc(groupDocRef);
            if (groupDocSnap.exists()) {
              const groupData = groupDocSnap.data();
              const isMember = groupData.memberIds && groupData.memberIds.includes(currentUser.uid);
              if (isMember) {
                // Load expenses from Firestore for this group
                const expensesRef = collection(db, 'expenses');
                const q = query(expensesRef, where('groupId', '==', groupId));
                const querySnapshot = await getDocs(q);
                groupExpenses = querySnapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                    id: doc.id,
                    ...data,
                    amount: parseFloat(data.amount || 0),
                    splitMethod: data.splitMethod || 'Equally',
                    splits: data.splits?.map(split => ({
                      memberId: split.memberId || split.id,
                      name: split.name,
                      amount: parseFloat(split.amount || 0)
                    })) || [],
                    paidBy: data.paidBy,
                    paidById: data.paidById,
                    createdAt: data.createdAt || new Date().toISOString()
                  };
                });
              }
            }
          } catch (error) {
            // Error checking Firestore for guest expenses
          }
        }
        setExpenses(groupExpenses);
      } else {
        // For regular users, get expenses from Firestore
        const expensesRef = collection(db, 'expenses');
        const q = query(expensesRef, where('groupId', '==', groupId));
        const querySnapshot = await getDocs(q);
        const expensesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Ensure proper data structure for each expense
          return {
            id: doc.id,
            ...data,
            amount: parseFloat(data.amount || 0),
            splitMethod: data.splitMethod || 'Equally',
            splits: data.splits?.map(split => ({
              memberId: split.memberId || split.id,
              name: split.name,
              amount: parseFloat(split.amount || 0)
            })) || [],
            paidBy: data.paidBy,
            paidById: data.paidById,
            createdAt: data.createdAt || new Date().toISOString()
          };
        });
        setExpenses(expensesData);
      }
    } catch (error) {
      // Error fetching expenses
    } finally {
      setExpensesLoading(false);
    }
  };

  // Add useFocusEffect for fetchExpenses
  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [groupId])
  );

  // Only use Firestore for settlements
  useEffect(() => {
    if (!groupId) return;
    const settlementsRef = collection(db, 'settlements');
    const q = query(settlementsRef, where('groupId', '==', groupId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const firestoreSettlements = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        firestoreSettlements.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt instanceof Object && 'toDate' in data.createdAt 
            ? data.createdAt.toDate() 
            : new Date(data.createdAt || Date.now()),
          settledAt: data.settledAt instanceof Object && 'toDate' in data.settledAt 
            ? data.settledAt.toDate() 
            : data.settledAt ? new Date(data.settledAt) : null
        });
      });

      
      // Update the ref with current Firestore settlements
      firestoreSettlementsRef.current = firestoreSettlements;
      
      // Trigger settlement recalculation when Firestore settlements change
      setFirestoreUpdateTrigger(prev => prev + 1);
      
      // The settlement calculation useEffect will handle combining with calculated settlements

    });
    return () => unsubscribe();
  }, [groupId]);

  // Calculate settlements from current expenses
  useEffect(() => {
    if (!expenses || !groupData?.members || expenses.length === 0 || groupData.members.length === 0) {
      return;
    }
    try {
      const currentFirestoreSettlements = firestoreSettlementsRef.current;
      const members = groupData.members;
      // 1. For each pair (A owes B), sum all splits where A owes B across all expenses
      const pairwiseOwes = {};
      members.forEach(from => {
        members.forEach(to => {
          if (from.id !== to.id) {
            const key = `${from.id}->${to.id}`;
            pairwiseOwes[key] = 0;
          }
        });
      });
      expenses.forEach(expense => {
        const paidById = expense.paidById || expense.paidBy;
        members.forEach(member => {
          if (member.id !== paidById) {
            const split = expense.splits?.find(s => s.memberId === member.id || s.memberId === member.name);
            if (split) {
              const splitAmount = parseFloat(split.amount || 0);
              if (splitAmount > 0.01) {
                const key = `${member.id}->${paidById}`;
                if (pairwiseOwes[key] !== undefined) {
                  pairwiseOwes[key] += splitAmount;
                }
              }
            }
          }
        });
      });
      // 2. Subtract any settled amount for that pair
      const pairwiseSettled = {};
      currentFirestoreSettlements.forEach(settlement => {
        if (settlement.status === 'settled') {
          const key = `${settlement.from?.id}->${settlement.to?.id}`;
          pairwiseSettled[key] = (pairwiseSettled[key] || 0) + parseFloat(settlement.amount || 0);
        }
      });
      // 3. Prepare settlements array
      const allSettlements = [];
      Object.entries(pairwiseOwes).forEach(([key, totalOwed]) => {
        const settled = pairwiseSettled[key] || 0;
        const [fromId, toId] = key.split('->');
        const from = members.find(m => m.id === fromId);
        const to = members.find(m => m.id === toId);
        if (!from || !to) return;
        if (totalOwed - settled > 0.01) {
          allSettlements.push({
            id: `${groupId}-${fromId}-${toId}-${(totalOwed - settled).toFixed(2)}`,
            from: { id: fromId, name: from.name },
            to: { id: toId, name: to.name },
            amount: parseFloat((totalOwed - settled).toFixed(2)),
            status: 'pending',
            createdAt: new Date().toISOString(),
            groupId
          });
        } else if (settled > 0.01) {
          allSettlements.push({
            id: `${groupId}-${fromId}-${toId}-${settled.toFixed(2)}`,
            from: { id: fromId, name: from.name },
            to: { id: toId, name: to.name },
            amount: parseFloat(settled.toFixed(2)),
            status: 'settled',
            createdAt: new Date().toISOString(),
            groupId
          });
        }
      });
      // Remove duplicates (same from, to, amount, status)
      const uniqueSettlements = allSettlements.filter((settlement, idx, arr) =>
        idx === arr.findIndex(s =>
          s.from?.id === settlement.from?.id &&
          s.to?.id === settlement.to?.id &&
          Math.abs(s.amount - settlement.amount) < 0.01 &&
          s.status === settlement.status
        )
      );
      setGroupSettlements(uniqueSettlements);
    } catch (error) {
      console.error('[SettlementCalculation] Error calculating settlements:', error);
    }
  }, [expenses, groupData, groupId, firestoreUpdateTrigger]);

  // Add this useEffect after groupData is set
  useEffect(() => {
    const fetchUserName = async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          return data.name || data.displayName || 'User';
        }
      } catch (e) {}
      return 'User';
    };

    if (groupData?.members) {
      // Only update if there are members with missing/unknown names
      const membersNeedingUpdate = groupData.members.filter(
        (member) => !member.name || member.name === 'Unknown'
      );
      if (membersNeedingUpdate.length === 0) return; // No update needed

      const updateMembers = async () => {
        const updated = await Promise.all(
          groupData.members.map(async (member) => {
            if (!member.name || member.name === 'Unknown') {
              const name = await fetchUserName(member.id);
              return { ...member, name };
            }
            return member;
          })
        );
        // Only update if something actually changed
        const changed = updated.some((m, i) => m.name !== groupData.members[i].name);
        if (changed) {
          setGroupData((prev) => ({ ...prev, members: normalizeMembers(updated) }));
        }
      };
      updateMembers();
    }
  }, [groupData?.members]);

  useEffect(() => {
    const fetchGuestName = async () => {
      if (isAnonymousUser && groupData?.createdBy?.id === currentUser?.uid) {
        const name = await AsyncStorage.getItem('userName');
        setGuestName(name || 'guest');
      }
    };
    fetchGuestName();
  }, [isAnonymousUser, groupData?.createdBy?.id, currentUser?.uid]);

  // Static group members data
  const groupMembers = [
    {
      id: '1',
      name: 'Will Smith',
      phone: '+85 4566862685',
      isAdmin: true,
      avatar: require('../../assets/member-4.png'),
    },
    {
      id: '2',
      name: 'Will Smith',
      phone: '+85 4566862685',
      avatar: require('../../assets/member-3.png'),
    },
    {
      id: '3',
      name: 'Will Smith',
      phone: '+85 4566862685',
      avatar: require('../../assets/member-2.png'),
    },
    {
      id: '4',
      name: 'Will Smith',
      phone: '+85 4566862685',
      avatar: require('../../assets/member-1.png'),
    },
  ];

  const categoryData = [
    { label: 'Beverages', percentage: 30, color: '#FF7F50' },
    { label: 'Rent', percentage: 25, color: '#FFB6C1' },
    { label: 'Food', percentage: 20, color: '#9370DB' },
    { label: 'Travelling', percentage: 15, color: '#87CEEB' },
    { label: 'others', percentage: 10, color: '#90EE90' },
  ];

  const memberData = [
    { label: 'Tom', percentage: 30, color: '#FF7F50' },
    { label: 'Karen', percentage: 25, color: '#FFB6C1' },
    { label: 'Smith', percentage: 20, color: '#9370DB' },
    { label: 'Will', percentage: 15, color: '#87CEEB' },
    { label: 'John', percentage: 10, color: '#90EE90' },
  ];

  const PieChart = ({ data, title }) => {
    const radius = Dimensions.get('window').width * 0.3;
    const strokeWidth = radius * 0.2;
    const center = radius + strokeWidth;
    let startAngle = 0;

    // Filter out data with 0 percentage
    const filteredData = data.filter(item => item.percentage > 0);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.chartContent}>
          <Svg width={center * 2} height={center * 2}>
            {filteredData.length === 1 ? (
              // If only one category, show full circle
              <Circle
                cx={center}
                cy={center}
                r={radius}
                fill={filteredData[0].color}
                stroke="#1B3D6E"
                strokeWidth={2}
              />
            ) : (
              // Multiple categories, show pie chart
              filteredData.map((segment, index) => {
                const sweepAngle = (segment.percentage / 100) * 360;
                const endAngle = startAngle + sweepAngle;
                const largeArcFlag = sweepAngle > 180 ? 1 : 0;

                // Calculate coordinates for the path
                const x1 = center + radius * Math.cos((startAngle - 90) * Math.PI / 180);
                const y1 = center + radius * Math.sin((startAngle - 90) * Math.PI / 180);
                const x2 = center + radius * Math.cos((endAngle - 90) * Math.PI / 180);
                const y2 = center + radius * Math.sin((endAngle - 90) * Math.PI / 180);

                const pathData = `
                  M ${center} ${center}
                  L ${x1} ${y1}
                  A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
                  Z
                `;

                startAngle += sweepAngle;

                return (
                  <Path
                    key={index}
                    d={pathData}
                    fill={segment.color}
                    stroke="#1B3D6E"
                    strokeWidth={2}
                  />
                );
              })
            )}
            <Circle
              cx={center}
              cy={center}
              r={radius * 0.6}
              fill="#1B3D6E"
            />
          </Svg>
        </View>
        <View style={styles.legendContainer}>
          {filteredData.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendPercentage}>{item.percentage}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const handleRefresh = async () => {
    console.log('[GroupDetailsScreen] Manual refresh triggered');
    setRefreshing(true);
    try {
      await loadGroupData();
      await fetchExpenses();
      console.log('[GroupDetailsScreen] Refresh completed');
    } catch (error) {
      console.error('[GroupDetailsScreen] Refresh error:', error);
      Alert.alert('Error', 'Failed to refresh group data.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (currentUser?.isAnonymous) {
                // Guest user: delete from AsyncStorage
                const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
                const expenseToDelete = guestExpenses.find(e => e.id === expenseId);
                const updatedExpenses = guestExpenses.filter(e => e.id !== expenseId);
                await AsyncStorage.setItem('guestExpenses', JSON.stringify(updatedExpenses));
                setExpenses(updatedExpenses);
                
                // Send notification for expense deletion (guest users)
                if (expenseToDelete && groupData && groupData.memberIds && groupData.memberIds.length > 0) {
                  await NotificationTriggers.sendCustomNotification(
                    groupData.memberIds,
                    'Expense Deleted',
                    `"${expenseToDelete.description}" was deleted from "${groupData.name}"`,
                    'expense_deleted',
                    {
                      screen: 'GroupDetails',
                      params: { groupId }
                    }
                  );
                }
              } else {
                // Regular user: delete from Firestore
                await deleteDoc(doc(db, 'expenses', expenseId));
                setExpenses(prev => prev.filter(e => e.id !== expenseId));
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense.');
            }
          }
        }
      ]
    );
  };

  const renderExpensesByDate = () => {
    if (expensesLoading) {
      return (
        <View style={styles.expenseListContainer}>
          <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20 }}>Loading...</Text>
        </View>
      );
    }
    if (expenses.length === 0) {
      return (
        <View style={styles.expenseListContainer}>
          <View style={styles.emptyStateContainer}>
            <Image
              source={require('../../assets/expense2.png')}
              style={styles.emptyStateImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyStateTitle}>📚 No Expenses Added</Text>
            <Text style={styles.emptyStateText}>
              Looks like it's all quiet here 💤 — add your first expense now 💰 and keep your group spending in check 📊!
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('AddExpenseInsideGroup', { groupId, members: groupData?.members || [] })}
            >
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.emptyStateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.emptyStateButtonText}>Add Expense  +</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <FlatList
        ref={expenseListRef}
        data={expenses}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.expenseCard,
              highlightExpenseId === item.id ? { borderColor: '#FFD96D', borderWidth: 2, backgroundColor: '#2D5586' } : null
            ]}
          >
            <View style={styles.expenseIconContainer}>
              <LinearGradient
                colors={['#8B6AD2', '#211E83']}
                style={styles.expenseIconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image 
                  source={item.category ? categoryIcons[item.category] || categoryIcons['Miscellaneous'] : categoryIcons['Miscellaneous']}
                  style={styles.expenseIcon} 
                />
              </LinearGradient>
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseTitle}>{item.description}</Text>
              <View style={styles.paidByContainer}>
                <Text style={styles.paidByText}>Paid by {item.paidBy}</Text>
              </View>
            </View>
            <Text style={styles.expenseAmount}>${item.amount}</Text>
            {/* <TouchableOpacity
              ref={ref => { expenseButtonRefs.current[item.id] = ref; }}
              style={{ position: 'absolute', top: 5, right: 10, zIndex: 2, padding: 6 }}
              onPress={() => {
                if (expenseButtonRefs.current[item.id]) {
                  expenseButtonRefs.current[item.id].measureInWindow((x, y, width, height) => {
                    setExpenseMenuPosition({ x: x - 120, y: y + height + 8 });
                    setSelectedExpense(item);
                    setExpenseMenuVisible(true);
                  });
                } else {
                  setSelectedExpense(item);
                  setExpenseMenuVisible(true);
                }
              }}
            >
              <Icon name="dots-vertical" size={22} color="#fff" />
            </TouchableOpacity> */}
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
          <View style={styles.expenseListContainer}>
            <View style={styles.emptyStateContainer}>
              <Image
                source={require('../../assets/expense2.png')}
                style={styles.emptyStateImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyStateTitle}>📚 No Expenses Added</Text>
              <Text style={styles.emptyStateText}>
                Looks like it's all quiet here 💤 — add your first expense now 💰 and keep your group spending in check 📊!
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => navigation.navigate('AddExpenseInsideGroup', { groupId, members: groupData?.members || [] })}
              >
                <LinearGradient
                  colors={['#FFD96D', '#FFA211']}
                  style={styles.emptyStateButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.emptyStateButtonText}>Add Expense  +</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  };

  const handleSettleNow = async (settlementId) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not found. Please log in again.');
        return;
      }
      const isAdmin = groupData?.members?.some(member => member.id === currentUser.uid && member.isAdmin);
      if (!isAdmin) {
        Alert.alert('Error', 'Only the group admin can mark settlements as completed');
        return;
      }

      const localSettlement = groupSettlements.find(s => s.id === settlementId);
      if (!localSettlement) {
        Alert.alert('Error', 'Settlement not found');
        return;
      }

      // Check if this is a calculated settlement (no Firestore ID) or a Firestore settlement
      const isCalculatedSettlement = !settlementId || settlementId.length <= 20;

      if (isCalculatedSettlement) {
        // Create a new Firestore settlement for calculated settlements
        const newSettlement = {
          groupId,
          amount: localSettlement.amount,
          from: localSettlement.from,
          to: localSettlement.to,
          status: 'settled',
          createdAt: serverTimestamp(),
          settledAt: serverTimestamp(),
          settledBy: {
            id: currentUser.uid,
            name: currentUser.displayName || 'User',
            email: currentUser.email
          },
          createdBy: {
            id: currentUser.uid,
            name: currentUser.displayName || 'User',
            email: currentUser.email
          },
          requestType: 'settlement_request'
        };
        await addDoc(collection(db, 'settlements'), newSettlement);
        setSuccessMessage('Payment marked as settled successfully');
        setShowSuccessModal(true);
      } else {
        // Check for an existing pending settlement in Firestore
        const settlementsRef = collection(db, 'settlements');
        const q = query(
          settlementsRef,
          where('groupId', '==', groupId),
          where('from.id', '==', localSettlement.from.id),
          where('to.id', '==', localSettlement.to.id),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // Update the first matching pending settlement
          const docId = snapshot.docs[0].id;
          await updateDoc(doc(db, 'settlements', docId), {
            status: 'settled',
            settledAt: serverTimestamp(),
            settledBy: {
              id: currentUser.uid,
              name: currentUser.displayName || 'User',
              email: currentUser.email
            }
          });
        } else {
          // No pending settlement, create and mark as settled
          const newSettlement = {
            groupId,
            amount: localSettlement.amount,
            from: localSettlement.from,
            to: localSettlement.to,
            status: 'settled',
            createdAt: serverTimestamp(),
            settledAt: serverTimestamp(),
            settledBy: {
              id: currentUser.uid,
              name: currentUser.displayName || 'User',
              email: currentUser.email
            },
            createdBy: {
              id: currentUser.uid,
              name: currentUser.displayName || 'User',
              email: currentUser.email
            },
            requestType: 'settlement_request'
          };
          await addDoc(collection(db, 'settlements'), newSettlement);
        }

        setSuccessMessage('Payment marked as settled successfully');
        setShowSuccessModal(true);
      }
      
      // Update local state immediately for instant UI feedback
      setGroupSettlements(prevSettlements => 
        prevSettlements.map(settlement => {
          if (settlement.id === settlementId) {
            return {
              ...settlement,
              status: 'settled',
              settledAt: new Date(),
              settledBy: {
                id: currentUser.uid,
                name: currentUser.displayName || 'User',
                email: currentUser.email
              }
            };
          }
          return settlement;
        })
      );
      
      // Do not update local state, Firestore listener will update UI
    } catch (error) {
      Alert.alert('Error', 'Failed to settle payment. Please try again.');
    }
  };

  const getSplitMethodColor = (method) => {
    switch (method?.toLowerCase()) {
      case 'equally':
        return '#4CAF50'; // Green
      case 'unequally':
        return '#FF9800'; // Orange
      case 'custom':
        return '#2196F3'; // Blue
      default:
        return '#8B6AD2'; // Default purple
    }
  };

  const renderSettlementCard = (settlement) => {
    const currentUser = auth.currentUser;
    const isAdmin = currentUser && groupData?.members?.some(member => member.id === currentUser.uid && member.isAdmin);
    // Calculated settlements don't have a status, so treat them as pending
    const isPendingRequest = settlement.status === 'pending' || !settlement.status;
    const isSettled = settlement.status === 'settled';

    // Format the date safely
    const formatDate = (date) => {
      if (!date) return 'No date';
      try {
        const dateObj = date instanceof Date ? date : new Date(date);
        return dateObj.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      } catch (error) {
        return 'Invalid date';
      }
    };

    // Compose the description (e.g. "John will pay to Smith")
    const fromName = settlement.from?.name || 'Unknown';
    const toName = settlement.to?.name || 'Unknown';
    const description = `${fromName} will pay to ${toName}`;

    return (
      <View style={styles.settlementCardNew}>
        <View style={styles.settlementRow}>
          {/* Left User */}
          <View style={styles.settlementUserCol}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {fromName && fromName.length > 0 ? fromName.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.avatarName}>{fromName}</Text>
          </View>

          {/* Center Info */}
          <View style={styles.settlementCenterCol}>
            <Text style={styles.settlementAmountNew}>${settlement.amount.toFixed(2)}</Text>
            <Text style={styles.settlementDescription}>{description}</Text>
            {isPendingRequest ? (
              <TouchableOpacity
                style={styles.settleNowButton}
                onPress={() => handleSettleNow(settlement.id)}
                disabled={!isAdmin}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFD96D', '#FFB800']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.settleNowGradient}
                >
                  <Text style={styles.settleNowButtonText}>Settle Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.settledButtonNew}>
                <Text style={styles.settledButtonTextNew}>Settled</Text>
              </View>
            )}
          </View>

          {/* Right User */}
          <View style={styles.settlementUserCol}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {toName && toName.length > 0 ? toName.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.avatarName}>{toName}</Text>
          </View>
        </View>
      </View>
    );
  };

  const handleApproveSettlement = async (settlementId) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not found. Please log in again.');
        return;
      }
      const isAdmin = groupData?.members?.some(member => member.id === currentUser.uid && member.isAdmin);
      if (!isAdmin) {
        Alert.alert('Error', 'Only the group admin can approve settlements');
        return;
      }

      const settlementRef = doc(db, 'settlements', settlementId);
      await updateDoc(settlementRef, {
        status: 'settled',
        settledAt: serverTimestamp(),
        settledBy: {
          id: currentUser.uid,
          name: currentUser.displayName || 'User',
          email: currentUser.email
        }
      });

      Alert.alert('Success', 'Settlement approved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to approve settlement. Please try again.');
    }
  };

  const renderSettlements = () => {
    console.log('[RenderSettlements] Current settlements:', groupSettlements);
    console.log('[RenderSettlements] Number of settlements:', groupSettlements?.length || 0);
    
    if (!groupSettlements || groupSettlements.length === 0) {
      return (
        <View style={styles.mainContainer}>
          <View style={styles.emptyStateContainer}>
            <Image
              source={require('../../assets/expense2.png')}
              style={styles.emptyStateImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyStateTitle}>No Pending Settlements</Text>
            <Text style={styles.emptyStateText}>
              All settlements have been completed! Add a new expense to generate new settlements.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('AddExpenseInsideGroup', { groupId, members: groupData?.members || [] })}
            >
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.emptyStateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.emptyStateButtonText}>Add Expense  +</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Remove any duplicate settlements based on ID
    const uniqueSettlements = groupSettlements.filter((settlement, index, self) => 
      index === self.findIndex(s => s.id === settlement.id)
    );
    
    if (uniqueSettlements.length !== groupSettlements.length) {
      console.warn('[RenderSettlements] Removed duplicate settlements:', {
        original: groupSettlements.length,
        unique: uniqueSettlements.length
      });
    }

    // Group settlements by date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groupedSettlements = {
      today: [],
      yesterday: [],
      older: []
    };

    uniqueSettlements.forEach(settlement => {
      const settlementDate = new Date(settlement.createdAt || Date.now());
      if (settlementDate.toDateString() === today.toDateString()) {
        groupedSettlements.today.push(settlement);
      } else if (settlementDate.toDateString() === yesterday.toDateString()) {
        groupedSettlements.yesterday.push(settlement);
      } else {
        groupedSettlements.older.push(settlement);
      }
    });

    console.log('[RenderSettlements] Grouped settlements:', groupedSettlements);

    return (
      <ScrollView
        style={styles.settlementsScrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Today's Settlements */}
        {groupedSettlements.today.length > 0 && (
          <View style={styles.dateSection}>
            {groupedSettlements.today.map((settlement, idx) => {
              // Create a unique key that includes settlement type and unique identifier
              const isFirestoreSettlement = settlement.id && settlement.id.length > 20;
              const uniqueKey = isFirestoreSettlement 
                ? `firestore-${settlement.id}`
                : `calculated-${settlement.from?.id}-${settlement.to?.id}-${settlement.amount}-${idx}`;
              
              return (
                <View key={uniqueKey}>
                  {renderSettlementCard(settlement)}
                </View>
              );
            })}
          </View>
        )}

        {/* Yesterday's Settlements */}
        {groupedSettlements.yesterday.length > 0 && (
          <View style={styles.dateSection}>
            {groupedSettlements.yesterday.map((settlement, idx) => {
              // Create a unique key that includes settlement type and unique identifier
              const isFirestoreSettlement = settlement.id && settlement.id.length > 20;
              const uniqueKey = isFirestoreSettlement 
                ? `firestore-${settlement.id}`
                : `calculated-${settlement.from?.id}-${settlement.to?.id}-${settlement.amount}-${idx}`;
              
              return (
                <View key={uniqueKey}>
                  {renderSettlementCard(settlement)}
                </View>
              );
            })}
          </View>
        )}

        {/* Older Settlements */}
        {groupedSettlements.older.length > 0 && (
          <View style={styles.dateSection}>
            {groupedSettlements.older.map((settlement, idx) => {
              // Create a unique key that includes settlement type and unique identifier
              const isFirestoreSettlement = settlement.id && settlement.id.length > 20;
              const uniqueKey = isFirestoreSettlement 
                ? `firestore-${settlement.id}`
                : `calculated-${settlement.from?.id}-${settlement.to?.id}-${settlement.amount}-${idx}`;
              
              return (
                <View key={uniqueKey}>
                  {renderSettlementCard(settlement)}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderAnalytics = () => {
    // Calculate total spending
    const totalSpending = expenses.reduce((total, expense) => total + parseFloat(expense.amount || 0), 0);

    // If there are no expenses, show empty state
    if (expenses.length === 0) {
      return (
        <View style={styles.analyticsContainer}>
          <View style={styles.emptyStateContainer}>
            <Image
              source={require('../../assets/expense2.png')}
              style={styles.emptyStateImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyStateTitle}>No Analytics Yet</Text>
            <Text style={styles.emptyStateText}>
              Add your first expense to see analytics and insights for your group spending!
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('AddExpenseInsideGroup', { groupId, members: groupData?.members || [] })}
            >
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.emptyStateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.emptyStateButtonText}>Add Expense  +</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Calculate category-wise spending
    const categorySpending = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Others';
      const amount = parseFloat(expense.amount || 0);
      categorySpending[category] = (categorySpending[category] || 0) + amount;
    });

    // Format category data with fixed colors
    const categoryColors = {
      'Food': '#FF7F50',         // Coral orange
      'Drinks': '#FFB6C1',       // Pink
      'Trip': '#9370DB',         // Purple
      'Party': '#87CEEB',        // Sky blue
      'Groccery': '#90EE90',     // Light green
      'Gift': '#FFD700',         // Gold
      'Entertainment': '#20B2AA', // Light sea green
      'Office': '#F08080',       // Light coral
      'Booking': '#98FB98',      // Pale green
      'Travel': '#BA55D3',       // Medium orchid
      'Miscellaneous': '#B0C4DE', // Light steel blue
      'Others': '#DDA0DD'        // Plum
    };

    const categoryData = Object.entries(categorySpending).map(([category, amount]) => ({
      label: category,
      percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
      color: categoryColors[category] || categoryColors['Others'] // Use Others color for unknown categories
    }));

    // Calculate member-wise spending
    const memberSpending = {};
    expenses.forEach(expense => {
      const paidBy = expense.paidBy;
      const amount = parseFloat(expense.amount || 0);
      memberSpending[paidBy] = (memberSpending[paidBy] || 0) + amount;
    });

    // Format member data with fixed colors
    const memberColors = ['#FF7F50', '#FFB6C1', '#9370DB', '#87CEEB', '#90EE90', '#FFD700', '#20B2AA', '#F08080', '#98FB98', '#BA55D3'];
    const memberData = Object.entries(memberSpending).map(([member, amount], index) => ({
      label: member,
      percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
      color: memberColors[index % memberColors.length]
    }));

    return (
      <ScrollView
        style={styles.analyticsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Total Spending Display */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Group Expenditure</Text>
          <Text style={styles.totalAmount}>${totalSpending.toFixed(2)}</Text>
        </View>

        <PieChart data={categoryData} title="Categorywise spendings" />
        <PieChart data={memberData} title="Memberwise Spendings" />
      </ScrollView>
    );
  };

  // Helper function for category colors
  const getCategoryColor = (category) => {
    const colors = {
      Food: '#FF7F50',
      Transport: '#FFB6C1',
      Shopping: '#9370DB',
      Entertainment: '#87CEEB',
      Utilities: '#90EE90',
      Others: '#B0C4DE'
    };
    return colors[category] || colors.Others;
  };

  // Helper function for member colors
  const getMemberColor = (index) => {
    const colors = ['#FF7F50', '#FFB6C1', '#9370DB', '#87CEEB', '#90EE90', '#FFD700', '#20B2AA', '#F08080', '#98FB98', '#BA55D3'];
    return colors[index % colors.length];
  };

  const toggleDrawer = () => {
    const toValue = isDrawerOpen ? 0 : 1;
    Animated.timing(drawerAnimation, {
      toValue,
      duration: 400,
      useNativeDriver: true,
    }).start();
    setIsDrawerOpen(!isDrawerOpen);
  };

  const renderDrawer = () => {
    const translateY = drawerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [-SCREEN_HEIGHT, 0],
    });

    return (
      <Animated.View 
        style={[
          styles.drawer,
          {
            transform: [{ translateY }],
            opacity: drawerAnimation,
            pointerEvents: isDrawerOpen ? 'auto' : 'none',
          }
        ]}
      >
        <SafeAreaView style={styles.drawerContent}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerTitleContainer}>
              <Image 
                source={require('../../assets/avatar.png')} 
                style={styles.groupIcon}
              />
              <View>
                <Text style={styles.drawerTitle}>Group Details</Text>
                <Text style={styles.groupTitle}>{groupData?.name || 'Loading...'}</Text>
                <Text style={styles.createdBy}>
                  Created by {
                    (isAnonymousUser && groupData?.createdBy?.id === currentUser?.uid)
                      ? guestName
                      : (groupData?.createdBy?.name || 'Loading...')
                  }
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                toggleDrawer();
                navigation.navigate('EditGroupScreen', { groupId: groupId });
              }}
            >
              <Icon name="pencil" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.addMemberButton} 
            onPress={() => navigation.navigate('AddExpenseInsideGroup', { 
              groupId: groupData?.id || groupId,
              members: groupData?.members || []
            })}
          >
            <Icon name="plus" size={20} color="#FFB800" />
            <Text style={styles.addMemberText}>Add Member</Text>
          </TouchableOpacity>

          <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
            {groupData?.members?.map((member, idx) => (
              <View key={member.id ? member.id + '_' + idx : idx} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <View style={styles.memberInitialContainer}>
                    <Text style={styles.memberInitial}>{member.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.memberDetails}>
                    <View style={styles.memberNameContainer}>
                      <Text style={styles.memberName}>{member.name || 'Unknown'}</Text>
                      {member.isAdmin && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberPhone}>{member.phone || member.phoneNumber || 'No phone number'}</Text>
                  </View>
                </View>
                {!member.isAdmin && currentUserPermissions?.canRemoveMembers && (
                  <TouchableOpacity style={styles.deleteButton}>
                    <Icon name="delete-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={styles.minimizeButton} 
            onPress={toggleDrawer}
          >
            <Icon name="chevron-up" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Expenses':
        return renderExpensesByDate();
      case 'Settlements':
        return renderSettlements();
      case 'Analytics':
        return renderAnalytics();
      default:
        return null;
    }
  };

  // Add debug log for membership check before fallback UI
  if (!groupData || !groupData.members || groupData.members.length === 0 || !isCurrentUserMember) {
    // Membership check failed
  }

  if (groupLoading) {
    return (
      <LinearGradient colors={['#13386B', '#0B2442']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#2D5586" />
          <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
            <Text style={{color: '#fff'}}>Loading group data...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Handle case where group doesn't exist or user doesn't have access
  if (!groupData) {
  return (
    <LinearGradient colors={['#13386B', '#0B2442']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2D5586" />
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.leftHeader}>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                >
                  <Icon name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                  <Text style={styles.groupName}>Group Not Found</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Icon name="alert-circle-outline" size={64} color="#FF6B6B" style={{ marginBottom: 16 }} />
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
              Group Not Found
            </Text>
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24, opacity: 0.8 }}>
              This group has been deleted or you no longer have access to it.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#FFB800',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8
              }}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#13386B', '#0B2442']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2D5586" />
        {(!groupData.members || groupData.members.length === 0 || !isCurrentUserMember) ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', margin: 24 }}>
              You are not a member of this group or the group data is incomplete. Please contact the group admin.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.leftHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      if (isCurrentUserMember && route.params?.code && !navigation.canGoBack()) {
                        navigation.navigate('MainTabs', { screen: 'GroupsTab' });
                      } else if (navigation.canGoBack()) {
                        navigation.goBack();
                      } else {
                        navigation.navigate('MainTabs', { screen: 'GroupsTab' });
                      }
                    }}
                    style={styles.backButton}
                  >
                    <Icon name="arrow-left" size={24} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.headerTitle}>
                    <Text style={styles.groupName}>{groupData?.name || 'Loading...'}</Text>
                    <Text style={styles.createdBy}>Created by {groupData?.createdBy?.name || 'Loading...'}</Text>
                  </View>
                </View>
                <View style={styles.rightHeader}>
                  <TouchableOpacity 
                    style={styles.headerButton} 
                    onPress={toggleDrawer}
                  >
                    <Icon 
                      name={isDrawerOpen ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Expenses' && styles.activeTab]}
            onPress={() => setActiveTab('Expenses')}
          >
            <Text style={[styles.tabText, activeTab === 'Expenses' && styles.activeTabText]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Settlements' && styles.activeTab]}
            onPress={() => setActiveTab('Settlements')}
          >
            <Text style={[styles.tabText, activeTab === 'Settlements' && styles.activeTabText]}>Settlements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Analytics' && styles.activeTab]}
            onPress={() => setActiveTab('Analytics')}
          >
            <Text style={[styles.tabText, activeTab === 'Analytics' && styles.activeTabText]}>Analytics</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {renderContent()}
        </View>

        <TouchableOpacity 
          style={styles.chatButton}
          onPress={handleChatNavigation}
        >
          <Icon name="chat" size={24} color="#fff" />
          <Text style={styles.chatButtonText}>Chat</Text>
        </TouchableOpacity>

        {activeTab === 'Expenses' && (
          <TouchableOpacity 
            style={styles.fabButton}
            onPress={handleAddExpenseNavigation}
          >
            <LinearGradient
              colors={['#8B6AD2', '#211E83']}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Icon name="plus" size={30} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {renderDrawer()}
        <Animated.View 
          style={[
            styles.overlay,
            {
              opacity: drawerAnimation,
              pointerEvents: isDrawerOpen ? 'auto' : 'none',
            }
          ]} 
        >
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <View style={styles.overlayTouch} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <Modal
          visible={expenseMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setExpenseMenuVisible(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.01)' }}
            activeOpacity={1}
            onPress={() => setExpenseMenuVisible(false)}
          >
            <View style={{
              position: 'absolute',
              top: expenseMenuPosition.y,
              left: expenseMenuPosition.x,
              backgroundColor: '#23305A',
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 24,
              minWidth: 180,
              elevation: 8,
              alignItems: 'flex-start',
            }}>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, width: '100%' }}
                onPress={() => {
                  setExpenseMenuVisible(false);
                  if (selectedExpense) {
                    handleDeleteExpense(selectedExpense.id);
                  }
                }}
              >
                <Icon name="delete" type="material-community" color="#FF4D4F" size={20} />
                <Text style={{ color: '#FF4D4F', marginLeft: 12, fontSize: 16, fontWeight: '500' }}>Delete Expense</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
                onPress={() => setShowSuccessModal(false)}
              >
                <Icon name="close" size={28} color="#fff" />
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
              {/* Great Button */}
              <TouchableOpacity
                style={{
                  width: '100%',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
                onPress={() => setShowSuccessModal(false)}
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
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2D5586',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    marginLeft: 4,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  createdBy: {
    fontSize: 14,
    color: '#ccc',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 50,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFB800',
  },
  tabText: {
    color: '#ccc',
    fontSize: 16,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 20,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13386B',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
  },
  expenseIconContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 15,
  },
  expenseIconGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 24,
    height: 24,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  paidByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidByAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
  },
  paidByText: {
    fontSize: 14,
    color: '#ccc',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop:10,
  },
  chatButton: {
    position: 'absolute',
    right: 16,
    top: 115,
    backgroundColor: '#6C63FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  chatButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  settlementCardNew: {
    backgroundColor: '#2D5586',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 18,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  settlementUserCol: {
    alignItems: 'center',
    width: 70,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A78BFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#A78BFA',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  avatarName: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  settlementCenterCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  settlementAmountNew: {
    color: '#30C04F',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  settlementDescription: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  settleNowButton: {
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 0,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  settleNowGradient: {
    width: '100%',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleNowButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  settledButtonNew: {
    backgroundColor: '#30C04F',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 0,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  settledButtonTextNew: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  settlementsContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#1B3D6E',
    zIndex: 1000,
    elevation: 5,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop:50,
  },
  minimizeButton: {
    alignSelf: 'center',
    padding: 10,
    marginTop: 10,
    borderWidth:1,
    borderColor:'#fff',
    borderRadius:50,
    marginBottom:5,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  drawerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 46,
    height: 46,
    marginRight: 12,
    borderRadius: 8,
  },
  drawerTitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    marginBottom: 4,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  addMemberText: {
    color: '#FFB800',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberInitialContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#8B6AD2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberDetails: {
    flex: 1,
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
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
  memberPhone: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  fabButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    overflow: 'hidden',
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  totalContainer: {
    backgroundColor: '#1B3D6E',
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 8,
  },
  totalAmount: {
    color: '#2ECC71',
    fontSize: 28,
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: '#1B3D6E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  chartContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  legendContainer: {
    width: '100%',
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  legendPercentage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  comingSoon: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  overlayTouch: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  settlementsScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateSection: {
    marginBottom: 20,
  },
  expenseListContainer: {
    flex: 1,
    padding: 16,
  },
  pendingButton: {
    backgroundColor: '#FFA500',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  requestMessageContainer: {
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  requestMessage: {
    color: '#FFB800',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  emptyStateImage: {
    width: 220,
    height: 180,
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.85,
  },
  emptyStateButton: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyStateButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  emptyStateButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  payerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  payerAmount: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    width: 100,
    textAlign: 'right',
  },
});

export default GroupDetailsScreen; 