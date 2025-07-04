import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const AddOptionsModal = ({ visible, onClose, navigation }) => {
  const handleCreateGroup = () => {
    onClose();
    navigation.navigate('CreateGroup');
  };

  const handleAddExpense = () => {
    onClose();
    navigation.navigate('AddExpense');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.container}>
          <TouchableWithoutFeedback>
            <LinearGradient
              colors={['#2D5586', '#171E45']}
              style={styles.modalContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.handle} />
              
              <TouchableOpacity 
                style={styles.option} 
                onPress={handleCreateGroup}
              >
                <View style={styles.avatarContainer}>
                  <Image
                    source={require('../../assets/avatar.png')}
                    style={styles.avatar}
                  />
                </View>
                <Text style={styles.optionText}>Create a Group</Text>
                <Icon name="chevron-right" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity 
                style={styles.option}
                onPress={handleAddExpense}
              >
                <View style={styles.avatarContainer}>
                  <Image
                    source={require('../../assets/expensedff.png')}
                    style={styles.avatar}
                  />
                </View>
                <Text style={styles.optionText}>Add Expense, Outside Groups</Text>
                <Icon name="chevron-right" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 15,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#3D4785',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 5,
  },
});

export default AddOptionsModal; 