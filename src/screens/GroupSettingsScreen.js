import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Text, Icon, ListItem, Switch } from '@rneui/themed';

const GroupSettingsScreen = ({ navigation, route }) => {
  const { groupId } = route.params;
  const [groupName, setGroupName] = useState('Weekend Trip');
  const [notifications, setNotifications] = useState(true);
  const [autoReminders, setAutoReminders] = useState(true);
  const [simplifyDebts, setSimplifyDebts] = useState(true);

  const handleSave = () => {
    // TODO: Implement save settings logic
    navigation.goBack();
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement leave group logic
            navigation.navigate('GroupsTab');
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone and will remove the group for all members.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete group logic
            navigation.navigate('GroupsTab');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Settings</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <ListItem containerStyle={styles.listItem}>
            <ListItem.Content>
              <ListItem.Title style={styles.settingTitle}>Notifications</ListItem.Title>
              <ListItem.Subtitle style={styles.settingDescription}>
                Receive updates about expenses and settlements
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              color="#6C63FF"
            />
          </ListItem>

          <ListItem containerStyle={styles.listItem}>
            <ListItem.Content>
              <ListItem.Title style={styles.settingTitle}>Auto Reminders</ListItem.Title>
              <ListItem.Subtitle style={styles.settingDescription}>
                Send automatic reminders for pending payments
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={autoReminders}
              onValueChange={setAutoReminders}
              color="#6C63FF"
            />
          </ListItem>

          <ListItem containerStyle={styles.listItem}>
            <ListItem.Content>
              <ListItem.Title style={styles.settingTitle}>Simplify Debts</ListItem.Title>
              <ListItem.Subtitle style={styles.settingDescription}>
                Automatically simplify debt calculations
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={simplifyDebts}
              onValueChange={setSimplifyDebts}
              color="#6C63FF"
            />
          </ListItem>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.dangerButton, styles.leaveButton]}
            onPress={handleLeaveGroup}
          >
            <Icon name="exit-to-app" type="material" color="#FF6B6B" size={20} />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={handleDeleteGroup}
          >
            <Icon name="delete-forever" type="material" color="#FF6B6B" size={20} />
            <Text style={styles.deleteButtonText}>Delete Group</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  listItem: {
    paddingVertical: 15,
    backgroundColor: 'transparent',
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  leaveButton: {
    backgroundColor: '#FFF5F5',
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
  },
  leaveButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  saveButton: {
    backgroundColor: '#6C63FF',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GroupSettingsScreen; 