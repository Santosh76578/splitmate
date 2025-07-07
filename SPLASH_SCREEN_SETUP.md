# Splash Screen Flow Documentation

## Overview
The app implements a sophisticated splash screen flow that handles user onboarding, terms of use acceptance, and authentication based on user state and first-time usage.

## Flow Logic

### 1. Splash Screen Initialization
- **Location**: `src/screens/SplashScreen.js`
- **Duration**: 1.5 seconds minimum
- **Actions**:
  - Calls `getToken()` API to check for valid token
  - Checks if user has already seen the WebView (`webViewCompleted` in AsyncStorage)
  - Determines next navigation based on token validity and WebView completion status

### 2. Navigation Decision Tree

```
Splash Screen
    ↓
Check Token + WebView Status
    ↓
┌─────────────────────────────────────┐
│ Token Valid + WebView Not Seen?     │
│           ↓                         │
│        YES → WebView                │
│           ↓                         │
│        NO → AuthNavigator           │
└─────────────────────────────────────┘
```

### 3. WebView Screen (Terms of Use)
- **Location**: `src/screens/WebViewScreen.js`
- **URL**: `https://splitmate.netlify.app/terms`
- **Purpose**: Display terms of use to first-time users
- **Behavior**:
  - Shows only on first app launch (when `webViewCompleted` is not 'true')
  - Injects JavaScript to detect close/accept button clicks
  - Marks `webViewCompleted: 'true'` when user completes
  - Navigates to `AuthNavigator` after completion

### 4. AuthNavigator Flow
- **Location**: `App.js` (conditional rendering)
- **Logic**: 
  - If `!hasCompletedOnboarding` → Shows Onboarding screen
  - If `hasCompletedOnboarding` → Shows Login/Signup screens

### 5. Complete User Journey

#### First Time User (with valid token):
```
Splash → WebView → AuthNavigator → Onboarding → Login/Signup
```

#### First Time User (no token):
```
Splash → AuthNavigator → Onboarding → Login/Signup
```

#### Returning User (logged out):
```
Splash → AuthNavigator → Login/Signup
```

#### Logged In User:
```
Splash → MainTabs (direct to app)
```

## Key Features

### WebView Configuration
- **Scrolling**: Enabled with proper touch scrolling
- **JavaScript**: Injected to detect button interactions
- **Storage**: DOM storage enabled for web page functionality
- **Error Handling**: Graceful fallback to AuthNavigator on errors

### State Management
- **AsyncStorage Keys**:
  - `webViewCompleted`: Tracks if user has seen WebView
  - `onboardingCompleted`: Tracks if user has completed onboarding
  - `pendingInviteFlow`: Handles invite flow after auth
  - `pendingInviteCode`: Stores invite code during auth flow

### Navigation Strategy
- **Replace Navigation**: Uses `navigation.replace()` to prevent back navigation
- **Conditional Rendering**: Screens rendered based on user state
- **Error Recovery**: Falls back to AuthNavigator on any errors

## Implementation Details

### SplashScreen.js
```javascript
// Check if user has already seen the WebView
const hasSeenWebView = await AsyncStorage.getItem('webViewCompleted');

if (token && hasSeenWebView !== 'true') {
  // First time user with valid token
  navigation.replace('WebView');
} else {
  // No token or WebView already seen
  navigation.replace('AuthNavigator');
}
```

### WebViewScreen.js
```javascript
// Mark WebView as completed
await AsyncStorage.setItem('webViewCompleted', 'true');
// Navigate to AuthNavigator for normal flow
navigation.replace('AuthNavigator');
```

## Benefits
1. **First-Time Experience**: WebView shown only once, like onboarding
2. **Consistent Flow**: All users follow the same navigation pattern after WebView
3. **State Persistence**: User preferences saved across app sessions
4. **Error Handling**: Graceful fallbacks ensure app always works
5. **Clean Navigation**: No back button issues with replace navigation

## Testing Scenarios
1. **Fresh Install**: Should see WebView → Onboarding → Login
2. **Logged Out User**: Should see Login directly (no WebView/Onboarding)
3. **Logged In User**: Should go directly to main app
4. **App Restart**: Should maintain user state and skip WebView/Onboarding 