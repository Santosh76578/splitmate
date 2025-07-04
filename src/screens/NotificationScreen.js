import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Text, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '../config/firebase';
import NotificationService from '../services/NotificationService';
import { validateGroupAccess } from '../utils/groupValidation';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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

const NotificationItem = ({ notification, onPress }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    let notificationTime;
    if (typeof timestamp.toDate === 'function') {
      notificationTime = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      notificationTime = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      notificationTime = new Date(timestamp);
    } else {
      return '';
    }
    const now = new Date();
    const diffInHours = (now - notificationTime) / (1000 * 60 * 60);
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getNotificationIcon = (type, categoryIconKey) => {
    // For group-related notifications, use the category icon
    if (type === 'group_created' || type === 'group_updated') {
      return categoryIcons[categoryIconKey] || categoryIcons['Miscellaneous'];
    }
    
    // For expense-related notifications, use expense icon
    if (type === 'expense_added' || type === 'expense_updated' || type === 'personal_expense_added') {
      return categoryIcons[categoryIconKey] || categoryIcons['Miscellaneous'];
    }
    
    // For member-related notifications, use member icon
    if (type === 'member_added' || type === 'member_removed') {
      return require('../../assets/member-1.png');
    }
    
    // For payment-related notifications, use avatar icon
    if (type === 'payment_settled' || type === 'payment_requested') {
      return require('../../assets/avatar.png');
    }
    
    // Default fallback
    return categoryIcons['Miscellaneous'];
  };

  return (
    <TouchableOpacity 
      style={[styles.notificationItem, !notification.read && styles.unreadNotification]} 
      onPress={() => onPress(notification)}
    >
      <View style={styles.notificationIconContainer}>
        <LinearGradient
          colors={['#8B6AD2', '#211E83']}
          style={styles.notificationIconGradient}
        >
          <Image 
            source={getNotificationIcon(notification.type, notification.categoryIconKey)}
            style={styles.notificationIcon}
          />
        </LinearGradient>
      </View>
    <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !notification.read && styles.unreadText]}>
          {notification.title}
        </Text>
        {notification.body && (
          <Text style={styles.notificationSubtitle}>{notification.body}</Text>
      )}
    </View>
      <View style={styles.notificationRight}>
        <Text style={styles.notificationTime}>
          {formatTime(notification.createdAt)}
        </Text>
        {!notification.read && <View style={styles.unreadDot} />}
  </View>
    </TouchableOpacity>
);
};

const NotificationScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      const unsubscribe = listenToNotifications();
      return () => unsubscribe && unsubscribe();
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      
      const notificationList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setNotifications(notificationList);
      setUnreadCount(notificationList.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const listenToNotifications = () => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, snapshot => {
      const notificationList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notificationList);
      setUnreadCount(notificationList.filter(n => !n.read).length);
    }, error => {
      console.error('Error listening to notifications:', error);
    });
    return unsubscribe;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.data && notification.data.screen) {
      try {
        // Special handling for GroupDetails navigation
        if (notification.data.screen === 'GroupDetails' && notification.data.params?.groupId) {
          const currentUser = getAuth(firebaseApp).currentUser;
          const validation = await validateGroupAccess(
            notification.data.params.groupId,
            currentUser?.uid,
            currentUser?.isAnonymous
          );
          
          if (validation.exists && validation.accessible) {
            navigation.navigate(notification.data.screen, notification.data.params);
          } else {
            Alert.alert(
              'Group Not Found',
              'This group has been deleted or you no longer have access to it.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    // Navigate to Groups screen instead
                    navigation.navigate('MainTabs', {
                      screen: 'GroupsTab'
                    });
                  }
                }
              ]
            );
          }
        } else {
          // For other screens, navigate normally
          navigation.navigate(notification.data.screen, notification.data.params);
        }
      } catch (navigationError) {
        console.error('Navigation error:', navigationError);
        Alert.alert('Error', 'Unable to navigate to the requested screen.');
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      // Batch update all unread notifications for the user
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs.map(docSnap =>
        updateDoc(doc(db, 'notifications', docSnap.id), {
          read: true,
          readAt: new Date()
        })
      );
      await Promise.all(batchPromises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const groupNotificationsByDate = () => {
  
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayNotifications = [];
    const yesterdayNotifications = [];
    const olderNotifications = [];

    notifications.forEach(notification => {
      if (!notification.createdAt) {
        return;
      }
      
      let notificationDate;
      if (typeof notification.createdAt.toDate === 'function') {
        notificationDate = notification.createdAt.toDate();

      } else if (notification.createdAt instanceof Date) {
        notificationDate = notification.createdAt;
      } else if (typeof notification.createdAt === 'string' || typeof notification.createdAt === 'number') {
        notificationDate = new Date(notification.createdAt);
      } else {
        return;
      }
      
      const isToday = notificationDate.toDateString() === today.toDateString();
      const isYesterday = notificationDate.toDateString() === yesterday.toDateString();
      
      if (isToday) {
        todayNotifications.push(notification);
      } else if (isYesterday) {
        yesterdayNotifications.push(notification);
      } else {
        olderNotifications.push(notification);
      }
    });
    

    
    return { todayNotifications, yesterdayNotifications, olderNotifications };
  };

  const { todayNotifications, yesterdayNotifications, olderNotifications } = groupNotificationsByDate();

  if (loading) {
    return (
      <LinearGradient
        colors={['#2D5586', '#171E45']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" color="#FFF" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD96D" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllReadButton}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD96D"
            colors={["#FFD96D"]}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../assets/empty-notification.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>🔕 No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>
               Nothing to see here... yet 👀{"\n"}
               Once you start creating groups or adding expenses, updates will show up here 📩
            </Text>
          </View>
        ) : (
          <>
        {/* Today's Notifications */}
            {todayNotifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
                {todayNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
            />
          ))}
        </View>
            )}

        {/* Yesterday's Notifications */}
            {yesterdayNotifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yesterday</Text>
                {yesterdayNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
                  />
                ))}
              </View>
            )}

            {/* Older Notifications */}
            {olderNotifications.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Older</Text>
                {olderNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
            />
          ))}
        </View>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  markAllReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  markAllReadText: {
    color: '#FFD96D',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 1,
  },
  unreadNotification: {
    backgroundColor: 'rgba(255, 217, 109, 0.1)',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 15,
  },
  notificationIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain'
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    color: '#FFF',
    marginBottom: 2,
  },
  unreadText: {
    fontWeight: '600',
  },
  notificationSubtitle: {
    fontSize: 14,
    color: '#8F9BB3',
  },
  notificationRight: {
    alignItems: 'flex-end',
  },
  notificationTime: {
    fontSize: 14,
    color: '#8F9BB3',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD96D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyImage: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8F9BB3',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default NotificationScreen; 