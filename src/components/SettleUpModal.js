import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const SettleUpModal = ({ visible, onClose, paidBy, onSettleUp }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#2D5586', '#171E45']}
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.title}>Settle up</Text>
          
          <Text style={styles.message}>
            Have you received the payment from {paidBy}?
          </Text>

          <TouchableOpacity 
            style={styles.settleButton}
            onPress={onSettleUp}
          >
            <LinearGradient
              colors={['#FFD96D', '#FFA211']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Yes, Settle Up</Text>
            </LinearGradient>
          </TouchableOpacity>

        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: width - 40,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  settleButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 10,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettleUpModal; 