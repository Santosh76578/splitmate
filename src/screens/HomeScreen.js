import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@rneui/themed';
import { useAuth } from '../context/AuthContext';
import RefreshableScrollView from '../components/RefreshableScrollView';
import NotificationBadge from '../components/NotificationBadge';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/NotificationService';
import { calculateNetBalance, calculateNetBalanceWithSettlements, calculateSettlements, simplifySettlements } from '../utils/settlementCalculator';

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

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [groupExpenses, setGroupExpenses] = useState({});
  const [groupBalances, setGroupBalances] = useState({});
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [settledGroups, setSettledGroups] = useState({});
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOwed, setTotalOwed] = useState(0);
  const [recentActivities, setRecentActivities] = useState([]);
  const [userHasPendingSettlement, setUserHasPendingSettlement] = useState({});
  const [settledGroupIds, setSettledGroupIds] = useState(new Set());
  const [userSettledGroups, setUserSettledGroups] = useState({});
  const [groupSettlements, setGroupSettlements] = useState({});
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [settlementsLoaded, setSettlementsLoaded] = useState(false);

  const isGuestUser = user?.isAnonymous;

  // Utility to transform expenses for calculateOwesBalances
  function transformExpensesForOwesBalances(expenses) {
    return expenses.map(exp => {
      const owedBy = {};
      if (Array.isArray(exp.splits)) {
        exp.splits.forEach(split => {
          owedBy[split.memberId] = parseFloat(split.amount || 0);
        });
      }
      return {
        paidBy: exp.paidById || exp.paidBy,
        amount: parseFloat(exp.amount || 0),
        owedBy,
      };
    });
  }

  function calculateOwesBalances(expenses, settlements) {
    const balances = {};
    for (const expense of expenses) {
      for (const [user, amount] of Object.entries(expense.owedBy)) {
        if (!balances[user]) balances[user] = 0;
        balances[user] -= amount;
      }
      if (!balances[expense.paidBy]) balances[expense.paidBy] = 0;
      balances[expense.paidBy] += expense.amount;
    }
    for (const settle of settlements) {
      const { from, to, amount } = settle;
      if (!balances[from]) balances[from] = 0;
      if (!balances[to]) balances[to] = 0;
      balances[from] += amount;
      balances[to] -= amount;
    }
    for (const user in balances) {
      balances[user] = Math.round(balances[user] * 100) / 100;
    }
    return balances;
  }

  // Replace updateTotalBalance with new logic
  const updateTotalBalance = useCallback(() => {
    if (!user || !user.uid) return;
    let totalNet = 0;
    let totalOwesYou = 0;
    let totalYouOwe = 0;
    // For each group, use the robust group-level calculation
    Object.keys(groupExpenses).forEach(groupId => {
      const expenses = groupExpenses[groupId] || [];
      const settlements = groupSettlements[groupId] || [];
      const netResult = calculateNetBalanceWithSettlements(expenses, settlements, user.uid);
      totalNet += netResult.net;
      totalOwesYou += netResult.owesYou;
      totalYouOwe += netResult.youOwe;
    });
    setTotalPaid(Math.max(totalOwesYou, 0));
    setTotalOwed(Math.max(totalYouOwe, 0));
    setTotalBalance(totalNet);
  }, [groupExpenses, groupSettlements, user]);

  // Utility: Reopen settled groups if new expenses are found
  const reopenSettledGroupsWithNewExpenses = (groupExpensesMap) => {
    setSettledGroupIds(prevSet => {
      const newSet = new Set(prevSet);
      const reopenedGroups = [];
      Object.entries(groupExpensesMap).forEach(([groupId, expenses]) => {
        if (expenses && expenses.length > 0 && newSet.has(groupId)) {
          newSet.delete(groupId);
          reopenedGroups.push(groupId);
        }
      });
      // Also update userSettledGroups for reopened groups
      if (reopenedGroups.length > 0) {
        setUserSettledGroups(prev => {
          const updated = { ...prev };
          reopenedGroups.forEach(id => {
            updated[id] = false;
          });
          return updated;
        });
      }
      return newSet;
    });
  };

  const loadData = useCallback(async () => {
    setExpensesLoaded(false);
    setSettlementsLoaded(false);
    if (!user || !user.uid) {
      setGroups([]);
      setPersonalExpenses([]);
      setGroupExpenses({});
      setGroupBalances({});
      setRecentActivities([]);
      setTotalBalance(0);
      setTotalPaid(0);
      setTotalOwed(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const isGuestUser = user.isAnonymous;

      if (isGuestUser) {
        // Clear any existing data first
        setGroups([]);
        setPersonalExpenses([]);
        setGroupExpenses({});
        setGroupBalances({});
        setRecentActivities([]);
        setTotalBalance(0);
        setTotalPaid(0);
        setTotalOwed(0);

        // Load guest groups
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        const normalizedGuestGroups = guestGroups.map(g => ({
          ...g,
          createdAt: g.createdAt ? new Date(g.createdAt) : new Date(),
          members: g.members || [],
          category: g.category || 'Miscellaneous',
          categoryIconKey: g.categoryIconKey || 'Miscellaneous',
        }));
        setGroups(normalizedGuestGroups);

        // Load guest expenses
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        let normalizedGuestExpenses;
        normalizedGuestExpenses = guestExpenses.map(exp => {
          let parsedDate = new Date(exp.date);
          if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
            parsedDate = new Date(); // fallback to now if invalid
          }
          return {
            ...exp,
            date: parsedDate,
            members: exp.members || [],
            paidBy: exp.paidBy || 'Guest',
            status: exp.status || 'unsettled',
          };
        });
        
        // Set personalExpenses for guest users - only include personal expenses
        const guestPersonalExpensesForState = normalizedGuestExpenses.filter(exp => exp.isPersonal === true);
        setPersonalExpenses(guestPersonalExpensesForState);
        
        // Also check Firestore for expenses in groups where guest user is a member
        try {
          const memberGroupsQuery = query(
            collection(db, 'groups'),
            where('memberIds', 'array-contains', user.uid)
          );
          const memberGroupsSnapshot = await getDocs(memberGroupsQuery);
          
          for (const groupDoc of memberGroupsSnapshot.docs) {
            const groupData = groupDoc.data();
            const groupId = groupDoc.id;
            
            // Check if this group is not already in guestGroups (to avoid duplicates)
            const isGroupInGuestGroups = normalizedGuestGroups.some(g => g.id === groupId);
            if (!isGroupInGuestGroups) {
              // Add this Firestore group to the groups list
              normalizedGuestGroups.push({
                id: groupId,
                name: groupData.name,
                description: groupData.description || '',
                category: groupData.category || 'Miscellaneous',
                categoryIconKey: groupData.categoryIconKey || 'Miscellaneous',
                members: groupData.members || [],
                createdBy: groupData.createdBy,
                createdAt: (() => {
                  try {
                    if (groupData.createdAt) {
                      if (typeof groupData.createdAt.toDate === 'function') {
                        return groupData.createdAt.toDate();
                      } else if (typeof groupData.createdAt === 'string') {
                        return new Date(groupData.createdAt);
                      } else if (typeof groupData.createdAt === 'number') {
                        return new Date(groupData.createdAt);
                      }
                    }
                  } catch (error) {
                    // Error parsing group createdAt
                  }
                  return new Date();
                })(),
                memberIds: groupData.memberIds || []
              });
            }
            
            // Load expenses for this group from Firestore
            const expensesQuery = query(
              collection(db, 'expenses'),
              where('groupId', '==', groupId)
            );
            const expensesSnapshot = await getDocs(expensesQuery);
            
            const firestoreExpenses = expensesSnapshot.docs.map(doc => {
              const data = doc.data();
              let parsedDate = new Date();
              try {
                if (data.date) {
                  if (typeof data.date.toDate === 'function') {
                    parsedDate = data.date.toDate();
                  } else if (typeof data.date === 'string') {
                    parsedDate = new Date(data.date);
                  } else if (typeof data.date === 'number') {
                    parsedDate = new Date(data.date);
                  }
                }
              } catch (error) {
                // Error parsing expense date
              }
              
              return {
                id: doc.id,
                ...data,
                date: parsedDate,
                members: data.members || [],
                paidBy: data.paidBy || 'Unknown',
                status: data.status || 'unsettled',
                groupId: groupId
              };
            });
            
            // Add Firestore expenses to the normalized expenses list
            normalizedGuestExpenses = [...normalizedGuestExpenses, ...firestoreExpenses];
          }
        } catch (error) {
          // Error loading Firestore expenses for guest user
        }
        
        // Keep personalExpenses as only personal expenses, don't overwrite with all expenses
        // setPersonalExpenses(normalizedGuestExpenses); // REMOVED - this was incorrect

        // Load guest settlements
        const guestSettlements = JSON.parse(await AsyncStorage.getItem('guestSettlements') || '[]');

        // Calculate balances for guest groups
        const newGroupBalances = {};
        const newGroupExpenses = {};
        const newGroupSettlements = {};
        const netBalances = [];

        // Process each group to get the correct settlements
        await Promise.all(normalizedGuestGroups.map(async (group) => {
          const groupExpensesArr = normalizedGuestExpenses.filter(exp => exp.groupId === group.id);
          newGroupExpenses[group.id] = groupExpensesArr;

          // Check if group contains any regular user (not a guest)
          const hasRegularUser = (group.members || []).some(m => !m.id?.startsWith('Guest'));
          let groupSettlementsArr = [];

          if (hasRegularUser) {
            // Fetch settlements from Firestore for this group
            const settlementsQuery = query(
              collection(db, 'settlements'),
              where('groupId', '==', group.id)
            );
            const settlementsSnapshot = await getDocs(settlementsQuery);
            groupSettlementsArr = settlementsSnapshot.docs.map(doc => doc.data());
          } else {
            // Use guestSettlements from AsyncStorage for guest-only groups
            groupSettlementsArr = guestSettlements.filter(s => s.groupId === group.id);
          }
          newGroupSettlements[group.id] = groupSettlementsArr;

          // Use the corrected calculateNetBalanceWithSettlements function
          const netResult = calculateNetBalanceWithSettlements(groupExpensesArr, groupSettlementsArr, user.uid);
          netBalances.push(netResult.net);
          newGroupBalances[group.id] = {
            total: groupExpensesArr.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
            userBalance: netResult.net,
            owesYou: netResult.owesYou,
            youOwe: netResult.youOwe
          };
        }));

        setGroupExpenses(newGroupExpenses);
        setGroupBalances(newGroupBalances);
        setGroupSettlements(newGroupSettlements);
        setExpensesLoaded(true);

        // Calculate total netted balances for all groups
        let totalOwesYou = 0;
        let totalYouOwe = 0;
        netBalances.forEach(net => {
          if (net > 0) totalOwesYou += net;
          if (net < 0) totalYouOwe += Math.abs(net);
        });
        // Clamp to zero
        totalOwesYou = Math.max(totalOwesYou, 0);
        totalYouOwe = Math.max(totalYouOwe, 0);
        // Debug log
        setTotalPaid(totalOwesYou);
        setTotalOwed(totalYouOwe);
        setTotalBalance(totalOwesYou - totalYouOwe);

        // Create activities from guest expenses - only personal expenses
        const guestPersonalExpenses = normalizedGuestExpenses.filter(exp => exp.isPersonal === true);
        const guestActivities = guestPersonalExpenses.map(expense => ({
          id: expense.id,
          message: `Added personal expense "${expense.description}" of $${typeof expense.amount === 'string' ? parseFloat(expense.amount).toFixed(2) : expense.amount.toFixed(2)}`,
          createdAt: expense.date,
          category: expense.category,
          type: 'personal_expense',
          isPersonal: true,
        }));
        setRecentActivities(guestActivities);

        // Show all groups regardless of settlement status
        setGroups(normalizedGuestGroups);

        // Reopen settled groups if new expenses are found (guests)
        reopenSettledGroupsWithNewExpenses(newGroupExpenses);
      } else {
        // Fetch both created and joined groups for logged-in users
        const createdGroupsQuery = query(
          collection(db, 'groups'),
          where('createdBy.id', '==', user.uid)
        );
        const memberGroupsQuery = query(
          collection(db, 'groups'),
          where('memberIds', 'array-contains', user.uid)
        );
        const [createdSnapshot, memberSnapshot] = await Promise.all([
          getDocs(createdGroupsQuery),
          getDocs(memberGroupsQuery)
        ]);
        const processGroupData = (doc) => {
          const data = doc.data();
          let createdAt = new Date();
          try {
            if (data.createdAt) {
              if (typeof data.createdAt.toDate === 'function') {
                createdAt = data.createdAt.toDate();
              } else if (typeof data.createdAt === 'string') {
                createdAt = new Date(data.createdAt);
              } else if (typeof data.createdAt === 'number') {
                createdAt = new Date(data.createdAt);
              }
            }
          } catch (error) {
            // Error parsing group date
          }
          return {
            id: doc.id,
            name: data.name,
            description: data.description || '',
            category: data.category || 'Miscellaneous',
            categoryIconKey: data.categoryIconKey || 'Miscellaneous',
            members: data.members || [],
            createdBy: data.createdBy,
            createdAt: createdAt
          };
        };
        const createdGroups = createdSnapshot.docs.map(processGroupData);
        const memberGroups = memberSnapshot.docs
          .filter(doc => !createdGroups.some(group => group.id === doc.id))
          .map(processGroupData);
        const allGroups = [...createdGroups, ...memberGroups].sort((a, b) => b.createdAt - a.createdAt);
        setGroups(allGroups);

        // Set up real-time listeners for expenses and settlements of each group
        const unsubscribes = [];
        const newGroupExpenses = {};
        const newGroupBalances = {};

        for (const group of allGroups) {
          // Listen to expenses
          const expensesQuery = query(
            collection(db, 'expenses'),
            where('groupId', '==', group.id)
          );

          // Listen to settlements
          const settlementsQuery = query(
            collection(db, 'settlements'),
            where('groupId', '==', group.id)
          );

          const unsubscribeExpenses = onSnapshot(expensesQuery, (expensesSnapshot) => {
            const expenses = expensesSnapshot.docs.map(doc => {
              const data = doc.data();
                let date = new Date();
              
              try {
                if (data.date) {
                  if (typeof data.date.toDate === 'function') {
                    date = data.date.toDate();
                  } else if (typeof data.date === 'string') {
                    date = new Date(data.date);
                  } else if (typeof data.date === 'number') {
                    date = new Date(data.date);
                  }
                }
              } catch (error) {
                // Error parsing expense date
              }

              return {
                id: doc.id,
                ...data,
                date: date
              };
            });

            newGroupExpenses[group.id] = expenses;

            // Calculate balances using the corrected calculateNetBalanceWithSettlements function
            let netResult = calculateNetBalanceWithSettlements(expenses, [], user.uid);

            newGroupBalances[group.id] = {
              total: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
              userBalance: netResult.net,
              owesYou: netResult.owesYou,
              youOwe: netResult.youOwe
            };

            setGroupExpenses({ ...newGroupExpenses });
            setGroupBalances({ ...newGroupBalances });
            setExpensesLoaded(true);

            // Reopen settled groups if new expenses are found (logged-in)
            reopenSettledGroupsWithNewExpenses(newGroupExpenses);
          });

          const unsubscribeSettlements = onSnapshot(settlementsQuery, (settlementsSnapshot) => {
            const settlements = settlementsSnapshot.docs.map(doc => {
              const data = doc.data();
                let date = new Date();
              
              try {
                if (data.date) {
                  if (typeof data.date.toDate === 'function') {
                    date = data.date.toDate();
                  } else if (typeof data.date === 'string') {
                    date = new Date(data.date);
                  } else if (typeof data.date === 'number') {
                    date = new Date(data.date);
                  }
                }
              } catch (error) {
                // Error parsing settlement date
              }

              return {
                id: doc.id,
                ...data,
                date: date
              };
            });

            // Check if the current user has any pending settlements
            if (user && user.uid) {
              const currentUserId = user.uid;
              // Only consider settlements where the user is involved
              const userSettlements = settlements.filter(
                s => s.from?.id === currentUserId || s.to?.id === currentUserId
              );
              
              // If there are no settlements, mark as not settled
              if (userSettlements.length === 0) {
                setUserHasPendingSettlement(prev => ({ ...prev, [group.id]: false }));
                setUserSettledGroups(prev => ({ ...prev, [group.id]: false }));
                setSettledGroupIds(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(group.id);
                  return newSet;
                });
              } else {
                // Check if any settlements are pending
                const hasPendingForUser = userSettlements.some(s => s.status === 'pending');
                setUserHasPendingSettlement(prev => ({ ...prev, [group.id]: hasPendingForUser }));
                
                // Check if all settlements are settled
                const allSettled = userSettlements.every(s => s.status === 'settled');
                setUserSettledGroups(prev => ({ ...prev, [group.id]: allSettled }));
                
                // Update settledGroupIds based on settlement status
                setSettledGroupIds(prev => {
                  const newSet = new Set(prev);
                  if (allSettled) {
                    newSet.add(group.id);
                  } else {
                    newSet.delete(group.id);
                  }
                  return newSet;
                });
              }
            }

            // Recalculate balances with settlements
            const expenses = newGroupExpenses[group.id] || [];
            const groupSettlementsData = newGroupSettlements[group.id] || [];
            
            
            
            // Update the groupSettlements state for this group
            newGroupSettlements[group.id] = settlements;
            setGroupSettlements({ ...newGroupSettlements });
            
            const netResult = calculateNetBalanceWithSettlements(expenses, groupSettlementsData, user.uid);
            
        
            
            newGroupBalances[group.id] = {
              total: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
              userBalance: netResult.net,
              owesYou: netResult.owesYou,
              youOwe: netResult.youOwe
            };
            
            setGroupBalances({ ...newGroupBalances });
            
            // Update total balance when settlements change
            const allBalances = Object.values(newGroupBalances);
            let totalOwesYou = 0;
            let totalYouOwe = 0;
            allBalances.forEach(balance => {
              if (balance.userBalance > 0) totalOwesYou += balance.userBalance;
              if (balance.userBalance < 0) totalYouOwe += Math.abs(balance.userBalance);
            });
            setTotalPaid(Math.max(totalOwesYou, 0));
            setTotalOwed(Math.max(totalYouOwe, 0));
            setTotalBalance(totalOwesYou - totalYouOwe);
            
        
          });

          unsubscribes.push(unsubscribeExpenses, unsubscribeSettlements);
        }

        // Load personal expenses with real-time listener
        const personalExpensesQuery = query(
          collection(db, 'personalExpenses'),
          where('userId', '==', user.uid)
        );

        const unsubscribePersonalExpenses = onSnapshot(personalExpensesQuery, (personalExpensesSnapshot) => {
          const loadedPersonalExpenses = personalExpensesSnapshot.docs
            .map(doc => {
              const data = doc.data();
                let date = new Date();
              
              try {
                if (data.date) {
                  if (typeof data.date.toDate === 'function') {
                    date = data.date.toDate();
                  } else if (typeof data.date === 'string') {
                    date = new Date(data.date);
                  } else if (typeof data.date === 'number') {
                    date = new Date(data.date);
                  }
                }
              } catch (error) {
                // Error parsing personal expense date
              }

              return {
                id: doc.id,
                ...data,
                date: date
              };
            })
            .sort((a, b) => b.date - a.date)
            .slice(0, 2);

          setPersonalExpenses(loadedPersonalExpenses);
        });

        unsubscribes.push(unsubscribePersonalExpenses);

        // Load settlements for all groups first
        const newGroupSettlements = {};
        for (const group of allGroups) {
          const settlementsQuery = query(
            collection(db, 'settlements'),
            where('groupId', '==', group.id)
          );
          const settlementsSnapshot = await getDocs(settlementsQuery);
          newGroupSettlements[group.id] = settlementsSnapshot.docs.map(doc => doc.data());
        }
        setGroupSettlements(newGroupSettlements);
        setSettlementsLoaded(true);

        // For regular users, after allGroups and settlements are loaded:
        const netBalances = [];
        allGroups.forEach(group => {
          const expenses = newGroupExpenses[group.id] || [];
          const groupSettlementsData = newGroupSettlements[group.id] || [];
          
          
          
          let netResult = calculateNetBalanceWithSettlements(expenses, groupSettlementsData, user.uid);
          
      
          
          netBalances.push(netResult.net);
          newGroupBalances[group.id] = {
            total: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0),
            userBalance: netResult.net,
            owesYou: netResult.owesYou,
            youOwe: netResult.youOwe
          };
        });
        setGroupBalances(newGroupBalances);

        // Calculate total netted balances for all groups
        let totalOwesYou = 0;
        let totalYouOwe = 0;
        netBalances.forEach(net => {
          if (net > 0) totalOwesYou += net;
          if (net < 0) totalYouOwe += Math.abs(net);
        });
        // Clamp to zero
        totalOwesYou = Math.max(totalOwesYou, 0);
        totalYouOwe = Math.max(totalYouOwe, 0);
        
    
        
        // Debug log
        setTotalPaid(totalOwesYou);
        setTotalOwed(totalYouOwe);
        setTotalBalance(totalOwesYou - totalYouOwe);

        return () => {
          unsubscribes.forEach(unsubscribe => unsubscribe());
        };
      }
    } catch (error) {
      // Error loading data
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const setup = async () => {
      await loadData();
    };
    setup();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      // Error refreshing data
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleSettleUp = async () => {
    if (!selectedGroup || !settleAmount) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const amount = parseFloat(settleAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }

      const currentUser = auth.currentUser;
      const balance = groupBalances[selectedGroup.id] || { total: 0, userBalance: 0 };
      const isOwed = balance.userBalance > 0;

      // Create settlement request document
      const settlementData = {
        groupId: selectedGroup.id,
        amount: amount,
        note: settleNote || '',
        from: {
          id: isOwed ? selectedGroup.members.find(m => m.id !== currentUser.uid)?.id : currentUser.uid,
          name: isOwed ? selectedGroup.members.find(m => m.id !== currentUser.uid)?.name : currentUser.displayName || 'User',
          email: isOwed ? selectedGroup.members.find(m => m.id !== currentUser.uid)?.email : currentUser.email
        },
        to: {
          id: isOwed ? currentUser.uid : selectedGroup.members.find(m => m.id !== currentUser.uid)?.id,
          name: isOwed ? currentUser.displayName || 'User' : selectedGroup.members.find(m => m.id !== currentUser.uid)?.name,
          email: isOwed ? currentUser.email : selectedGroup.members.find(m => m.id !== currentUser.uid)?.email
        },
        status: 'pending', // Always set as pending initially
        createdAt: serverTimestamp(),
        settledAt: null,
        settledBy: null,
        createdBy: {
          id: currentUser.uid,
          name: currentUser.displayName || 'User',
          email: currentUser.email
        },
        requestType: 'settlement_request' // Add this to identify settlement requests
      };

      await addDoc(collection(db, 'settlements'), settlementData);
      
      // Reset form and close modal
      setSettleAmount('');
      setSettleNote('');
      setShowSettleModal(false);
      setSelectedGroup(null);
      setIsPaid(false);
      
      Alert.alert('Success', 'Settlement request sent to group admin for approval');
    } catch (error) {
      // Error creating settlement
      Alert.alert('Error', 'Failed to create settlement request. Please try again.');
    }
  };

  const handleGroupSettle = async (group, balance, amount) => {
    try {
      const currentUser = auth.currentUser;
      const isAdmin = group.createdBy?.id === currentUser.uid;
      const userId = currentUser.uid;
      const groupId = group.id;
      const groupMembers = group.members || [];
      const isOwed = balance.userBalance > 0;

      // Recalculate the latest balance before creating a settlement
      const groupExpensesArr = groupExpenses[group.id] || [];
      const groupSettlementsArr = groupSettlements[group.id] || [];
      const transformedExpenses = transformExpensesForOwesBalances(groupExpensesArr);
      const balances = calculateOwesBalances(transformedExpenses, groupSettlementsArr);
      const correctAmount = Math.abs(balances[userId] || 0);
      if (correctAmount <= 0) {
        Alert.alert('Nothing to settle', 'There is no outstanding balance to settle.');
        return;
      }

      let fromMember, toMember;
      if (balance.userBalance < 0) {
        // Current user owes money
        fromMember = groupMembers.find(m => m.id === userId);
        toMember = groupMembers.find(m => m.id !== userId);
      } else {
        // Current user is owed money
        fromMember = groupMembers.find(m => m.id !== userId);
        toMember = groupMembers.find(m => m.id === userId);
      }

      // Check for an existing settlement (pending or settled) between these users, group, and amount
      const settlementsQuery = query(
        collection(db, 'settlements'),
        where('groupId', '==', groupId),
        where('from.id', '==', fromMember?.id || ''),
        where('to.id', '==', toMember?.id || ''),
        where('amount', '==', correctAmount)
      );
      const snapshot = await getDocs(settlementsQuery);
      if (!snapshot.empty) {
        let updated = false;
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.status === 'pending') {
            await updateDoc(doc(db, 'settlements', docSnap.id), {
              status: 'settled',
              settledAt: serverTimestamp(),
              settledBy: {
                id: userId,
                name: currentUser.displayName || 'User',
                email: currentUser.email
              }
            });
            updated = true;
          } else if (data.status === 'settled') {
            updated = true;
          }
        }
        if (updated) {
          setSettledGroupIds(prev => new Set([...prev, groupId]));
          setUserSettledGroups(prev => ({ ...prev, [groupId]: true }));
          setUserHasPendingSettlement(prev => ({ ...prev, [groupId]: false }));
          Alert.alert('Success', 'Payment marked as settled successfully');
          return;
        }
      }

      // No existing settlement, create a new one
      const newSettlement = {
        groupId,
        amount: correctAmount,
        note: '',
        from: {
          id: fromMember?.id || '',
          name: fromMember?.name || '',
          email: fromMember?.email || ''
        },
        to: {
          id: toMember?.id || '',
          name: toMember?.name || '',
          email: toMember?.email || ''
        },
        // Admin can settle directly, non-admin needs approval
        status: isAdmin ? 'settled' : 'pending',
        createdAt: serverTimestamp(),
        // Admin can mark as settled immediately
        settledAt: isAdmin ? serverTimestamp() : null,
        settledBy: isAdmin ? {
          id: userId,
          name: currentUser.displayName || 'User',
          email: currentUser.email
        } : null,
        createdBy: {
          id: userId,
          name: currentUser.displayName || 'User',
          email: currentUser.email
        },
        requestType: 'settlement_request'
      };
      
      await addDoc(collection(db, 'settlements'), newSettlement);
      
      // Update UI state based on admin status
      if (isAdmin) {
        // Admin can settle directly - update UI immediately
        setSettledGroupIds(prev => new Set([...prev, groupId]));
        setUserSettledGroups(prev => ({ ...prev, [groupId]: true }));
        setUserHasPendingSettlement(prev => ({ ...prev, [groupId]: false }));
        Alert.alert('Success', 'Payment settled successfully');
      } else {
        // Non-admin needs approval - show pending status
        setUserHasPendingSettlement(prev => ({ ...prev, [groupId]: true }));
        Alert.alert('Success', 'Settlement request sent to group admin for approval');
      }
    } catch (error) {
      // Error settling group
      Alert.alert('Error', 'Failed to settle payment. Please try again.');
    }
  };

  // After loading all group settlements, calculate net balance for the user
  useEffect(() => {
    if (!user || !user.uid) return;
    
    // Calculate total net balance from all group expenses
    let totalNetBalance = 0;
    
    // Sum up all group balances
    Object.values(groupBalances).forEach(balance => {
      totalNetBalance += balance.userBalance || 0;
    });
    
    // Add only unsettled personal expenses to the total
    personalExpenses.forEach(expense => {
      if (expense.status !== 'settled') { // Only count unsettled
        const amount = parseFloat(expense.amount) || 0;
        if (expense.paidById === user.uid) {
          // User paid for personal expense, they are owed the full amount
          totalNetBalance += amount;
        } else {
          // User didn\'t pay for personal expense, they owe the full amount
          totalNetBalance -= amount;
        }
      }
    });
    
    // Set the total balance (net balance)
    setTotalBalance(Math.max(totalNetBalance, 0));
    
    // Calculate owesYou and youOwe for display
    const owesYou = totalNetBalance > 0 ? totalNetBalance : 0;
    const youOwe = totalNetBalance < 0 ? Math.abs(totalNetBalance) : 0;
    
    setTotalOwed(Math.max(youOwe, 0));
    setTotalPaid(Math.max(owesYou, 0));
  }, [groupBalances, personalExpenses, user]);

  useEffect(() => {
    if (expensesLoaded && settlementsLoaded) {
      updateTotalBalance();
    }
  }, [expensesLoaded, settlementsLoaded, groupExpenses, groupSettlements, updateTotalBalance]);

  // Force recalculation and UI update when expenses or settlements change
  useEffect(() => {
    // This will trigger a re-render and ensure the latest data is used in renderActiveGroups
    // No-op, but ensures component updates
  }, [groupExpenses, groupSettlements]);

  const renderContent = () => {
    if (!user || !user.uid) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2D5586' }}>
          <ActivityIndicator size="large" color="#FFB800" />
          <Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>Please log in to continue</Text>
        </View>
      );
    }

    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFB800" />
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
        {renderBalanceCard()}
        {renderActiveGroups()}
        {renderRecentExpenses()}
        {renderRecentActivity()}
      </ScrollView>
    );
  };

  const renderBalanceCard = () => {
    return (
      <View style={[styles.balanceCard, { backgroundColor: '#18407A', borderRadius: 16, padding: 16 }]}> 
        {/* Top Row: badges and amounts */}
        <View style={styles.balanceRow}>
          {/* Left */}
          <View style={styles.column}>
            <View style={[styles.badge, { backgroundColor: '#7CF0B4', padding:5, borderRadius:5,}]}> 
              <Text style={[styles.badgeText, { color: '#18407A' }]}>Owes You</Text>
            </View>
          </View>
          {/* Center */}
          <View style={styles.centerColumn}>
            <Text style={[styles.bigAmount, { color: '#fff', fontWeight:'bold',fontSize:18 }]}>{`$${Math.max(totalPaid, 0).toFixed(2)}`}</Text>
          </View>
          {/* Right */}
          <View style={[styles.column, { alignItems: 'flex-end' }]}> 
            <Text style={[styles.bigAmount, { color: '#FF4B55',fontWeight:'bold' }]}>{`$${Math.max(totalOwed, 0).toFixed(2)}`}</Text>
            <Text style={[styles.balanceLabel, { color: '#FFF',fontWeight:'bold',marginTop:0 }]}>You Owe</Text>
          </View>
        </View>
        {/* Full-width separator */}
        <View style={{
          borderBottomWidth: 1,
          borderColor: '#ccc',
          borderStyle: 'dashed',
          marginVertical: 10,
          width: '100%',
          alignSelf: 'center'
        }} />
        {/* Bottom Row: labels and badges */}
        <View style={styles.balanceRow}>
          {/* Left */}
          <View style={styles.column}>
            <Text style={[styles.balanceLabel, { color: '#fff',fontWeight:'bold' }]}>Total</Text>
            <Text style={[styles.bigAmount, { color: '#25D366', marginTop: 0,fontWeight:'bold' }]}>${Math.max(totalPaid - totalOwed, 0).toFixed(2)}</Text>
          </View>
          {/* Center */}
          <View style={styles.centerColumn}>
            <Text style={[styles.balanceLabel, { color: '#fff' }]}>Total Balance</Text>
          </View>
          {/* Right */}
          <View style={[styles.column, { alignItems: 'flex-end' }]}> 
            <View style={[styles.badge, { backgroundColor: '#FFAFAF', marginTop: 8,padding:5, borderRadius:5, }]}> 
              <Text style={[styles.badgeText, { color: '#FA2B2B' }]}>You Owe</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderActiveGroups = () => {
    // Show all groups regardless of settlement status
    const activeGroups = groups;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Groups</Text>
        <View>
          {activeGroups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>
                <Ionicons name="people" size={18} color="#fff" /> No Groups
              </Text>
              <Text style={styles.emptyCardText}>
                You haven't joined or created any groups yet{`\n`}start one now and make splitting expenses effortless 🐝
              </Text>
              <TouchableOpacity
                style={styles.emptyCardButton}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <LinearGradient
                  colors={['#FFDF3D', '#FA8500']}
                  style={styles.emptyCardButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.emptyCardButtonText}>Create a group  +</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            activeGroups.map((group) => {
            const balance = groupBalances[group.id] || { total: 0, userBalance: 0 };
            const isOwed = balance.userBalance > 0;
            const isAdmin = group.createdBy?.id === user?.uid;
            const amount = Math.abs(balance.userBalance);
            const hasPending = userHasPendingSettlement[group.id];
            const hasAnySettlements = (groupExpenses[group.id] && groupExpenses[group.id].length > 0);
            const hasAnyPendingSettlements = Object.values(groupExpenses[group.id] || {}).some(expense => {
              const userSplit = expense.splits?.find(split => split.memberId === user?.uid);
              return userSplit && parseFloat(userSplit.amount) > 0;
            });

            // --- UPDATED LOGIC: Check if ALL settlements in the group are settled ---
            const userId = user?.uid;
            const settlements = groupSettlements[group.id] || [];
            const expenses = groupExpenses[group.id] || [];
            
            // Calculate total balances for each member based on ALL current expenses
            const memberBalances = {};
            group.members?.forEach(member => {
              memberBalances[member.id] = 0;
            });

            // Calculate net balance for each member from all expenses
            expenses.forEach(expense => {
              const amount = parseFloat(expense.amount || 0);
              if (isNaN(amount) || amount === 0) return;

              const paidByMember = group.members?.find(m => 
                m.name === expense.paidBy || 
                m.id === expense.paidBy ||
                m.id === expense.paidById
              );
              
              if (!paidByMember) return;

              // For each member, calculate their balance based on their split
              group.members?.forEach(member => {
                const memberSplit = expense.splits?.find(split => 
                  split.memberId === member.id || split.memberId === member.name
                );
                
                if (memberSplit) {
                  const memberSplitAmount = parseFloat(memberSplit.amount || 0);
                  
                  if (member.id === paidByMember.id) {
                    // Member paid for this expense - they are owed the amount others owe them
                    memberBalances[member.id] += (amount - memberSplitAmount);
                  } else {
                    // Member didn't pay for this expense - they owe their share
                    memberBalances[member.id] -= memberSplitAmount;
                  }
                }
              });
            });

            // Subtract settled amounts from the balances
            settlements.forEach(settlement => {
              if (settlement.status === 'settled') {
                const fromId = settlement.from?.id;
                const toId = settlement.to?.id;
                const amount = parseFloat(settlement.amount || 0);
                
                if (fromId && toId && memberBalances.hasOwnProperty(fromId) && memberBalances.hasOwnProperty(toId)) {
                  // The person who paid (from) has their debt reduced
                  memberBalances[fromId] += amount;
                  // The person who received (to) has their credit reduced
                  memberBalances[toId] -= amount;
                }
              }
            });

            // Check if there are any remaining unpaid amounts
            const hasUnpaidAmounts = Object.values(memberBalances).some(balance => Math.abs(balance) > 0.01);
            
            const isSettled = !hasUnpaidAmounts && expenses.length > 0;
            // --- END NEW LOGIC ---

            return (
              <TouchableOpacity 
                key={group.id}
                style={styles.groupCard}
                onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}
              >
                <View style={styles.groupHeader}>
                  <View style={styles.groupTitleContainer}>
                    <View style={styles.groupIconContainer}>
                      <LinearGradient
                        colors={['#8B6AD2', '#211E83']}
                        style={styles.groupIconGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Image 
                          source={categoryIcons[group.categoryIconKey] || categoryIcons.Miscellaneous}
                          style={styles.groupIcon}
                        />
                      </LinearGradient>
                    </View>
                    <Text style={styles.groupTitle}>{group.name}</Text>
                  </View>
                  <Text style={styles.groupDate}>
                    {group.createdAt?.toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.cardSeparator} />
                <View style={styles.groupDetails}>
                  <View>
                    <Text style={styles.balanceLabel}>Total balance</Text>
                    <Text style={styles.groupBalance}>${balance.total.toFixed(2)}</Text>
                    <Text style={styles.youOweText}>{isOwed ? 'Owes you' : 'You Owe'}</Text>
                    <Text style={[styles.owedAmount, isOwed ? styles.positiveAmount : styles.negativeAmount]}>
                      ${amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.rightContent}>
                    <Text style={styles.splitText}>Split b/w</Text>
                    <View style={styles.avatarGroup}>
                      {group.members.slice(0, 3).map((member, index) => (
                        <View
                          key={member.id ? member.id + '_' + index : index}
                          style={[
                            styles.memberInitialContainer,
                            index > 0 && { marginLeft: -8 }
                          ]}
                        >
                          <Text style={styles.memberInitial}>
                            {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </Text>
                        </View>
                      ))}
                      {group.members.length > 3 && (
                        <View style={[styles.memberInitialContainer, styles.moreMembers]}>
                          <Text style={styles.moreMembersText}>+{group.members.length - 3}</Text>
                        </View>
                      )}
                    </View>
                    {/* BADGE/SETTLE BUTTON LOGIC */}
                    {(groupExpenses[group.id] && groupExpenses[group.id].length === 0) ? (
                      <View style={[styles.settleButton, styles.settleButtonDisabled]}>
                        <LinearGradient
                          colors={['#666666', '#444444']}
                          style={styles.settleGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={[styles.settleButtonText, styles.settleButtonTextDisabled]}>
                            No expenses to settle
                          </Text>
                        </LinearGradient>
                      </View>
                    ) : isSettled ? (
                      <View style={styles.settleButton} pointerEvents="none">
                        <LinearGradient
                          colors={['#7CF0B4', '#4CAF50']}
                          style={styles.settleGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={[styles.settleButtonText, { color: '#fff' }]}>Settled</Text>
                        </LinearGradient>
                      </View>
                    ) : hasPending ? (
                      <View style={[styles.settleButton, styles.settleButtonDisabled]}>
                        <LinearGradient
                          colors={['#666666', '#444444']}
                          style={styles.settleGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={[styles.settleButtonText, styles.settleButtonTextDisabled]}>
                            Pending
                          </Text>
                        </LinearGradient>
                      </View>
                    ) : isAdmin ? (
                      // Admin can settle any outstanding balance
                      !isSettled && balance.total > 0 ? (
                        <TouchableOpacity 
                          style={styles.settleButton}
                          onPress={() => {
                            navigation.navigate('GroupDetails', { groupId: group.id, activeTab: 'settlements' });
                          }}
                        >
                          <LinearGradient
                            colors={['#FFD96D', '#FFA211']}
                            style={styles.settleGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <Text style={styles.settleButtonText}>Settle now</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : null
                    ) : (
                      <TouchableOpacity 
                        style={[styles.settleButton, balance.total === 0 && styles.settleButtonDisabled]}
                        onPress={() => {
                          if (balance.total > 0) {
                            navigation.navigate('GroupDetails', { groupId: group.id, activeTab: 'settlements' });
                          }
                        }}
                        disabled={balance.total === 0}
                      >
                        <LinearGradient
                          colors={balance.total === 0 ? ['#666666', '#444444'] : ['#FFD96D', '#FFA211']}
                          style={styles.settleGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.settleButtonText}>Settle now</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
            })
          )}
        </View>
      </View>
    );
  };

  const renderRecentExpenses = () => {
    // Only show personal expenses - add extra filtering to ensure no group expenses
    const filteredPersonalExpenses = personalExpenses.filter(exp => 
      exp.isPersonal === true && !exp.groupId
    );
    const allPersonalExpenses = filteredPersonalExpenses.map(exp => ({ ...exp, isPersonal: true }));
    // Sort by date descending
    const combinedExpenses = allPersonalExpenses
      .sort((a, b) => b.date - a.date)
      .slice(0, 5); // Show top 5 recent personal expenses

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Personal Expenses</Text>
        {combinedExpenses.map((expense) => (
          <TouchableOpacity 
            key={expense.id + '_personal'}
            style={styles.expenseCard}
            onPress={() => {
              navigation.navigate('ExpenseScreen', { expenseId: expense.id, isPersonal: true });
            }}
          >
            <View style={styles.expenseIconContainer}>
              <LinearGradient
                colors={['#8B6AD2', '#211E83']}
                style={styles.expenseIconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Image 
                  source={categoryIcons[expense.category] || categoryIcons.Miscellaneous}
                  style={styles.expenseIcon}
                />
              </LinearGradient>
            </View>
            <View style={styles.expenseDetails}>
              <Text style={styles.expenseTitle}>{expense.description || 'No description'}</Text>
              <Text style={styles.expenseDescription}>
                {expense.date?.toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                }) || 'No date'}
              </Text>
              <Text style={styles.expenseDescription}>Personal</Text>
            </View>
            <Text style={styles.expenseAmount}>
              ${typeof expense.amount === 'string' ? parseFloat(expense.amount).toFixed(2) : 
                typeof expense.amount === 'number' ? expense.amount.toFixed(2) : '0.00'}
            </Text>
          </TouchableOpacity>
        ))}
        {combinedExpenses.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>
              <Ionicons name="receipt" size={18} color="#fff" /> No Recent Personal Expenses
            </Text>
            <Text style={styles.emptyCardText}>
              It looks like you haven't added any personal expenses{`\n`}so far, start by recording your first one and keep track easily
            </Text>
            <TouchableOpacity
              style={styles.emptyCardButton}
              onPress={() => navigation.navigate('AddExpense')}
            >
              <LinearGradient
                colors={['#FFDF3D', '#FA8500']}
                style={styles.emptyCardButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.emptyCardButtonText}>Add Expense  +</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderRecentActivity = () => {
    // Only show recent group expenses as activities
    let allGroupExpenses = [];
    Object.entries(groupExpenses).forEach(([groupId, expenses]) => {
      if (Array.isArray(expenses)) {
        expenses.forEach(exp => {
          allGroupExpenses.push({
            ...exp,
            groupId,
            message: `Added group expense "${exp.description}" of $${typeof exp.amount === 'string' ? parseFloat(exp.amount).toFixed(2) : exp.amount.toFixed(2)}`
          });
        });
      }
    });

    // Sort by date descending and take top 3
    const groupActivities = allGroupExpenses
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {groupActivities.map((activity) => {
          let iconSource = categoryIcons[activity.category] || categoryIcons.Miscellaneous;
          return (
            <TouchableOpacity 
              key={activity.id}
              style={styles.activityCardCustom}
              onPress={() => {
                navigation.navigate('GroupDetails', { groupId: activity.groupId, expenseId: activity.id });
              }}
            >
              <View style={styles.activityIconContainerCustom}>
                <Image 
                  source={iconSource}
                  style={styles.activityIconCustom}
                />
              </View>
              <View style={styles.activityDetailsCustom}>
                <Text style={styles.activityTextCustom}>{activity.message}</Text>
              </View>
              <View style={styles.activityArrowButton}>
                <View style={styles.activityArrowButtonBg}>
                  <Ionicons name="chevron-forward" size={20} color="#222" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {groupActivities.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>
              <Ionicons name="alert-circle" size={18} color="#fff" /> No Recent Activity
            </Text>
            <Text style={styles.emptyCardText}>
              It looks like there's no recent group activity — start a new group or add an expense to get things moving!
            </Text>
            <TouchableOpacity
              style={styles.emptyCardButton}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <LinearGradient
                colors={['#FFDF3D', '#FA8500']}
                style={styles.emptyCardButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.emptyCardButtonText}>Create a group  +</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSettleModal = () => (
    <Modal
      visible={showSettleModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowSettleModal(false);
        setSelectedGroup(null);
        setSettleAmount('');
        setSettleNote('');
        setIsPaid(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settle Up</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowSettleModal(false);
                setSelectedGroup(null);
                setSettleAmount('');
                setSettleNote('');
                setIsPaid(false);
              }}
            >
              <Icon name="close" type="material" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalSubtitle}>
              {selectedGroup?.name}
            </Text>
            
            <View style={styles.paymentPromptContainer}>
              <Text style={styles.paymentPrompt}>
                Have you paid in the group or directly to the member you owe?
              </Text>
              <View style={styles.paymentButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.paymentButton, isPaid && styles.paymentButtonActive]}
                  onPress={() => setIsPaid(true)}
                >
                  <Text style={[styles.paymentButtonText, isPaid && styles.paymentButtonTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.paymentButton, !isPaid && styles.paymentButtonActive]}
                  onPress={() => setIsPaid(false)}
                >
                  <Text style={[styles.paymentButtonText, !isPaid && styles.paymentButtonTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Add a note"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={settleNote}
                onChangeText={setSettleNote}
              />
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSettleUp}
            >
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.submitButtonText}>
                  {isPaid ? 'Settled' : 'Settle Now'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
            <Text style={styles.headerTitle}>Home</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity 
                style={styles.notificationButton} 
                onPress={()=>navigation.navigate('Notifications')}
              >
                <Icon name="notifications" type="material" size={24} color="#FFFFFF" />
                <NotificationBadge />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconButton, user?.photoURL && styles.profileImageButton]} 
                onPress={()=>navigation.navigate('Profile')}
              >
                {user?.photoURL ? (
                  <Image 
                    source={{ uri: user.photoURL }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <Ionicons name="person-outline" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
          {renderContent()}
        </SafeAreaView>
      </LinearGradient>
      {renderSettleModal()}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
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
    flexGrow: 1,
    paddingBottom: 100, // Add padding for bottom navigation
  },
  balanceCard: {
    backgroundColor: '#13386B',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  balanceContent: {
    flexDirection: 'column',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  owesYouBadge: {
    backgroundColor: '#7CF0B4',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  youOweBadge: {
    backgroundColor: '#FFA8A8',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#0A2C4D',
    fontWeight: 'bold',
  },
  balanceLabel: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
  positiveAmount: {
    color: '#7CF0B4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  negativeAmount: {
    color: '#FF6961',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom:25,
  },
  totalLabel: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  separator: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    marginVertical: 10, // Optional: remove if no vertical lines needed
  },
  horizontalSeparator: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  section: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  groupCard: {
    backgroundColor: '#13386B',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
  },
  groupIconGradient: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIcon: {
    width: 20,
    height: 20
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  groupDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  groupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupBalance: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 5,
  },
  owedAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  splitText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 5,
  },
  avatarGroup: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  settleButton: {
    overflow: 'hidden',
    borderRadius: 5,
  },
  settleGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  youOweText: {
    color:'#fff',
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
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
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  expenseDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  expenseAmount: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  activityCardCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18407A',
    borderRadius: 15,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityIconContainerCustom: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#2D5586',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIconCustom: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  activityDetailsCustom: {
    flex: 1,
    justifyContent: 'center',
  },
  activityTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  activityArrowButton: {
    marginLeft: 10,
  },
  activityArrowButtonBg: {
    backgroundColor: '#FFD96D',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noActivitiesText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  memberInitialContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B537D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberInitial: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreMembers: {
    backgroundColor: '#2D5586',
  },
  moreMembersText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardSeparator: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    marginVertical: 10,
  },
  bottomSection: {
    minHeight: 20 // Add some space for bottom content
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2D5586',
  },
  noGroupsText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#13386B',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    gap: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
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
  submitButton: {
    marginTop: 20,
  },
  submitGradient: {
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentPromptContainer: {
    marginBottom: 20,
  },
  paymentPrompt: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  paymentButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  paymentButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  paymentButtonActive: {
    backgroundColor: '#FFD96D',
    borderColor: '#FFD96D',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  paymentButtonTextActive: {
    color: '#000',
  },
  noExpensesText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyCard: {
    backgroundColor: '#18407A',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2D5586',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyCardTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyCardText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyCardButton: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyCardButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  emptyCardButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settleButtonDisabled: {
    opacity: 0.7,
  },
  settleButtonTextDisabled: {
    color: '#999',
  },
  profileImageButton: {
    padding: 0,
    overflow: 'hidden',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

export default HomeScreen; 