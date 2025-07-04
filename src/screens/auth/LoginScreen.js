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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, getAuth } from 'firebase/auth';
import { db } from '../../config/firebase';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, guestLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const auth = getAuth();

  const handleLogin = async () => {
    try {
      setLoginLoading(true);
      const result = await login(email, password);
      if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setGuestLoading(true);
      await guestLogin();
    } catch (error) {
      Alert.alert('Guest Login Failed', error.message);
    } finally {
      setGuestLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }
    navigation.navigate('ForgotPassword', { email });
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
                <Image 
                  source={require('../../../assets/Group 28.png')}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
                <Text style={styles.headerTitle}>Sign in to Splitmate</Text>
                <Text style={styles.headerSubtitle}>
                  Pick up where you left off and manage{'\n'}expenses effortlessly.
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
                    editable={!loginLoading && !guestLoading}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password.."
                    placeholderTextColor="#8E8E93"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loginLoading && !guestLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loginLoading || guestLoading}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={24}
                      color="#8E8E93"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.signInButton, loginLoading && styles.disabledButton]}
                  onPress={handleLogin}
                  disabled={loginLoading || guestLoading}
                >
                  <LinearGradient
                    colors={['#FFDF3D', '#FA8500']}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.buttonContent}>
                      {loginLoading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <>
                          <Text style={styles.signInText}>Sign in</Text>
                          <Ionicons name="arrow-forward" size={20} color="#000" />
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.appleButton, loginLoading && styles.disabledButton]}
                  disabled={loginLoading || guestLoading}
                >
                  <Ionicons
                    name="logo-apple"
                    size={24}
                    color="#000"
                    style={styles.appleIcon}
                  />
                  <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.guestButton, guestLoading && styles.disabledButton]}
                  onPress={handleGuestLogin}
                  disabled={guestLoading || loginLoading}
                >
                  <View style={styles.buttonContent}>
                    {guestLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Signup')}
                  disabled={loginLoading || guestLoading}
                >
                  <Text style={styles.signUpText}>Sign up</Text>
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
  content: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: 'flex-start',
    marginTop: 40,
    marginBottom: 40,
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
  eyeIcon: {
    padding: 15,
  },
  buttonContainer: {
    gap: 20,
  },
  signInButton: {
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
  signInText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#fff',
    height: 55,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: {
    marginRight: 10,
  },
  appleButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  guestButton: {
    height: 55,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#fff',
    fontSize: 16,
  },
  signUpText: {
    color: '#FFDF3D',
    fontSize: 16,
    fontWeight: '600',
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FFDF3D',
    fontSize: 14,
    fontWeight: '600',
  }
});

export default LoginScreen; 