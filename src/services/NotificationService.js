import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, writeBatch, query, where, getDocs, onSnapshot, FieldValue, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '../config/firebase';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

class NotificationService {
  // Send notification to specific user
  static async sendNotificationToUser(userId, notification) {
    try {
      // Store notification in Firestore
      const docRef = await addDoc(collection(db, 'notifications'), {
        userId: userId,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        type: notification.type || 'general',
        read: false,
        createdAt: serverTimestamp(),
        ...notification
      });

      // Get user's push token from their profile
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().pushToken) {
        // Send push notification via Expo
        await this.sendExpoPushNotification(userDoc.data().pushToken, notification);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Send notification to multiple users
  static async sendNotificationToUsers(userIds, notification) {
    try {
      // Validate userIds array
      if (!userIds || userIds.length === 0) {
        return;
      }

      // Filter out any invalid user IDs
      const validUserIds = userIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
      
      if (validUserIds.length === 0) {
        return;
      }

      const batch = writeBatch(db);
      
      // Store notifications in Firestore
      validUserIds.forEach(userId => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: userId,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          type: notification.type || 'general',
          read: false,
          createdAt: serverTimestamp(),
          ...notification
        });
      });

      await batch.commit();

      // Get push tokens for all users - only if we have valid IDs
      if (validUserIds.length > 0) {
        try {
          const usersQuery = query(collection(db, 'users'), where('__name__', 'in', validUserIds));
          const usersSnapshot = await getDocs(usersQuery);

          const pushTokens = [];
          const existingUserIds = [];
          usersSnapshot.forEach(doc => {
            existingUserIds.push(doc.id);
            if (doc.data().pushToken) {
              pushTokens.push(doc.data().pushToken);
            }
          });

          // Send push notifications only to users who exist in the users collection
          if (pushTokens.length > 0) {
            await this.sendExpoPushNotificationToMultiple(pushTokens, notification);
          }
        } catch (queryError) {
          console.error('Error querying users for push tokens:', queryError);
          // Continue without push notifications if query fails
        }
      }
    } catch (error) {
      console.error('Error sending notifications to users:', error);
    }
  }

  // Send notification to group members
  static async sendNotificationToGroup(groupId, notification) {
    try {
      // Get group members
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDoc = await getDoc(groupDocRef);

      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const memberIds = groupData.members || [];
        
        // Exclude the current user (sender)
        const currentUserId = auth.currentUser?.uid;
        const filteredMemberIds = memberIds.filter(id => id !== currentUserId);

        if (filteredMemberIds.length > 0) {
          await this.sendNotificationToUsers(filteredMemberIds, notification);
        }
      }
    } catch (error) {
      console.error('Error sending notification to group:', error);
    }
  }

  static async sendPersonalExpenseNotification(userIds, notification) {
    try {
      if (!userIds || userIds.length === 0) {
        return;
      }
  
      const validUserIds = userIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
      if (validUserIds.length === 0) {
        return;
      }
  
      const batch = writeBatch(db);
      validUserIds.forEach(userId => {
        const notificationRef = doc(collection(db, 'notifications'));
        const notificationData = {
          userId: userId,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          type: notification.type || 'general',
          categoryIconKey: notification.categoryIconKey || 'Miscellaneous',
          read: false,
          createdAt: serverTimestamp(),
          ...notification
        };
        batch.set(notificationRef, notificationData);
      });
  
      await batch.commit();

      // Get push tokens for all users - only if we have valid IDs
      if (validUserIds.length > 0) {
        try {
          const usersQuery = query(collection(db, 'users'), where('__name__', 'in', validUserIds));
          const usersSnapshot = await getDocs(usersQuery);

          const pushTokens = [];
          const existingUserIds = [];
          usersSnapshot.forEach(doc => {
            existingUserIds.push(doc.id);
            if (doc.data().pushToken) {
              pushTokens.push(doc.data().pushToken);
            }
          });

          // Send push notifications only to users who exist in the users collection
          if (pushTokens.length > 0) {
            await this.sendExpoPushNotificationToMultiple(pushTokens, notification);
          }
        } catch (queryError) {
          console.error('Error querying users for push tokens:', queryError);
          // Continue without push notifications if query fails
        }
      }
  
    } catch (error) {
      console.error('Error sending personal expense notifications:', error);
    }
  }

  // Send Expo push notification
  static async sendExpoPushNotification(pushToken, notification) {
    try {
      const message = {
        to: pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send push notification');
      }
    } catch (error) {
      console.error('Error sending Expo push notification:', error);
    }
  }

  // Send Expo push notification to multiple tokens
  static async sendExpoPushNotificationToMultiple(pushTokens, notification) {
    try {
      const messages = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error('Failed to send push notifications');
      }
    } catch (error) {
      console.error('Error sending Expo push notifications:', error);
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId) {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead(userId) {
    try {
      const batch = writeBatch(db);
      
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);

      notificationsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readAt: serverTimestamp(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Get unread notification count
  static async getUnreadNotificationCount(userId) {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(notificationsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Save push token to user profile
  static async savePushToken(userId, pushToken) {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Check if user document exists
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // Document exists, update it
        await updateDoc(userRef, {
          pushToken: pushToken,
          lastTokenUpdate: serverTimestamp(),
        });
      } else {
        // Document doesn't exist, create it with merge option
        await setDoc(userRef, {
          pushToken: pushToken,
          lastTokenUpdate: serverTimestamp(),
        }, { merge: true });
      }
      
  
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }
}

export default NotificationService; 