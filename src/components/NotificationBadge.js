import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import NotificationService from '../services/NotificationService';

const NotificationBadge = ({ style }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Load unread notification count
  const loadNotificationCount = useCallback(async () => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await NotificationService.getUnreadNotificationCount(user.uid);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notification count:', error);
      setUnreadCount(0);
    }
  }, [user?.uid]);

  // Listen to notification changes in real-time
  const setupNotificationListener = useCallback(() => {
    if (!user?.uid) return null;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    loadNotificationCount();
    const unsubscribe = setupNotificationListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadNotificationCount, setupNotificationListener]);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBadge; 