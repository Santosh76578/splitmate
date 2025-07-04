import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import NotificationBadge from '../components/NotificationBadge';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationTriggers from '../utils/NotificationTriggers';

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
  Miscellaneous: require('../../assets/category/misscelenous.png')
};

const GroupsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const moreButtonRefs = useRef({});

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        setGroups([]);
        return;
      }

      const isGuestUser = currentUser.isAnonymous;
      
      if (isGuestUser) {
        // Guest user: load groups from AsyncStorage (groups they created)
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        
        // Check for deleted groups and remove them from AsyncStorage
        try {
          // Check by memberIds
          const deletedGroupsQuery = query(
            collection(db, 'deletedGroups'),
            where('memberIds', 'array-contains', currentUser.uid)
          );
          const deletedGroupsSnapshot = await getDocs(deletedGroupsQuery);
          const deletedGroupIds = deletedGroupsSnapshot.docs.map(doc => doc.data().groupId);
          // Fallback: Check by groupId for any group in guestGroups
          const groupIds = guestGroups.map(g => g.id);
          if (groupIds.length > 0) {
            const fallbackQuery = query(
              collection(db, 'deletedGroups'),
              where('groupId', 'in', groupIds.slice(0, 10)) // Firestore 'in' supports max 10
            );
            const fallbackSnapshot = await getDocs(fallbackQuery);
            fallbackSnapshot.docs.forEach(docSnap => {
              const groupId = docSnap.data().groupId;
              if (!deletedGroupIds.includes(groupId)) {
                deletedGroupIds.push(groupId);
              }
            });

          }
          if (deletedGroupIds.length > 0) {

            const updatedGuestGroups = guestGroups.filter(g => !deletedGroupIds.includes(g.id));
            if (updatedGuestGroups.length !== guestGroups.length) {
              await AsyncStorage.setItem('guestGroups', JSON.stringify(updatedGuestGroups));
              // Update the local variable for further processing
              guestGroups.splice(0, guestGroups.length, ...updatedGuestGroups);

            }
          }
        } catch (error) {
          // Error checking deleted groups
        }
        
        // Also check Firestore for groups where this guest user is a member
        const memberGroupsQuery = query(
          collection(db, 'groups'),
          where('memberIds', 'array-contains', currentUser.uid)
        );
        
        const memberSnapshot = await getDocs(memberGroupsQuery);
        const firestoreGroups = memberSnapshot.docs.map(doc => {
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
            inviteCode: data.inviteCode || null,
            createdAt: createdAt,
            memberIds: data.memberIds || []
          };
        });
        
        // Ensure all Firestore groups are in guestGroups
        let updatedGuestGroups = [...guestGroups];
        let added = false;
        firestoreGroups.forEach(fg => {
          if (!updatedGuestGroups.some(g => g.id === fg.id)) {
            updatedGuestGroups.push(fg);
            added = true;
          }
        });
        if (added) {
          await AsyncStorage.setItem('guestGroups', JSON.stringify(updatedGuestGroups));
        }
        
        // Combine both sources and remove duplicates
        const allGroups = [...updatedGuestGroups];
        const uniqueGroups = allGroups.filter((group, index, self) => 
          index === self.findIndex(g => g.id === group.id)
        );
        
        // Ensure all groups have a createdAt field
        const processedGroups = uniqueGroups.map(group => ({
          ...group,
          createdAt: group.createdAt ? new Date(group.createdAt) : new Date()
        }));
        
        // Sort groups by creation date (newest first)
        const sortedGroups = processedGroups.sort((a, b) => b.createdAt - a.createdAt);
        
        setGroups(sortedGroups);
        setLoading(false);
        return;
      }

      // For non-guest users, fetch both created and joined groups
      const createdGroupsQuery = query(
        collection(db, 'groups'),
        where('createdBy.id', '==', currentUser.uid)
      );

      const memberGroupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', currentUser.uid)
      );

      const [createdSnapshot, memberSnapshot] = await Promise.all([
        getDocs(createdGroupsQuery),
        getDocs(memberGroupsQuery)
      ]);

      const processGroupData = (doc) => {
        const data = doc.data();
        let createdAt = new Date(); // Default to current date
        
        try {
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              // Firestore Timestamp
              createdAt = data.createdAt.toDate();
            } else if (typeof data.createdAt === 'string') {
              // ISO string
              createdAt = new Date(data.createdAt);
            } else if (typeof data.createdAt === 'number') {
              // Timestamp
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
          inviteCode: data.inviteCode || null,
          createdAt: createdAt
        };
      };

      const createdGroups = createdSnapshot.docs.map(processGroupData);
      const memberGroups = memberSnapshot.docs
        .filter(doc => !createdGroups.some(group => group.id === doc.id)) // Filter out groups user created
        .map(processGroupData);

      // Combine and sort all groups by creation date (newest first)
      const allGroups = [...createdGroups, ...memberGroups].sort((a, b) => b.createdAt - a.createdAt);
      setGroups(allGroups);

    } catch (error) {
      Alert.alert('Error', 'Failed to load groups. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  // Real-time listeners for non-guest users to handle group deletions
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      return;
    }

    // Set up real-time listeners for both created and joined groups
    const createdGroupsQuery = query(
      collection(db, 'groups'),
      where('createdBy.id', '==', currentUser.uid)
    );

    const memberGroupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', currentUser.uid)
    );

    const unsubscribeCreated = onSnapshot(createdGroupsQuery, (createdSnapshot) => {
      const unsubscribeMember = onSnapshot(memberGroupsQuery, (memberSnapshot) => {
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
            inviteCode: data.inviteCode || null,
            createdAt: createdAt
          };
        };

        const createdGroups = createdSnapshot.docs.map(processGroupData);
        const memberGroups = memberSnapshot.docs
          .filter(doc => !createdGroups.some(group => group.id === doc.id))
          .map(processGroupData);

        // Combine and sort all groups by creation date (newest first)
        const allGroups = [...createdGroups, ...memberGroups].sort((a, b) => b.createdAt - a.createdAt);
        setGroups(allGroups);
      }, (error) => {
        console.error('Error listening to member groups:', error);
      });

      return unsubscribeMember;
    }, (error) => {
      console.error('Error listening to created groups:', error);
    });

    // Return cleanup function
    return () => {
      if (unsubscribeCreated) {
        unsubscribeCreated();
      }
    };
  }, [user]);

  useEffect(() => {
    // Load expenses for all groups
    const loadExpenses = async () => {
      const unsubscribes = [];
      const currentUser = auth.currentUser;
      const isGuestUser = currentUser?.isAnonymous;

      if (isGuestUser) {
        // For guest users, load expenses from AsyncStorage
        try {
          const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
          const groupExpensesMap = {};
          
          // Group expenses by groupId and ensure proper date handling
          guestExpenses.forEach(expense => {
            if (!groupExpensesMap[expense.groupId]) {
              groupExpensesMap[expense.groupId] = [];
            }
            groupExpensesMap[expense.groupId].push({
              ...expense,
              date: expense.date ? new Date(expense.date) : new Date(),
              createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date()
            });
          });
          
          // Also check Firestore for expenses in groups where guest user is a member
          try {
            const memberGroupsQuery = query(
              collection(db, 'groups'),
              where('memberIds', 'array-contains', currentUser.uid)
            );
            const memberGroupsSnapshot = await getDocs(memberGroupsQuery);
            
            for (const groupDoc of memberGroupsSnapshot.docs) {
              const groupData = groupDoc.data();
              const groupId = groupDoc.id;
              
              // Load expenses for this group from Firestore
              const expensesQuery = query(
                collection(db, 'expenses'),
                where('groupId', '==', groupId)
              );
              const expensesSnapshot = await getDocs(expensesQuery);
              
              const firestoreExpenses = expensesSnapshot.docs.map(doc => {
                const data = doc.data();
                let parsedDate = new Date();
                let createdAt = new Date();
                
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
                  console.error('Error parsing expense date:', error);
                }
                
                return {
                  id: doc.id,
                  ...data,
                  date: parsedDate,
                  createdAt: createdAt,
                  groupId: groupId
                };
              });
              
              // Add Firestore expenses to the group expenses map
              if (!groupExpensesMap[groupId]) {
                groupExpensesMap[groupId] = [];
              }
              groupExpensesMap[groupId] = [...groupExpensesMap[groupId], ...firestoreExpenses];
            }
          } catch (error) {
            console.error('Error loading Firestore expenses for guest user in GroupsScreen:', error);
          }
          
          setExpenses(groupExpensesMap);
        } catch (error) {
          console.error('Error loading guest expenses:', error);
        }
        return;
      }

      // For regular users, use Firestore listeners
      for (const group of groups) {
        const q = query(
          collection(db, 'expenses'),
          where('groupId', '==', group.id)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const groupExpenses = querySnapshot.docs.map(doc => {
            const data = doc.data();
            let date = new Date(); // Default to current date
            let createdAt = new Date(); // Default to current date
            
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
              console.error('Error parsing expense dates:', error);
            }

            return {
              id: doc.id,
              ...data,
              date: date,
              createdAt: createdAt
            };
          });
          
          setExpenses(prevExpenses => ({
            ...prevExpenses,
            [group.id]: groupExpenses
          }));
        }, (error) => {
          console.error(`Error loading expenses for group ${group.id}:`, error);
        });

        unsubscribes.push(unsubscribe);
      }

      return () => {
        unsubscribes.forEach(unsubscribe => unsubscribe());
      };
    };

    if (groups.length > 0) {
      loadExpenses();
    }
  }, [groups]);

  const calculateGroupBalance = (groupId) => {
    if (!groupId || !expenses[groupId]) {
      return 0;
    }
    
    const groupExpenses = expenses[groupId];
    let totalBalance = 0;

    groupExpenses.forEach(expense => {
      try {
        // Convert amount to number if it's a string
        const amount = typeof expense.amount === 'string' 
          ? parseFloat(expense.amount) 
          : expense.amount;
          
        if (!isNaN(amount)) {
          totalBalance += amount;
        }
      } catch (error) {
        console.error('Error calculating balance for expense:', expense, error);
      }
    });

    return totalBalance;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGroups();
      // Also refresh expenses for guest users
      if (user?.isAnonymous) {
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        const groupExpensesMap = {};
        guestExpenses.forEach(expense => {
          if (!groupExpensesMap[expense.groupId]) {
            groupExpensesMap[expense.groupId] = [];
          }
          groupExpensesMap[expense.groupId].push({
            ...expense,
            date: new Date(expense.date)
          });
        });
        
        // Also refresh Firestore expenses for guest users
        try {
          const currentUser = auth.currentUser;
          const memberGroupsQuery = query(
            collection(db, 'groups'),
            where('memberIds', 'array-contains', currentUser.uid)
          );
          const memberGroupsSnapshot = await getDocs(memberGroupsQuery);
          
          for (const groupDoc of memberGroupsSnapshot.docs) {
            const groupId = groupDoc.id;
            
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
                console.error('Error parsing expense date:', error);
              }
              
              return {
                id: doc.id,
                ...data,
                date: parsedDate,
                groupId: groupId
              };
            });
            
            // Add Firestore expenses to the group expenses map
            if (!groupExpensesMap[groupId]) {
              groupExpensesMap[groupId] = [];
            }
            groupExpensesMap[groupId] = [...groupExpensesMap[groupId], ...firestoreExpenses];
          }
        } catch (error) {
          console.error('Error refreshing Firestore expenses for guest user:', error);
        }
        
        setExpenses(groupExpensesMap);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh groups. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Trip':
        return require('../../assets/location.png');
      case 'Food':
        return require('../../assets/category/Food.png');
      case 'Party':
        return require('../../assets/location.png');
      default:
        return require('../../assets/location.png');
    }
  };

  // Function to check if current user is the group creator
  const isGroupCreator = (group) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    
    // Check if the current user is the creator of this group
    return group.createdBy && group.createdBy.id === currentUser.uid;
  };

  // Delete group logic
  const handleDeleteGroup = async (groupId) => {
    setSelectedGroup(groups.find(g => g.id === groupId));
    setDeleteModalVisible(true);
  };

  const confirmDeleteGroup = async () => {
    try {
      const currentUser = auth.currentUser;
      const groupToDelete = selectedGroup;
      
      if (currentUser?.isAnonymous) {
        // Guest user: delete from AsyncStorage
        const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
        const updatedGroups = guestGroups.filter(g => g.id !== groupToDelete.id);
        await AsyncStorage.setItem('guestGroups', JSON.stringify(updatedGroups));
        setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
        
        // Also remove related guest expenses and settlements
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        const updatedExpenses = guestExpenses.filter(e => e.groupId !== groupToDelete.id);
        await AsyncStorage.setItem('guestExpenses', JSON.stringify(updatedExpenses));

        const guestSettlements = JSON.parse(await AsyncStorage.getItem('guestSettlements') || '[]');
        const updatedSettlements = guestSettlements.filter(s => s.groupId !== groupToDelete.id);
        await AsyncStorage.setItem('guestSettlements', JSON.stringify(updatedSettlements));
        
        // Also delete from Firestore to prevent reappearing
        try {
          const groupRef = doc(db, 'groups', groupToDelete.id);
          await deleteDoc(groupRef);
          
          // Create a record of the deleted group for guest users to check
          await addDoc(collection(db, 'deletedGroups'), {
            groupId: groupToDelete.id,
            deletedBy: currentUser.uid,
            deletedAt: new Date().toISOString(),
            groupName: groupToDelete?.name || 'Unknown Group',
            memberIds: groupToDelete?.memberIds || []
          });
          
          // Delete associated expenses from Firestore
          const expensesQuery = query(
            collection(db, 'expenses'),
            where('groupId', '==', groupToDelete.id)
          );
          const expensesSnapshot = await getDocs(expensesQuery);
          for (const expenseDoc of expensesSnapshot.docs) {
            await deleteDoc(expenseDoc.ref);
          }
          
          // Delete associated settlements from Firestore
          const settlementsQuery = query(
            collection(db, 'settlements'),
            where('groupId', '==', groupToDelete.id)
          );
          const settlementsSnapshot = await getDocs(settlementsQuery);
          for (const settlementDoc of settlementsSnapshot.docs) {
            await deleteDoc(settlementDoc.ref);
          }
          
          // Remove group from all members' user documents (for regular users)
          if (groupToDelete && groupToDelete.memberIds && groupToDelete.memberIds.length > 0) {
            for (const memberId of groupToDelete.memberIds) {
              try {
                const userDocRef = doc(db, 'users', memberId);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  const updatedGroups = userData.groups ? userData.groups.filter(g => g.id !== groupToDelete.id) : [];
                  await updateDoc(userDocRef, {
                    groups: updatedGroups
                  });
                }
                                    } catch (memberError) {
                        // Error removing group from member, continue with other members
                      }
            }
          }
          
          // For guest-to-guest groups, we need to handle this differently
          // Since guest users don't have user documents in Firestore, we rely on notifications
          // and the fact that the group document is deleted from Firestore
          // Guest users will see the group disappear when they reload their groups
          // because the loadGroups function checks Firestore for groups they're members of
                        } catch (firestoreError) {
                  // Firestore deletion error (non-critical), don't fail the entire operation
                }
        
        // Send notification for group deletion (guest users)
        if (groupToDelete && groupToDelete.memberIds && groupToDelete.memberIds.length > 0) {
          await NotificationTriggers.onGroupDeleted(
            groupToDelete.name,
            groupToDelete.memberIds
          );
        }
      } else {
        // Regular user: delete from Firestore
        const groupRef = doc(db, 'groups', groupToDelete.id);
        
        // Get group data before deletion for notifications
        const groupDoc = await getDoc(groupRef);
        const groupData = groupDoc.exists() ? groupDoc.data() : null;
        
        // Delete associated expenses first
        const expensesQuery = query(
          collection(db, 'expenses'),
          where('groupId', '==', groupToDelete.id)
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        for (const expenseDoc of expensesSnapshot.docs) {
          await deleteDoc(expenseDoc.ref);
        }
        
        // Delete associated settlements
        const settlementsQuery = query(
          collection(db, 'settlements'),
          where('groupId', '==', groupToDelete.id)
        );
        const settlementsSnapshot = await getDocs(settlementsQuery);
        for (const settlementDoc of settlementsSnapshot.docs) {
          await deleteDoc(settlementDoc.ref);
        }
        
        // Delete the group document
        await deleteDoc(groupRef);
        
        // Add a record to deletedGroups so guest users remove it from AsyncStorage
        if (groupData && groupData.memberIds && groupData.memberIds.length > 0) {

          await addDoc(collection(db, 'deletedGroups'), {
            groupId: groupToDelete.id,
            deletedBy: currentUser.uid,
            deletedAt: new Date().toISOString(),
            groupName: groupData.name || 'Unknown Group',
            memberIds: groupData.memberIds
          });
        }
        
        // Update local state
        setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
        
        // Send notification to group members about group deletion
        if (groupData && groupData.memberIds && groupData.memberIds.length > 0) {
          await NotificationTriggers.onGroupDeleted(
            groupData.name,
            groupData.memberIds
          );
        }
      }
      
      setDeleteModalVisible(false);
      setSelectedGroup(null);
      Alert.alert('Success', 'Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete group. Please try again.');
    }
  };

  // Add navigation handler for group access
  const handleGroupNavigation = (groupId) => {
    if (user && !user.isAnonymous) {
      navigation.navigate('GroupDetails', { groupId });
    } else {
      Alert.alert(
        'Access Denied',
        'Please complete your account setup to access group features.',
        [{ text: 'OK' }]
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={[styles.container, { flex: 1 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2D5586" />
      <SafeAreaView style={[styles.container, { flex: 1 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
          <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Notifications')}>
            <Icon name="notifications" type="material" size={24} color="#FFFFFF" />
            <NotificationBadge />
          </TouchableOpacity>
        </View>

        {/* Only show filter bar if there are groups */}
        {groups.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContentContainer}
            >
              {['All', 'Trip', 'Food', 'Party', 'Others'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                >
                  <LinearGradient
                    colors={activeFilter === filter ? ['#FFB800', '#FFB800'] : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.filterButton,
                      activeFilter === filter && styles.activeFilterButton
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      activeFilter === filter && styles.activeFilterText
                    ]}>
                      {filter}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {(() => {
          const filteredGroups = groups.filter(group => activeFilter === 'All' || group.category === activeFilter);
          
          if (groups.length === 0) {
            return (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 0, marginBottom: 50 }}>
                <Image
                  source={require('../../assets/grps.png')}
                  style={{ width: 220, height: 220, marginBottom: 24 }}
                  resizeMode="contain"
                />
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                  🚫 No Groups Added Yet!
                </Text>
                <Text style={{ color: '#fff', fontSize: 15, opacity: 0.8, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 }}>
                  Start splitting expenses the smart way 💡 — create your first group now 👥 and make settling up easy 🐝!
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('CreateGroup')}
                  style={{ borderRadius: 10, marginTop: 10, elevation: 2 }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FFB800', '#FFD96D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 80,
                      shadowColor: '#FFB800',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4.65,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 18 }}>
                      Create a group  +
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          }
          
          if (filteredGroups.length === 0) {
            return (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 0, marginBottom: 50 }}>
                <Image
                  source={require('../../assets/grps.png')}
                  style={{ width: 180, height: 180, marginBottom: 20 }}
                  resizeMode="contain"
                />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                  🔍 No {activeFilter} Groups Found
                </Text>
                <Text style={{ color: '#fff', fontSize: 14, opacity: 0.8, textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 }}>
                  No groups match the "{activeFilter}" filter. Try selecting a different category or create a new {activeFilter.toLowerCase()} group!
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveFilter('All')}
                  style={{ borderRadius: 10, marginTop: 10, elevation: 2, marginRight: 10 }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#8B6AD2', '#6C63FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 30,
                      shadowColor: '#8B6AD2',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4.65,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                      Show All Groups
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          }
          
          return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
            style={{ flex: 1, marginTop: 0, paddingTop: 0 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFFFFF"
              />
            }
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Groups</Text>
              {groups
                .filter(group => activeFilter === 'All' || group.category === activeFilter)
                .map((group) => (
                  <View key={group.id} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={styles.groupCard}
                    onPress={() => {
                      const currentUser = auth.currentUser;
                      const isGuest = currentUser?.isAnonymous;
                      const params = { groupId: group.id };
                      if (isGuest) {
                        params.guestId = currentUser.uid;
                      }
                      navigation.navigate('GroupDetails', params);
                    }}
                      activeOpacity={0.85}
                    >
                      {/* More button */}
                      {isGroupCreator(group) && (
                        <TouchableOpacity
                          ref={ref => { moreButtonRefs.current[group.id] = ref; }}
                          style={styles.moreButton}
                          onPress={() => {
                            if (moreButtonRefs.current[group.id]) {
                              moreButtonRefs.current[group.id].measureInWindow((x, y, width, height) => {
                                setMenuPosition({ x: x - 120, y: y + height + 8 }); // adjusted for better dropdown effect
                                setSelectedGroup(group);
                                setMenuVisible(true);
                              });
                            } else {
                              setSelectedGroup(group);
                              setMenuVisible(true);
                            }
                          }}
                        >
                          <Icon name="more-vert" type="material" color="#fff" size={24} />
                        </TouchableOpacity>
                      )}
                    <View style={styles.groupIconContainer}>
                      <LinearGradient
                        colors={['#8B6AD2', '#211E83']}
                        style={styles.groupIconGradient}
                      >
                        <Image 
                          source={categoryIcons[group.categoryIconKey] || categoryIcons['Miscellaneous']}
                          style={styles.groupIcon}
                        />
                      </LinearGradient>
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      {group.description && (
                        <Text style={styles.groupDescription} numberOfLines={1}>
                          {group.description}
                        </Text>
                      )}
                      <View style={styles.avatarContainer}>
                        {group.members.slice(0, 3).map((member, index) => (
                          <View
                            key={`${group.id}-member-${index}`}
                            style={[
                              styles.avatar,
                              index > 0 && { marginLeft: -10 },
                              { backgroundColor: '#3B537D', justifyContent: 'center', alignItems: 'center' }
                            ]}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                              {member.name ? member.name[0].toUpperCase() : '?'}
                            </Text>
                          </View>
                        ))}
                        {group.members.length > 3 && (
                          <View key={`${group.id}-more-members`} style={[styles.avatar, styles.moreMembers]}>
                            <Text style={styles.moreMembersText}>+{group.members.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>Total Balance</Text>
                      <Text style={styles.balanceAmount}>
                        ${calculateGroupBalance(group.id).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  </View>
                ))}
            </View>
          </ScrollView>
        );
        })()}
      </SafeAreaView>
      {/* Modal for Edit/Delete menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { position: 'absolute', top: menuPosition.y, left: menuPosition.x }]}>
            {selectedGroup && isGroupCreator(selectedGroup) ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    if (selectedGroup) {
                      navigation.navigate('EditGroupScreen', { groupId: selectedGroup.id });
                    }
                  }}
                >
                  <Icon name="edit" type="material" color="#fff" size={20} />
                  <Text style={styles.menuText}>Edit Group</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    if (selectedGroup) {
                      handleDeleteGroup(selectedGroup.id);
                    }
                  }}
                >
                  <Icon name="delete" type="material" color="#FF4D4F" size={20} />
                  <Text style={[styles.menuText, { color: '#FF4D4F' }]}>Delete Group</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.disabledMenuItem}>
                <Text style={styles.disabledMenuText}>Only group creator can edit/delete</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Delete Group Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContainer}>
            <Text style={styles.deleteModalTitle}>Delete Group</Text>
            <Text style={styles.deleteModalMessage}>
              Warning: Deleting "{selectedGroup?.name}" will permanently remove all group data, expenses, and settlements. This action cannot be undone.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setSelectedGroup(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={confirmDeleteGroup}
              >
                <Text style={styles.deleteConfirmButtonText}>Delete Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2D5586',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    marginTop: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: '#171E45',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  notificationButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 0,
  },
  filterContainer: {
    paddingHorizontal: 10,
    marginTop: 5,
    marginBottom: 5,
    height: 50,
  },
  filterContentContainer: {
    paddingRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    height: 36,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#FFB800',
    shadowColor: '#FFB800',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 0,
  },
  filterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  activeFilterText: {
    color: '#000000',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 0,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13386B',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  groupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 15,
  },
  groupIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  balanceContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#ededed',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B4EFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  groupIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain'
  },
  moreMembers: {
    backgroundColor: '#8B6AD2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMembersText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  groupDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  noGroupsText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 40,
    opacity: 0.7,
  },
  moreButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    padding: 6,
    // borderRadius: 16,
    // backgroundColor: 'rgba(255,255,255,0.08)',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.01)', // make overlay almost transparent
  },
  menuContainer: {
    backgroundColor: '#23305A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 180,
    elevation: 8,
    alignItems: 'flex-start',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    width: '100%',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  disabledMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
    opacity: 0.6,
  },
  disabledMenuText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContainer: {
    backgroundColor: '#13386B',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  deleteModalButtons: {
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
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default GroupsScreen;