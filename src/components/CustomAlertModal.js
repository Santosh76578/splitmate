import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const CustomAlertModal = ({
  visible,
  title,
  message,
  buttons = [],
  onClose,
  icon = 'alert-circle-outline',
  iconColor = '#FFD96D',
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconBackground, { backgroundColor: iconColor + '20' }]}>
                <Icon name={icon} size={32} color={iconColor} />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <View style={[
              styles.buttonContainer,
              buttons.length === 1 && styles.singleButtonContainer
            ]}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    button.style === 'cancel' && styles.cancelButton,
                    buttons.length === 1 && styles.singleButton,
                  ]}
                  onPress={() => {
                    if (button.onPress) {
                      button.onPress();
                    }
                    if (onClose) {
                      onClose();
                    }
                  }}
                >
                  {button.style === 'cancel' ? (
                    <View style={styles.cancelButtonContent}>
                      <Text style={styles.cancelButtonText}>{button.text}</Text>
                    </View>
                  ) : (
                    <View style={styles.deleteButtonContent}>
                      <Text style={styles.deleteButtonText}>{button.text}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContent: {
    backgroundColor: '#13386B',
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  singleButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  singleButton: {
    maxWidth: 200,
    alignSelf: 'center',
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  cancelButtonContent: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonContent: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomAlertModal; 