import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Text, Card, Icon, ListItem } from '@rneui/themed';

const SettleUpScreen = ({ navigation, route }) => {
  const { groupId } = route.params;

  const settlements = [
    {
      id: '1',
      from: 'Sarah Smith',
      to: 'John Doe',
      amount: 75.00,
    },
    {
      id: '2',
      from: 'Mike Johnson',
      to: 'John Doe',
      amount: 45.00,
    },
    {
      id: '3',
      from: 'Emily Brown',
      to: 'John Doe',
      amount: 30.00,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Settle Up</Text>
          <Text style={styles.subtitle}>Suggested payments to settle all debts</Text>
        </View>

        <View style={styles.content}>
          {settlements.map((settlement) => (
            <Card key={settlement.id} containerStyle={styles.settlementCard}>
              <View style={styles.settlementContent}>
                <View style={styles.settlementInfo}>
                  <Text style={styles.settlementText}>
                    <Text style={styles.name}>{settlement.from}</Text> pays{' '}
                    <Text style={styles.name}>{settlement.to}</Text>
                  </Text>
                  <Text style={styles.amount}>${settlement.amount.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={() => {
                    // TODO: Implement record payment logic
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.recordButtonText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#0066FF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    padding: 15,
  },
  settlementCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  settlementContent: {
    gap: 15,
  },
  settlementInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementText: {
    fontSize: 16,
    color: '#333',
  },
  name: {
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  recordButton: {
    backgroundColor: '#6C63FF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    margin: 15,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  doneButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettleUpScreen; 