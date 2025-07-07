# Splash Screen Implementation

## Overview

This implementation provides a splash screen flow that:

1. **Shows SplashScreen** - Displays a loading screen with SplitMate branding
2. **Calls getToken() API** - Makes a request to the PLUDO Boost API
3. **Handles Token Response**:
   - If token is valid: Opens WebView with Terms of Use
   - If token is null: Navigates directly to OnboardingScreen
4. **WebView Message Handling** - Receives messages from website when user clicks Close/Accept

## Flow Diagram

```
SplashScreen ➜ getToken()
   ├── if token ➜ open WebView ➜ user clicks Close ➜ navigate to OnboardingScreen
   └── if null  ➜ navigate to OnboardingScreen
```

## Key Components

### 1. SplashScreen (`src/screens/SplashScreen.js`)
- Shows loading animation for 1.5 seconds
- Calls `getToken()` API
- Navigates to WebView if token is valid
- Navigates to OnboardingScreen if token is null or on error

### 2. WebViewScreen (`src/screens/WebViewScreen.js`)
- Loads Terms of Use URL in WebView
- Handles messages from website (Accepted, Done, Close)
- Provides manual close button in header
- Navigates to OnboardingScreen when user accepts or closes

### 3. OnboardingScreen
- Shows onboarding flow to new users
- After completion, navigates to AuthNavigator (Login/Signup)

### 4. API Service (`src/utils/api.js`)
- `getToken()` function calls PLUDO Boost API
- Endpoint: `POST https://api.pludoboost-app.info/plant`
- Headers: `x-app-id: 6748014578`
- Body: `{ date: "2024-01-01T00:00:00.000Z" }`
- Returns token or null

## WebView Message Handling

The key improvement is using WebView to receive messages from the website when the user clicks the Close/Accept button:

```javascript
const handleWebViewMessage = (event) => {
  const message = event.nativeEvent.data;
  console.log('📨 Received from WebView:', message);
  
  if (message === 'Accepted' || message === 'Done' || message === 'Close') {
    console.log('✅ User accepted terms, navigating to OnboardingScreen');
    navigation.replace('Onboarding');
  }
};
```

## Error Handling

- API failures: Navigate directly to OnboardingScreen
- WebView loading failures: Navigate directly to OnboardingScreen
- Network timeouts: Handled gracefully with 10-second timeout
- WebView message handling: Properly handles various close/accept messages

## Testing Scenarios

### Test with Valid Token
1. API returns token
2. WebView opens with Terms of Use
3. User clicks Close/Accept button on website
4. WebView receives message and navigates to OnboardingScreen

### Test with Null Token
1. API returns null
2. App navigates directly to OnboardingScreen
3. No WebView opens

### Test with API Failure
1. API call fails (network error, timeout, etc.)
2. App navigates directly to OnboardingScreen
3. No WebView opens

## Dependencies

- `axios`: For API calls
- `react-native-webview`: For WebView functionality
- `expo-linear-gradient`: For gradient background
- `@react-navigation/native`: For navigation
- `react-native-vector-icons`: For icons

## Installation

```bash
npm install axios
```

**Note**: `react-native-webview` is already installed in the project.

## Usage

The splash screen is automatically shown as the first screen in the app. The flow is:

1. App starts → SplashScreen
2. Token check → WebView (if valid) or OnboardingScreen (if null)
3. User clicks Close/Accept → OnboardingScreen
4. After onboarding → AuthNavigator (Login/Signup screens)

No additional configuration required - the flow is integrated into the main App.js navigation stack. 