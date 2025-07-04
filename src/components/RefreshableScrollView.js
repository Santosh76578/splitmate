import React, { useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const RefreshableScrollView = ({
  children,
  onRefresh,
  refreshing,
  style,
  contentContainerStyle,
  ...props
}) => {
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={[styles.container, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView
        {...props}
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFF"
            title="Pull to refresh"
            titleColor="#FFF"
          />
        }
      >
        {children}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default RefreshableScrollView; 