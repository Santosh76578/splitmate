import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(route.params?.email || '');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email);
      Alert.alert(
        'Success',
        'If an account exists with this email, you will receive password reset instructions.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Reset Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.content}>
              <View style={styles.headerContainer}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Image 
                  source={require('../../../assets/Group 28.png')}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
                <Text style={styles.headerTitle}>Reset Password</Text>
                <Text style={styles.headerSubtitle}>
                  Enter your email address and we'll send you{'\n'}instructions to reset your password.
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email.."
                    placeholderTextColor="#8E8E93"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.resetButton, loading && styles.disabledButton]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#FFDF3D', '#FA8500']}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.buttonContent}>
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <>
                          <Text style={styles.resetButtonText}>Send Reset Link</Text>
                          <Ionicons name="arrow-forward" size={20} color="#000" />
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.backToLoginButton}
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 20,
  },
  logoIcon: {
    width: 120,
    height: 60,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFDF3D',
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 5,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    padding: 15,
    fontSize: 16,
  },
  buttonContainer: {
    gap: 20,
  },
  resetButton: {
    height: 55,
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.7,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  backToLoginButton: {
    height: 55,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToLoginText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen; 