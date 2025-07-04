import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AddFriendModal = ({ visible, onClose, onAddFriend, onRemoveContact, selectedContacts = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = selectedContacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveContact = (contactId) => {
    onRemoveContact(contactId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#2D5586', '#171E45']}
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Selected Members</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color="rgba(255, 255, 255, 0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search selected members..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.contactsList}>
            {filteredContacts.map(contact => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{contact.name?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.phoneNumbers?.[0] && (
                      <Text style={styles.contactPhone}>{contact.phoneNumbers[0].number}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleRemoveContact(contact.id)}>
                  <Icon name="close" size={24} color="#FF5C3B" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={onClose}>
            <LinearGradient
              colors={['#FFD96D', '#FFA211']}
              style={styles.addButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.addButtonText}>
                Done ({selectedContacts.length})
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 20,
    borderRadius: 10,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 16,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B537D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 2,
  },
  addButton: {
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddFriendModal; 