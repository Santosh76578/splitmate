import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

export const ThemeContext = createContext();

export const lightTheme = {
  colors: {
    primary: '#6C63FF',
    secondary: '#FF6584',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    border: '#E0E0E0',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    divider: '#E0E0E0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
  },
};

export const darkTheme = {
  colors: {
    primary: '#8B85FF',
    secondary: '#FF8FA3',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#2C2C2C',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
    divider: '#2C2C2C',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(lightTheme);

  useEffect(() => {
    const loadThemePreference = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userDarkMode = userData.darkMode ?? systemColorScheme === 'dark';
            setIsDarkMode(userDarkMode);
            setTheme(userDarkMode ? darkTheme : lightTheme);
          } else {
            setIsDarkMode(systemColorScheme === 'dark');
            setTheme(systemColorScheme === 'dark' ? darkTheme : lightTheme);
          }
        } catch (error) {
          console.error('Error loading theme preference:', error);
          setIsDarkMode(systemColorScheme === 'dark');
          setTheme(systemColorScheme === 'dark' ? darkTheme : lightTheme);
        }
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
        setTheme(systemColorScheme === 'dark' ? darkTheme : lightTheme);
      }
    };

    loadThemePreference();
  }, [user, systemColorScheme]);

  const toggleTheme = async () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    setTheme(newIsDarkMode ? darkTheme : lightTheme);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          darkMode: newIsDarkMode,
        });
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 