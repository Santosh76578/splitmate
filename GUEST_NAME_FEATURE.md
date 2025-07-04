# Guest Name Assignment Feature

## Overview

This feature automatically assigns sequential default names to guest users who don't update their profile name. The system ensures that every anonymous (guest) user has a unique, identifiable name.

## How It Works

### 1. Automatic Name Assignment
- When a guest user logs in, the system checks if they have a display name
- If no name is found, a sequential guest name is automatically assigned (e.g., "guest-2PU1", "guest-3ABC", etc.)
- The counter is stored in AsyncStorage and increments with each new guest user

### 2. Name Persistence
- Once assigned, the guest name is stored in AsyncStorage under the key 'userName'
- The name is also saved to Firestore in the user's document
- If a guest user later updates their name in the profile screen, the updated name takes precedence

### 3. Integration Points

The guest name functionality is integrated into several key areas:

#### Authentication Context (`src/context/AuthContext.js`)
- `guestLogin()`: Assigns default guest name when creating new anonymous sessions
- `onAuthStateChanged`: Ensures guest names are assigned when auth state changes

#### Profile Screens
- `ProfileScreen.js`: Uses `ensureGuestName()` to display proper guest names
- `EditProfileScreen.js`: Ensures guest names are available when editing profiles

#### Expense Management
- `AddExpenseScreen.js`: Uses guest names for expense creation and member management
- `CreateGroupScreen.js`: Uses guest names when creating groups

### 4. Utility Functions

The core functionality is implemented in `src/utils/guestNameUtils.js`:

#### `generateGuestName()`
- Generates sequential guest names (guest-2PU1, guest-3ABC, etc.)
- Manages the guest counter in AsyncStorage
- Falls back to timestamp-based names if counter fails

#### `assignDefaultGuestName(userId, userData)`
- Assigns a default guest name to a user if they don't have one
- Updates both AsyncStorage and Firestore
- Returns the assigned name

#### `ensureGuestName(user)`
- Main function used throughout the app
- Checks if user needs a default guest name
- Returns existing name or assigns a new one
- Only works for anonymous users

## Usage Examples

### Basic Usage
```javascript
import { ensureGuestName } from '../utils/guestNameUtils';

// In a component
const userName = await ensureGuestName(currentUser);
```

### In Authentication Flow
```javascript
// When creating a new guest session
const guestName = await assignDefaultGuestName(userCredential.user.uid, {
  isAnonymous: true
});
```

## Storage

### AsyncStorage Keys
- `guestCounter`: Stores the current guest counter (increments with each new guest)
- `userName`: Stores the user's display name (can be guest name or custom name)

### Firestore Fields
- `displayName`: The user's display name
- `isGuest`: Boolean indicating if user is a guest
- `isAnonymous`: Boolean indicating if user is anonymous
- `updatedAt`: Timestamp of last update

## Behavior

1. **First-time guest users**: Get assigned "guest-2PU1", "guest-3ABC", etc.
2. **Returning guest users**: Keep their previously assigned name
3. **Guest users who update their name**: Display the updated name instead of the default
4. **Non-anonymous users**: Unaffected by this feature

## Error Handling

- If AsyncStorage operations fail, the system falls back to timestamp-based names
- If Firestore operations fail, the system continues with AsyncStorage-only storage
- All errors are logged but don't break the user experience

## Testing

The functionality can be tested by:
1. Creating multiple guest sessions
2. Checking that sequential names are assigned
3. Updating guest names in the profile screen
4. Verifying that updated names persist
5. Testing with existing guest users to ensure names are preserved 