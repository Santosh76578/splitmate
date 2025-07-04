import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const scrollViewRef = useRef();

  // Get groupId from navigation params
  const groupId = route?.params?.groupId;

  // Fetch group data and members with real-time updates
  useEffect(() => {
    if (!groupId) return;

    const currentUser = auth.currentUser;
    const isGuest = currentUser?.isAnonymous;

    if (isGuest) {
      // Guest user: check AsyncStorage first, then Firestore
      const fetchGuestGroupData = async () => {
        try {
          const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
          const group = guestGroups.find(g => g.id === groupId);
          
          if (group) {
            setGroupData(group);
            setGroupMembers(group.members || []);
          } else {
            // Check Firestore for groups where guest user is a member
            const groupDocRef = doc(db, 'groups', groupId);
            const groupDocSnap = await getDoc(groupDocRef);
            if (groupDocSnap.exists()) {
              const data = groupDocSnap.data();
              const isMember = data.memberIds && data.memberIds.includes(currentUser.uid);
              if (isMember) {
                setGroupData({ ...data, id: groupDocSnap.id });
                setGroupMembers(data.members || []);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching guest group data:', error);
        }
      };

      fetchGuestGroupData();
    } else {
      // Regular user: set up real-time listener for group data
      const groupDocRef = doc(db, 'groups', groupId);
      const unsubscribe = onSnapshot(groupDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGroupData({ ...data, id: docSnap.id });
          setGroupMembers(data.members || []);
        }
      }, (error) => {
        console.error('Error listening to group data:', error);
      });

      return () => unsubscribe();
    }
  }, [groupId]);

  // Refresh group data when screen comes into focus (especially for guest users)
  useFocusEffect(
    React.useCallback(() => {
      const currentUser = auth.currentUser;
      const isGuest = currentUser?.isAnonymous;

      if (isGuest && groupId) {
        // For guest users, refresh group data from AsyncStorage and Firestore
        const refreshGuestGroupData = async () => {
          try {
            const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
            const group = guestGroups.find(g => g.id === groupId);
            
            if (group) {
              setGroupData(group);
              setGroupMembers(group.members || []);
            } else {
              // Check Firestore for groups where guest user is a member
              const groupDocRef = doc(db, 'groups', groupId);
              const groupDocSnap = await getDoc(groupDocRef);
              if (groupDocSnap.exists()) {
                const data = groupDocSnap.data();
                const isMember = data.memberIds && data.memberIds.includes(currentUser.uid);
                if (isMember) {
                  setGroupData({ ...data, id: groupDocSnap.id });
                  setGroupMembers(data.members || []);
                }
              }
            }
          } catch (error) {
            console.error('Error refreshing guest group data:', error);
          }
        };

        refreshGuestGroupData();
      }
    }, [groupId])
  );

  // Listen for messages in Firestore
  useEffect(() => {
    if (!groupId) return;
    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [groupId]);

  // Send a message
  const sendMessage = async () => {
    if (!message.trim() || !user || !groupId) return;
    await addDoc(collection(db, 'groups', groupId, 'messages'), {
      senderId: user.uid,
      sender: user.displayName || 'You',
      message: message.trim(),
      timestamp: serverTimestamp(),
      avatar: user.photoURL || null,
    });
    setMessage('');
    // Scroll to bottom after sending
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const grouped = {};
    
    messages.forEach(msg => {
      if (!msg.timestamp) return;
      
      const date = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
      const dateKey = date.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(msg);
    });
    
    return grouped;
  };

  // Format date header
  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  // Render a single message
  const renderMessage = (msg) => {
    const isSent = msg.senderId === user?.uid;
    const avatarSource = msg.avatar
      ? { uri: msg.avatar }
      : require('../../assets/member-3.png'); // fallback avatar
    if (isSent) {
      return (
        <View key={msg.id} style={styles.sentMessageContainer}>
          <View style={styles.sentMessageContent}>
            <Text style={styles.senderName}>{msg.sender || 'You'}</Text>
            <Text style={styles.messageText}>{msg.message}</Text>
            <Text style={styles.messageTime}>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
          </View>
          <Image source={avatarSource} style={styles.senderAvatar} />
        </View>
      );
    }
    return (
      <View key={msg.id} style={styles.receivedMessageContainer}>
        <Image source={avatarSource} style={styles.receiverAvatar} />
        <View style={styles.receivedMessageContent}>
          <Text style={styles.senderName}>{msg.sender}</Text>
          <Text style={styles.messageText}>{msg.message}</Text>
          <Text style={styles.messageTime}>{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
        </View>
      </View>
    );
  };

  // Render messages grouped by date
  const renderMessagesByDate = () => {
    const groupedMessages = groupMessagesByDate();
    const sortedDates = Object.keys(groupedMessages).sort((a, b) => new Date(a) - new Date(b));
    
    return sortedDates.map(dateKey => (
      <View key={dateKey}>
        <Text style={styles.dateHeader}>{formatDateHeader(dateKey)}</Text>
        {groupedMessages[dateKey].map(msg => renderMessage(msg))}
      </View>
    ));
  };

  // Enhanced member data with latest profile pictures
  const [enhancedMembers, setEnhancedMembers] = useState([]);

  // Fetch latest member data including profile pictures
  useEffect(() => {
    const fetchEnhancedMembers = async () => {
      if (!groupMembers || groupMembers.length === 0) {
        setEnhancedMembers([]);
        return;
      }

      try {
        const enhanced = await Promise.all(
          groupMembers.map(async (member) => {
            // Try to get latest user data from Firestore
            try {
              const userDocRef = doc(db, 'users', member.id);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                  ...member,
                  name: userData.displayName || userData.name || member.name || 'Unknown User',
                  avatar: userData.photoURL || userData.avatar || member.avatar || null,
                };
              }
            } catch (error) {
              // If Firestore fetch fails, use member data as fallback
              console.log('Error fetching user data for member:', member.id, error);
            }
            
            return {
              ...member,
              name: member.name || 'Unknown User',
              avatar: member.avatar || null,
            };
          })
        );
        
        setEnhancedMembers(enhanced);
      } catch (error) {
        console.error('Error fetching enhanced members:', error);
        setEnhancedMembers(groupMembers);
      }
    };

    fetchEnhancedMembers();
  }, [groupMembers]);

  // Render group members in header
  const renderGroupMembers = () => {
    if (!enhancedMembers || enhancedMembers.length === 0) return null;

    return (
      <View style={styles.membersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
          {enhancedMembers.map((member, index) => (
            <View key={member.id} style={styles.memberItem}>
              {member.avatar ? (
                <Image 
                  source={{ uri: member.avatar }} 
                  style={styles.memberAvatar} 
                />
              ) : (
                <View style={styles.memberInitialAvatar}>
                  <Text style={styles.memberInitialText}>
                    {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.memberName} numberOfLines={1}>
                {member.name || 'Unknown User'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#13386B', '#0B2442']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {groupData?.name || 'Group Chat'}
            </Text>
            {renderGroupMembers()}
          </View>
        </View>
        {/* Chat Messages */}
        <ScrollView
          style={styles.chatContainer}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                // Refresh group data and member information
                const currentUser = auth.currentUser;
                const isGuest = currentUser?.isAnonymous;
                
                if (isGuest && groupId) {
                  const refreshGuestGroupData = async () => {
                    try {
                      const guestGroups = JSON.parse(await AsyncStorage.getItem('guestGroups') || '[]');
                      const group = guestGroups.find(g => g.id === groupId);
                      
                      if (group) {
                        setGroupData(group);
                        setGroupMembers(group.members || []);
                      } else {
                        const groupDocRef = doc(db, 'groups', groupId);
                        const groupDocSnap = await getDoc(groupDocRef);
                        if (groupDocSnap.exists()) {
                          const data = groupDocSnap.data();
                          const isMember = data.memberIds && data.memberIds.includes(currentUser.uid);
                          if (isMember) {
                            setGroupData({ ...data, id: groupDocSnap.id });
                            setGroupMembers(data.members || []);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Error refreshing guest group data:', error);
                    }
                  };
                  refreshGuestGroupData();
                }
              }}
              tintColor="#fff"
              colors={['#fff']}
            />
          }
        >
          {renderMessagesByDate()}
        </ScrollView>
        {/* Message Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <LinearGradient
                colors={['#FFD96D', '#FFA211']}
                style={styles.sendButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="send" size={20} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#2D5586',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  membersContainer: {
    marginTop: 4,
  },
  membersScroll: {
    flexGrow: 0,
  },
  memberItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 50,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  memberInitialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  memberInitialText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: 50,
  },
  remainingMembersCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  remainingMembersText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateHeader: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginVertical: 20,
  },
  receivedMessageContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  sentMessageContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  receivedMessageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    maxWidth: '70%',
    marginLeft: 8,
  },
  sentMessageContent: {
    backgroundColor: '#2D5586',
    padding: 12,
    borderRadius: 12,
    maxWidth: '70%',
    marginRight: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
  },
  receiverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#fff',
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GroupChatScreen; 