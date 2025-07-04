import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Alert,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const SuccessModal = ({ visible, onClose, link, onCopy }) => {
  const [isCopied, setIsCopied] = useState(false);

  // Reset copy state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsCopied(false);
    }
  }, [visible]);

  const handleCopyLink = async () => {
    if (!link) {
      Alert.alert('Error', 'No link available to copy');
      return;
    }

    try {
      await Clipboard.setString(link);
      setIsCopied(true);
      Alert.alert('Success', 'Link copied to clipboard!');
      if (onCopy) {
        onCopy();
      }
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Error', 'Failed to copy link');
    }
  };

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
          {/* <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity> */}
          
          <Text style={styles.title}>Group Created Successfully!</Text>
          
          <Text style={styles.link}>{link}</Text>

          <TouchableOpacity 
            style={[styles.copyButton, isCopied && styles.copyButtonDisabled]}
            onPress={handleCopyLink}
            disabled={isCopied}
          >
            <LinearGradient
              colors={isCopied ? ['#4CAF50', '#45A049'] : ['#FFD96D', '#FFA211']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>
                {isCopied ? 'Copied!' : 'Copy link'}
              </Text>
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
  link: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  copyButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 20,
  },
  copyButtonDisabled: {
    opacity: 0.7,
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
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progress: {
    width: '100%',
    height: '100%',
  },
});

export default SuccessModal; 