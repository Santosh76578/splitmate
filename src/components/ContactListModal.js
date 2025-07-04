import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';

const ContactListModal = ({ visible, onClose, onSelectContact }) => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState([]);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter(contact => 
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Image,
          ],
        });
        
        // Log the first contact to verify data structure
        if (data.length > 0) {
          console.log('\n=== Sample Contact Data ===');
          console.log('Contact ID:', data[0].id);
          console.log('Contact Name:', data[0].name);
          console.log('Phone Numbers:', JSON.stringify(data[0].phoneNumbers, null, 2));
          console.log('Emails:', JSON.stringify(data[0].emails, null, 2));
          console.log('========================\n');
        }
        
        setContacts(data);
        setFilteredContacts(data);
      } else {
        Alert.alert('Permission Required', 'Please grant access to contacts to add friends.');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact) => {
    console.log('\n=== Contact Selected ===');
    console.log('Contact ID:', contact.id);
    console.log('Contact Name:', contact.name);
    console.log('Phone Numbers:', JSON.stringify(contact.phoneNumbers, null, 2));
    console.log('========================\n');

    const isSelected = selectedContacts.some(c => c.id === contact.id);
    
    if (isSelected) {
      setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts(prev => [...prev, contact]);
    }
  };

  const handleDone = () => {
    console.log('\n=== Selected Contacts Before Processing ===');
    selectedContacts.forEach(contact => {
      console.log('Contact:', {
        id: contact.id,
        name: contact.name,
        phoneNumbers: JSON.stringify(contact.phoneNumbers, null, 2),
        emails: JSON.stringify(contact.emails, null, 2)
      });
    });
    console.log('========================\n');

    // Filter out any contacts without a name and prepare contact data
    const validContacts = selectedContacts
      .filter(contact => contact.name)
      .map(contact => {
        // Get the first phone number if available
        const phoneNumber = contact.phoneNumbers?.[0]?.number || '';
        
        console.log('\n=== Processing Contact ===');
        console.log('Contact ID:', contact.id);
        console.log('Contact Name:', contact.name);
        console.log('Raw Phone Numbers:', JSON.stringify(contact.phoneNumbers, null, 2));
        console.log('Selected Phone Number:', phoneNumber);
        console.log('========================\n');

        return {
          id: contact.id,
          name: contact.name,
          phoneNumber: phoneNumber,
          phone: phoneNumber, // Store in both fields for compatibility
          email: contact.emails?.[0]?.email || '',
        };
      });

    console.log('\n=== Final Contact Data to be Passed ===');
    validContacts.forEach(contact => {
      console.log('Contact:', {
        id: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        phone: contact.phone,
        email: contact.email
      });
    });
    console.log('========================\n');

    onSelectContact(validContacts);
    setSelectedContacts([]);
    onClose();
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Contacts</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Done ({selectedContacts.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color="rgba(255, 255, 255, 0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedContacts.some(c => c.id === item.id);
                return (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => handleSelectContact(item)}
                  >
                    <View style={styles.contactInfo}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image.uri }}
                          style={styles.contactAvatar}
                        />
                      ) : (
                        <View style={styles.contactAvatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {item.name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.contactName}>{item.name}</Text>
                        {item.phoneNumbers?.[0] && (
                          <Text style={styles.contactPhone}>
                            {item.phoneNumbers[0].number}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Icon name="check" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.contactList}
            />
          )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButton: {
    marginRight: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 20,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    padding: 10,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactList: {
    padding: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  contactAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  contactName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
});

export default ContactListModal; 