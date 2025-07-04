import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon, Divider, ListItem } from '@rneui/themed';
import { useTheme } from '../context/ThemeContext';

const ThemeSettings = ({ showOptions, setShowOptions }) => {
  const { theme, isDarkMode, themeMode, setThemeMode } = useTheme();

  const handleThemeChange = async (mode) => {
    try {
      await setThemeMode(mode);
      setShowOptions(false);
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  const getThemeModeLabel = () => {
    switch (themeMode) {
      case 'system':
        return 'System Default';
      case 'light':
        return 'Light Mode';
      case 'dark':
        return 'Dark Mode';
      default:
        return 'System Default';
    }
  };

  return (
    <>
      <ListItem
        containerStyle={[styles.menuItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => setShowOptions(!showOptions)}
      >
        <Icon
          name={isDarkMode ? "light-mode" : "dark-mode"}
          type="material"
          color={theme.colors.primary}
          size={24}
        />
        <ListItem.Content>
          <ListItem.Title style={[styles.menuTitle, { color: theme.colors.text }]}>
            Appearance
          </ListItem.Title>
          <ListItem.Subtitle style={{ color: theme.colors.textSecondary }}>
            {getThemeModeLabel()}
          </ListItem.Subtitle>
        </ListItem.Content>
        <ListItem.Chevron color={theme.colors.textSecondary} />
      </ListItem>

      {showOptions && (
        <View style={[styles.themeOptions, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity 
            style={[styles.themeOption, themeMode === 'system' && styles.selectedThemeOption]} 
            onPress={() => handleThemeChange('system')}
          >
            <Icon
              name="settings-brightness"
              type="material"
              color={themeMode === 'system' ? theme.colors.primary : theme.colors.textSecondary}
              size={24}
            />
            <Text style={[styles.themeOptionText, { color: themeMode === 'system' ? theme.colors.primary : theme.colors.text }]}>
              System Default
            </Text>
          </TouchableOpacity>
          
          <Divider style={{ backgroundColor: theme.colors.divider }} />
          
          <TouchableOpacity 
            style={[styles.themeOption, themeMode === 'light' && styles.selectedThemeOption]} 
            onPress={() => handleThemeChange('light')}
          >
            <Icon
              name="light-mode"
              type="material"
              color={themeMode === 'light' ? theme.colors.primary : theme.colors.textSecondary}
              size={24}
            />
            <Text style={[styles.themeOptionText, { color: themeMode === 'light' ? theme.colors.primary : theme.colors.text }]}>
              Light Mode
            </Text>
          </TouchableOpacity>
          
          <Divider style={{ backgroundColor: theme.colors.divider }} />
          
          <TouchableOpacity 
            style={[styles.themeOption, themeMode === 'dark' && styles.selectedThemeOption]} 
            onPress={() => handleThemeChange('dark')}
          >
            <Icon
              name="dark-mode"
              type="material"
              color={themeMode === 'dark' ? theme.colors.primary : theme.colors.textSecondary}
              size={24}
            />
            <Text style={[styles.themeOptionText, { color: themeMode === 'dark' ? theme.colors.primary : theme.colors.text }]}>
              Dark Mode
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    marginBottom: 1,
  },
  menuTitle: {
    fontSize: 16,
  },
  themeOptions: {
    marginTop: 1,
    marginBottom: 1,
    borderRadius: 5,
    overflow: 'hidden',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  selectedThemeOption: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  themeOptionText: {
    fontSize: 16,
    marginLeft: 15,
  },
});

export default ThemeSettings; 