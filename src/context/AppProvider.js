import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const AppContext = createContext({});

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  // Fetch groups and expenses when user changes
  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchExpenses();
    } else {
      setGroups([]);
      setExpenses([]);
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError('');
      if (!user || !user.uid) return;
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid)
      );
      const querySnapshot = await getDocs(groupsQuery);
      const fetchedGroups = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGroups(fetchedGroups);
    } catch (error) {
      setError(error.message);
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      if (!user || !user.uid) return;
      // If there are no groups, set empty expenses and return
      if (groups.length === 0) {
        setExpenses([]);
        return;
      }

      const expensesQuery = query(
        collection(db, 'expenses'),
        where('groupId', 'in', groups.map(g => g.id)),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(expensesQuery);
      const fetchedExpenses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(fetchedExpenses);
    } catch (error) {
      setError(error.message);
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (groupData) => {
    try {
      setError('');
      setLoading(true);
      if (!user || !user.uid) return;
      const groupWithMembers = {
        ...groupData,
        members: [user.uid],
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        totalExpenses: 0,
        memberBalances: { [user.uid]: 0 }
      };

      const docRef = await addDoc(collection(db, 'groups'), groupWithMembers);
      const newGroup = { ...groupWithMembers, id: docRef.id };
      setGroups(prevGroups => [...prevGroups, newGroup]);
      return newGroup;
    } catch (error) {
      setError(error.message);
      console.error('Error creating group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const editGroup = async (groupId, updatedData) => {
    try {
      setError('');
      setLoading(true);
      const groupRef = doc(db, 'groups', groupId);
      
      const finalUpdateData = {
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(groupRef, finalUpdateData);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, ...finalUpdateData } : group
        )
      );
    } catch (error) {
      setError(error.message);
      console.error('Error editing group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      setError('');
      setLoading(true);
      const groupRef = doc(db, 'groups', groupId);
      await deleteDoc(groupRef);
      setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));
      
      // Delete associated expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('groupId', '==', groupId)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      expensesSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.groupId !== groupId));
    } catch (error) {
      setError(error.message);
      console.error('Error deleting group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addMemberToGroup = async (groupId, memberId) => {
    try {
      setError('');
      setLoading(true);
      const groupRef = doc(db, 'groups', groupId);
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        throw new Error('Group not found');
      }

      const updatedMembers = [...group.members, memberId];
      const updatedMemberBalances = {
        ...group.memberBalances,
        [memberId]: 0
      };

      await updateDoc(groupRef, { 
        members: updatedMembers,
        memberBalances: updatedMemberBalances
      });
      
      setGroups(prevGroups => 
        prevGroups.map(g => 
          g.id === groupId ? { 
            ...g, 
            members: updatedMembers,
            memberBalances: updatedMemberBalances
          } : g
        )
      );
    } catch (error) {
      setError(error.message);
      console.error('Error adding member to group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromGroup = async (groupId, memberId) => {
    try {
      setError('');
      setLoading(true);
      const groupRef = doc(db, 'groups', groupId);
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        throw new Error('Group not found');
      }

      const updatedMembers = group.members.filter(id => id !== memberId);
      const { [memberId]: removedBalance, ...updatedMemberBalances } = group.memberBalances;

      await updateDoc(groupRef, { 
        members: updatedMembers,
        memberBalances: updatedMemberBalances
      });
      
      setGroups(prevGroups => 
        prevGroups.map(g => 
          g.id === groupId ? { 
            ...g, 
            members: updatedMembers,
            memberBalances: updatedMemberBalances
          } : g
        )
      );
    } catch (error) {
      setError(error.message);
      console.error('Error removing member from group:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (expenseData) => {
    try {
      setError('');
      setLoading(true);
      
      const expenseWithMetadata = {
        ...expenseData,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'expenses'), expenseWithMetadata);
      const newExpense = { ...expenseWithMetadata, id: docRef.id };
      
      // Update group's total expenses and member balances
      const group = groups.find(g => g.id === expenseData.groupId);
      if (group) {
        const updatedTotalExpenses = group.totalExpenses + expenseData.amount;
        const updatedMemberBalances = { ...group.memberBalances };
        
        // Update payer's balance
        updatedMemberBalances[expenseData.paidBy] = 
          (updatedMemberBalances[expenseData.paidBy] || 0) + expenseData.amount;
        
        // Update each member's share
        const sharePerMember = expenseData.amount / expenseData.splitBetween.length;
        expenseData.splitBetween.forEach(memberId => {
          updatedMemberBalances[memberId] = 
            (updatedMemberBalances[memberId] || 0) - sharePerMember;
        });

        await updateDoc(doc(db, 'groups', expenseData.groupId), {
          totalExpenses: updatedTotalExpenses,
          memberBalances: updatedMemberBalances
        });

        setGroups(prevGroups => 
          prevGroups.map(g => 
            g.id === expenseData.groupId ? {
              ...g,
              totalExpenses: updatedTotalExpenses,
              memberBalances: updatedMemberBalances
            } : g
          )
        );
      }

      setExpenses(prevExpenses => [...prevExpenses, newExpense]);
      return newExpense;
    } catch (error) {
      setError(error.message);
      console.error('Error adding expense:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (expenseId) => {
    try {
      setError('');
      setLoading(true);
      const expenseRef = doc(db, 'expenses', expenseId);
      const expense = expenses.find(e => e.id === expenseId);
      
      if (!expense) {
        throw new Error('Expense not found');
      }

      await deleteDoc(expenseRef);
      
      // Update group's total expenses and member balances
      const group = groups.find(g => g.id === expense.groupId);
      if (group) {
        const updatedTotalExpenses = group.totalExpenses - expense.amount;
        const updatedMemberBalances = { ...group.memberBalances };
        
        // Reverse the expense's effect on balances
        updatedMemberBalances[expense.paidBy] = 
          (updatedMemberBalances[expense.paidBy] || 0) - expense.amount;
        
        const sharePerMember = expense.amount / expense.splitBetween.length;
        expense.splitBetween.forEach(memberId => {
          updatedMemberBalances[memberId] = 
            (updatedMemberBalances[memberId] || 0) + sharePerMember;
        });

        await updateDoc(doc(db, 'groups', expense.groupId), {
          totalExpenses: updatedTotalExpenses,
          memberBalances: updatedMemberBalances
        });

        setGroups(prevGroups => 
          prevGroups.map(g => 
            g.id === expense.groupId ? {
              ...g,
              totalExpenses: updatedTotalExpenses,
              memberBalances: updatedMemberBalances
            } : g
          )
        );
      }

      setExpenses(prevExpenses => prevExpenses.filter(e => e.id !== expenseId));
    } catch (error) {
      setError(error.message);
      console.error('Error deleting expense:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    groups,
    expenses,
    loading,
    error,
    createGroup,
    editGroup,
    deleteGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    addExpense,
    deleteExpense,
    fetchGroups,
    fetchExpenses
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}; 