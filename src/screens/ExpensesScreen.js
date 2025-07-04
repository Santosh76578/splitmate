import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Text, Button, Icon, FAB } from '@rneui/themed';
import { theme } from '../theme/theme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ScreenWithBottomNav from '../components/ScreenWithBottomNav';
import { LinearGradient } from 'expo-linear-gradient';
import SettleUpModal from '../components/SettleUpModal';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationBadge from '../components/NotificationBadge';

const categoryIcons = {
  Food: require('../../assets/category/Food.png'),
  Drinks: require('../../assets/category/Drinks.png'),
  Trip: require('../../assets/category/trip.png'),
  Party: require('../../assets/category/party.png'),
  Groccery: require('../../assets/category/grocery.png'),
  Gift: require('../../assets/category/Gift.png'),
  Entertainment: require('../../assets/category/Entertainment.png'),
  Office: require('../../assets/category/Office.png'),
  Booking: require('../../assets/category/Bookings.png'),
  Travel: require('../../assets/category/travel.png'),
  Miscellaneous: require('../../assets/category/misscelenous.png'),
};

const ExpensesScreen = () => {
  const navigation = useNavigation();
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [expenses, setExpenses] = useState({ today: [], past: {} });
  const [loading, setLoading] = useState(true);

  // Fetch expenses every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchExpenses();
    }, [])
  );

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const userId = currentUser.uid;
      const isGuestUser = currentUser.isAnonymous;
      let expensesArr = [];
      if (isGuestUser) {
        // Load guest expenses from AsyncStorage
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        // Only include personal expenses (isPersonal === true)
        expensesArr = guestExpenses
          .filter(exp => exp.isPersonal === true)
          .map(exp => ({
            ...exp,
            date: exp.date || new Date().toISOString(),
            members: exp.members || [],
            paidBy: exp.paidBy || 'Guest',
            status: exp.status || 'unsettled',
          }));
      } else {
        // Firestore logic
        const q = query(collection(db, 'personalExpenses'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
          expensesArr.push({ id: doc.id, ...doc.data() });
        });
      }

      // Group expenses by date
      const todayStr = new Date().toLocaleDateString('en-GB');
      const today = [];
      const past = {};
      expensesArr.forEach(exp => {
        let expDateObj;
        if (exp.date && exp.date.toDate) {
          expDateObj = exp.date.toDate();
        } else if (typeof exp.date === 'string' && !isNaN(Date.parse(exp.date))) {
          expDateObj = new Date(exp.date);
        } else {
          expDateObj = new Date();
        }
        const expDateStr = expDateObj.toLocaleDateString('en-GB');
        const expTimeStr = expDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const expenseObj = {
          ...exp,
          date: expDateStr,
          time: expTimeStr,
          participants: (exp.members || []).map((m, idx) => ({
            id: m.id || idx,
            name: m.name || '',
            avatar: m.avatar ? { uri: m.avatar } : require('../../assets/avatar1.png'),
          })),
          splitAmount: exp.amount && exp.members && exp.members.length > 0 ? Math.round(Number(exp.amount) / exp.members.length) : 0,
          isSettled: exp.status === 'settled',
        };
        if (expDateStr === todayStr) {
          today.push(expenseObj);
        } else {
          if (!past[expDateStr]) past[expDateStr] = [];
          past[expDateStr].push(expenseObj);
        }
      });
      setExpenses({ today, past });
    } catch (e) {
      setExpenses({ today: [], past: {} });
    }
    setLoading(false);
  };

  const handleSettleUp = async () => {
    if (!selectedExpense) return;
    const currentUser = auth.currentUser;
    const isGuestUser = currentUser?.isAnonymous;

    try {
      if (isGuestUser) {
        // Update guest expense in AsyncStorage
        const guestExpenses = JSON.parse(await AsyncStorage.getItem('guestExpenses') || '[]');
        const updatedExpenses = guestExpenses.map(exp =>
          exp.id === selectedExpense.id ? { ...exp, status: 'settled' } : exp
        );
        await AsyncStorage.setItem('guestExpenses', JSON.stringify(updatedExpenses));
        setShowSettleModal(false);
        fetchExpenses();
      } else {
        // Update Firestore for regular users
        await updateDoc(doc(db, 'personalExpenses', selectedExpense.id), {
          status: 'settled',
        });
        setShowSettleModal(false);
        fetchExpenses();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to settle expense.');
    }
  };

  const renderExpenseCard = (expense) => (
    <View style={styles.expenseCard} key={expense.id}>
      <View style={styles.expenseHeader}>
        <View style={styles.timeContainer}>
          <Icon name="access-time" size={16} color="#8F9BB3" />
          <Text style={styles.timeText}>{expense.time}</Text>
        </View>
        <View style={styles.dateContainer}>
          <Icon name="calendar-today" size={16} color="#8F9BB3" />
          <Text style={styles.dateText}>{expense.date}</Text>
        </View>
      </View>

      <View style={styles.expenseContent}>
        <View style={styles.expenseLeft}>
          <View style={styles.iconContainer}>
            <Image
              source={categoryIcons[expense.category] || categoryIcons['Miscellaneous']}
              style={styles.categoryImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.expenseDetails}>
            <Text style={styles.expenseTitle}>{expense.description}</Text>
            <View style={styles.paidByContainer}>
              <View style={styles.paidByAvatarText}>
                <Text style={styles.paidByAvatarTextLabel}>
                  {expense.paidBy && expense.paidBy.length > 0 ? expense.paidBy[0].toUpperCase() : '?'}
                </Text>
              </View>
              <Text style={styles.paidByText}>Paid by {expense.paidBy}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.totalAmount}>
          ${Number(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.splitSection}>
        <View style={styles.participantsContainer}>
          {expense.participants.map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.participantAvatarText,
                { marginLeft: index > 0 ? -10 : 0 }
              ]}
            >
              <Text style={styles.participantAvatarTextLabel}>
                {participant.name && participant.name.length > 0
                  ? participant.name[0].toUpperCase()
                  : '?'}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          {(expense.splitMethod === 'Equally' || !expense.splitMethod) && (
            <Text style={styles.splitText}>
              Split: ${expense.splitAmount ? Number(expense.splitAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} Each
            </Text>
          )}
          {expense.splitMethod === 'Equally' || !expense.splitMethod
            ? expense.participants.map((participant) => (
                <Text style={styles.splitText} key={participant.id}>
                  {participant.name}: $
                  {expense.splitAmount
                    ? Number(expense.splitAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </Text>
              ))
            : expense.participants.map((participant) => (
                <Text style={styles.splitText} key={participant.id}>
                  {participant.name}: $
                  {expense.splitAmounts && expense.splitAmounts[participant.id]
                    ? Number(expense.splitAmounts[participant.id]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </Text>
              ))}
        </View>
      </View>

      {!expense.isSettled ? (
        <TouchableOpacity 
          style={styles.settleButton}
          onPress={() => {
            setSelectedExpense(expense);
            setShowSettleModal(true);
          }}
        >
          <Text style={styles.settleButtonText}>Mark as Settled</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.settledText}>Expense Settled</Text>
      )}
    </View>
  );

  const hasAnyExpenses = expenses.today.length > 0 || Object.keys(expenses.past).length > 0;

  return (
    <LinearGradient
      colors={['#2D5586', '#171E45']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.mainContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Personal Expenses</Text>
          <TouchableOpacity style={styles.notificationButton} onPress={()=>navigation.navigate('Notifications')}>
            <Icon name="notifications" color="#FFF" size={24} />
            <NotificationBadge />
          </TouchableOpacity>
        </View>

        <View style={styles.scrollContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#FFD96D" style={{ marginTop: 0 }} />
          ) : !hasAnyExpenses ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 0 }}>
              <Image
                source={require('../../assets/expense2.png')}
                style={{ width: 240, height: 220, marginBottom: 24 }}
                resizeMode="contain"
              />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                📚 No Expenses Added
              </Text>
              <Text style={{ color: '#fff', fontSize: 15, opacity: 0.8, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 }}>
                Looks like it's all quiet here 🫣— add your first expense now 💰 and keep your group spending in check 📊!
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddExpense')}
                style={{ borderRadius: 10, marginTop: 10, elevation: 2 }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FFB800', '#FFD96D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 10,
                    paddingVertical: 14,
                    paddingHorizontal: 80,
                    shadowColor: '#FFB800',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 18 }}>
                    Add Expense  +
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Today's Expenses */}
              <Text style={styles.dateHeader}>Today</Text>
              {expenses.today.length === 0 ? (
                <Text style={{ color: '#fff', marginBottom: 20 }}>No expenses for today.</Text>
              ) : (
                expenses.today.map(expense => renderExpenseCard(expense))
              )}

              {/* Past Expenses */}
              {Object.entries(expenses.past).map(([date, dateExpenses]) => (
                <View key={date}>
                  <Text style={[styles.dateHeader, styles.pastDateHeader]}>{date}</Text>
                  {dateExpenses.map(expense => renderExpenseCard(expense))}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <SettleUpModal
          visible={showSettleModal}
          onClose={() => setShowSettleModal(false)}
          paidBy={selectedExpense?.paidBy}
          onSettleUp={handleSettleUp}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    marginTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderColor: '#171E45',
  },
  scrollContainer: {
    flex: 1,
    height: '100%',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Increased padding at the bottom
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  notificationButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 15,
  },
  pastDateHeader: {
    marginTop: 20,
  },
  expenseCard: {
    backgroundColor: '#13386B',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#8F9BB3',
    marginLeft: 5,
    fontSize: 14,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#8F9BB3',
    marginLeft: 5,
    fontSize: 14,
  },
  expenseContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: '#3D4785',
    padding: 10,
    borderRadius: 10,
  },
  expenseDetails: {
    marginLeft: 15,
  },
  expenseTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  paidByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidByAvatarText: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD96D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  paidByAvatarTextLabel: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 12,
  },
  paidByText: {
    color: '#8F9BB3',
    fontSize: 14,
  },
  totalAmount: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
    flexShrink: 0,
    paddingLeft: 8,
    textAlign: 'right',
  },
  splitSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  participantsContainer: {
    flexDirection: 'row',
  },
  participantAvatarText: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFD96D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2A325C',
  },
  participantAvatarTextLabel: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  splitText: {
    color: '#8F9BB3',
    fontSize: 14,
  },
  settleButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  settleButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  settledText: {
    color: '#4CAF50',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    marginBottom: 60,
  },
  categoryImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
    // backgroundColor: '#fff',
  },
});

export default ExpensesScreen; 