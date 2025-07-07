import React, { useState, useRef } from 'react';
import { SafeAreaView, Platform, StyleSheet, View, Text, TouchableOpacity, StatusBar, Alert, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WebViewScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef(null);

  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;
    console.log('📱 Received from WebView:', message);
    try {
      const data = JSON.parse(message);
      if (data.action === 'close' || data.action === 'accept') {
        await AsyncStorage.setItem('hasAcceptedTerms', 'true');
        navigation.replace('Splash');
      }
    } catch (error) {
      if (message === 'Accepted' || message === 'Done') {
        await AsyncStorage.setItem('hasAcceptedTerms', 'true');
        navigation.replace('Splash');
      }
    }
  };

  const handleBackPress = async () => {
    Alert.alert(
      'Exit Terms of Use',
      'Are you sure you want to exit? You must accept the terms to continue.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.setItem('hasAcceptedTerms', 'true');
            navigation.replace('Splash');
          },
        },
      ]
    );
    return true;
  };

  React.useEffect(() => {
    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2D5586" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Terms of Use</Text>
        <TouchableOpacity onPress={handleBackPress} style={styles.closeButton}>
          <Icon name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://pludoboost-app.info/termsofuse/' }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        scrollEnabled={true}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={true}
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        injectedJavaScript={`
          (function() {
            window.acceptUPrivacyPolicy = function() {
              window.ReactNativeWebView.postMessage('Accepted');
            };
          })();
          true;
        `}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D5586',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#2D5586',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 5,
  },
  webview: {
    flex: 1,
  },
}); 