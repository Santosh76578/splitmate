import React, { useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export function createLockedWebView({ url, onMessage }) {
  console.log('🌐 Creating locked WebView with URL:', url);
  console.log('📱 Platform:', Platform.OS);

  // Return a React component that handles orientation
  const WebViewComponent = () => {
    // Allow both orientations when WebView mounts
    useEffect(() => {
      const enableBothOrientations = async () => {
        try {
          console.log('🔄 Enabling both orientations for WebView');
          await ScreenOrientation.unlockAsync();
        } catch (error) {
          console.warn('⚠️ Failed to unlock orientation:', error);
        }
      };

      const restorePortraitOnly = async () => {
        try {
          console.log('📱 Restoring portrait-only orientation');
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch (error) {
          console.warn('⚠️ Failed to lock portrait orientation:', error);
        }
      };

      enableBothOrientations();

      // Cleanup function to restore portrait-only when WebView unmounts
      return () => {
        restorePortraitOnly();
      };
    }, []);

    // JavaScript to inject for testing communication
    const injectedJavaScript = `
      (function() {
        console.log('🔧 JavaScript injection started');
        
        // Test if ReactNativeWebView is available
        if (window.ReactNativeWebView) {
          console.log('✅ ReactNativeWebView is available');
          
          // Override any existing uniwebview handling
          window.uniwebview = {
            closeApp: function() {
              console.log('📱 uniwebview.closeApp called - posting close message');
              window.ReactNativeWebView.postMessage('close');
            }
          };
          
          // Test message
          setTimeout(() => {
            console.log('🧪 Testing WebView communication...');
            window.ReactNativeWebView.postMessage('test-connection');
          }, 2000);
          
        } else {
          console.log('❌ ReactNativeWebView is NOT available');
        }
        
        // More comprehensive URL interception
        
        // 1. Override window.location assignments
        const originalLocationAssign = window.location.assign;
        window.location.assign = function(url) {
          console.log('🔗 Location.assign called with:', url);
          if (url.startsWith('uniwebview://')) {
            console.log('📱 Intercepted uniwebview URL in assign, posting close message instead');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('close');
            }
            return;
          }
          originalLocationAssign.call(window.location, url);
        };
        
        // 2. Override window.location.href setter
        let originalHref = window.location.href;
        Object.defineProperty(window.location, 'href', {
          get: function() { return originalHref; },
          set: function(url) {
            console.log('🔗 Location.href set to:', url);
            if (url.startsWith('uniwebview://')) {
              console.log('📱 Intercepted uniwebview URL in href setter, posting close message instead');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('close');
              }
              return;
            }
            originalHref = url;
            window.location.assign(url);
          }
        });
        
        // 3. Override window.open for custom schemes
        const originalWindowOpen = window.open;
        window.open = function(url, target, features) {
          console.log('🆕 Window.open called with:', url);
          if (url && url.startsWith('uniwebview://')) {
            console.log('📱 Intercepted uniwebview URL in window.open, posting close message instead');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('close');
            }
            return null;
          }
          return originalWindowOpen.call(window, url, target, features);
        };
        
        // 4. Intercept all link clicks
        document.addEventListener('click', function(event) {
          let target = event.target;
          // Find the closest anchor tag
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          
          if (target && target.href) {
            console.log('🖱️ Link clicked:', target.href);
            if (target.href.startsWith('uniwebview://')) {
              console.log('📱 Intercepted uniwebview link click, posting close message instead');
              event.preventDefault();
              event.stopPropagation();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('close');
              }
              return false;
            }
          }
        }, true);
        
        // 5. Monitor iframe src changes
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'iframe') {
            console.log('🖼️ Iframe created');
            const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src').set;
            Object.defineProperty(element, 'src', {
              set: function(url) {
                console.log('🖼️ Iframe src set to:', url);
                if (url.startsWith('uniwebview://')) {
                  console.log('📱 Intercepted uniwebview URL in iframe, posting close message instead');
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage('close');
                  }
                  return;
                }
                originalSrcSetter.call(this, url);
              },
              get: function() {
                return this.getAttribute('src');
              }
            });
          }
          return element;
        };
        
        // 6. Watch for any attempts to change page location
        const originalReplaceState = history.replaceState;
        const originalPushState = history.pushState;
        
        history.replaceState = function(state, title, url) {
          console.log('📚 History.replaceState called with:', url);
          if (url && url.startsWith('uniwebview://')) {
            console.log('📱 Intercepted uniwebview URL in replaceState, posting close message instead');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('close');
            }
            return;
          }
          return originalReplaceState.call(history, state, title, url);
        };
        
        history.pushState = function(state, title, url) {
          console.log('📚 History.pushState called with:', url);
          if (url && url.startsWith('uniwebview://')) {
            console.log('📱 Intercepted uniwebview URL in pushState, posting close message instead');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('close');
            }
            return;
          }
          return originalPushState.call(history, state, title, url);
        };
        
        console.log('🔧 JavaScript injection completed');
      })();
      true; // Note: This is required for injected JavaScript
    `;

    // Handle custom URL schemes and prevent warnings
    const handleShouldStartLoadWithRequest = (request) => {
      console.log('🔗 WebView navigation request:', request.url);
      console.log('🔍 Request details:', JSON.stringify(request, null, 2));
      
      // Handle custom uniwebview:// scheme
      if (request.url.startsWith('uniwebview://')) {
        console.log('🎯 Custom URL scheme detected:', request.url);
        
        if (request.url === 'uniwebview://accepted') {
          console.log('📨 Uniwebview accepted - treating as close message');
          console.log('🔴 WebView is being closed via URL scheme');
          console.log('🏠 Switching to Home screen');
          
          // Use setTimeout to ensure this happens after the current event loop
          setTimeout(() => {
            if (onMessage) {
              onMessage({ nativeEvent: { data: 'close' } });
            }
          }, 0);
        }
        
        // Prevent the WebView from trying to navigate to custom schemes
        console.log('🚫 Blocking custom URL scheme navigation');
        return false;
      }
      
      // Allow all other URLs to load normally
      return true;
    };

    // Handle navigation state changes (better cross-platform support)
    const handleNavigationStateChange = (navState) => {
      console.log('🧭 Navigation state change:', navState.url);
      console.log('🔍 NavState details:', JSON.stringify(navState, null, 2));
      
      if (navState.url.startsWith('uniwebview://')) {
        console.log('🎯 Custom URL scheme in navigation:', navState.url);
        
        if (navState.url === 'uniwebview://accepted') {
          console.log('📨 Uniwebview accepted via navigation - treating as close message');
          console.log('🔴 WebView is being closed via navigation');
          console.log('🏠 Switching to Home screen');
          
          // Use setTimeout to ensure this happens after the current event loop
          setTimeout(() => {
            if (onMessage) {
              onMessage({ nativeEvent: { data: 'close' } });
            }
          }, 0);
        }
      }
    };

    // Enhanced message handler with more logging
    const handleMessage = (event) => {
      console.log('📨 Raw message received from WebView:', event.nativeEvent.data);
      
      // Call the original onMessage handler
      if (onMessage) {
        onMessage(event);
      }
    };
    
    return (
      <View style={styles.container}>
        <WebView
          source={{ uri: url }}
          javaScriptEnabled={true}
          style={styles.webview}
          onLoadStart={() => console.log('🌐 WebView loading started')}
          onLoadEnd={() => console.log('🌐 WebView loading completed')}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ WebView error:', nativeEvent);
          }}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onNavigationStateChange={handleNavigationStateChange}
          injectedJavaScript={injectedJavaScript}
          // Additional props for better compatibility and URL handling
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsFullscreenVideo={true}
          originWhitelist={['*']}
          // Android specific props
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          // iOS specific props
          allowsBackForwardNavigationGestures={false}
          // Mixed content handling
          mixedContentMode={'compatibility'}
          // Enable communication between WebView and React Native
          // The WebView can send messages using window.ReactNativeWebView.postMessage()
          // and also handle custom URL schemes like uniwebview://
        />
      </View>
    );
  };

  // Return the component
  return <WebViewComponent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
}); 