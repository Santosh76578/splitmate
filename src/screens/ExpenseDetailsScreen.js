import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Text, Card, Icon, Avatar, Divider } from '@rneui/themed';

const ExpenseDetailsScreen = ({ navigation, route }) => {
  const { expenseId } = route.params;

  // Mock data - replace with actual data fetching
  const expense = {
    id: expenseId,
    description: 'Dinner at Restaurant',
    amount: 120.50,
    paidBy: 'John Doe',
    date: '2024-03-15',
    category: 'Food & Drinks',
    group: 'Weekend Trip',
    splits: [
      { id: '1', name: 'John Doe', amount: 30.13, paid: true },
      { id: '2', name: 'Sarah Smith', amount: 30.13, paid: false },
      { id: '3', name: 'Mike Johnson', amount: 30.12, paid: false },
      { id: '4', name: 'Emily Brown', amount: 30.12, paid: false },
    ],
    notes: 'Great dinner with friends!',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
          <Text style={styles.description}>{expense.description}</Text>
          <Text style={styles.groupName}>{expense.group}</Text>
        </View>

        <Card containerStyle={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Icon name="person" type="material" color="#666" size={20} />
            <Text style={styles.detailLabel}>Paid by</Text>
            <Text style={styles.detailValue}>{expense.paidBy}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="date-range" type="material" color="#666" size={20} />
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{expense.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="category" type="material" color="#666" size={20} />
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{expense.category}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.splitsCard}>
          <Text style={styles.cardTitle}>Split Details</Text>
          {expense.splits.map((split, index) => (
            <React.Fragment key={split.id}>
              <View style={styles.splitRow}>
                <View style={styles.splitInfo}>
                  <Text style={styles.splitName}>{split.name}</Text>
                  <Text style={styles.splitAmount}>
                    ${split.amount.toFixed(2)}
                  </Text>
                </View>
                {split.paid ? (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidText}>Paid</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.payButton}>
                    <Text style={styles.payButtonText}>Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
              {index < expense.splits.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}
        </Card>

        {expense.notes && (
          <Card containerStyle={styles.notesCard}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notes}>{expense.notes}</Text>
          </Card>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate('EditExpense', { expenseId })}
          >
            <Icon name="edit" type="material" color="#6C63FF" size={20} />
            <Text style={styles.editButtonText}>Edit Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              // TODO: Implement delete logic
              navigation.goBack();
            }}
          >
            <Icon name="delete" type="material" color="#FF6B6B" size={20} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#6C63FF',
    alignItems: 'center',
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  description: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 5,
  },
  groupName: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  detailsCard: {
    borderRadius: 12,
    marginTop: -20,
    marginHorizontal: 15,
    padding: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    flex: 1,
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  splitsCard: {
    borderRadius: 12,
    marginHorizontal: 15,
    padding: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  splitInfo: {
    flex: 1,
  },
  splitName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  splitAmount: {
    fontSize: 14,
    color: '#666',
  },
  paidBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  paidText: {
    color: '#2ECC71',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 15,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 5,
  },
  notesCard: {
    borderRadius: 12,
    marginHorizontal: 15,
    padding: 15,
  },
  notes: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  editButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ExpenseDetailsScreen; 