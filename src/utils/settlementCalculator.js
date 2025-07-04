/**
 * Calculates settlements between group members based on expenses and splits
 */
export const calculateSettlements = (expenses, members, groupId) => {
  if (!expenses || !members || expenses.length === 0 || members.length === 0) {
    return [];
  }

  // Initialize balances for each member
  const balances = {};
  members.forEach(member => {
    balances[member.id] = 0;
  });

  // Calculate net balance for each member using the same logic as calculateNetBalance
  expenses.forEach(expense => {
    const amount = parseFloat(expense.amount || 0);
    if (isNaN(amount) || amount === 0) {
      return;
    }

    // Try to find the payer by name or ID
    const paidByMember = members.find(m => 
      m.name === expense.paidBy || 
      m.id === expense.paidBy ||
      m.id === expense.paidById
    );
    
    if (!paidByMember) {
      return;
    }

    // For each member, calculate their balance based on their split
    members.forEach(member => {
      // Find the member's split in this expense
      const memberSplit = expense.splits?.find(split => 
        split.memberId === member.id || split.memberId === member.name
      );
      
      if (memberSplit) {
        const memberSplitAmount = parseFloat(memberSplit.amount || 0);
        
        if (member.id === paidByMember.id) {
          // Member paid for this expense
          // They are owed the amount others owe them (total amount - their share)
          balances[member.id] += (amount - memberSplitAmount);
        } else {
          // Member didn't pay for this expense
          // They owe their share
          balances[member.id] -= memberSplitAmount;
        }
      }
    });
  });

  // Create settlements
  const settlements = [];
  const membersWithBalances = Object.entries(balances);
  
  // Find who needs to pay and who needs to receive
  const payers = membersWithBalances.filter(([_, balance]) => balance < -0.01); // Use threshold for floating point comparison
  const receivers = membersWithBalances.filter(([_, balance]) => balance > 0.01);

  payers.forEach(([payerId, payerBalance]) => {
    receivers.forEach(([receiverId, receiverBalance]) => {
      if (payerBalance < -0.01 && receiverBalance > 0.01) {
        const amountToPay = Math.min(Math.abs(payerBalance), receiverBalance);
        if (amountToPay > 0.01) {
          const payer = members.find(m => m.id === payerId);
          const receiver = members.find(m => m.id === receiverId);

          if (payer && receiver) {
            settlements.push({
              id: `${groupId}-${payerId}-${receiverId}-${amountToPay.toFixed(2)}-${Date.now()}`,
              from: {
                id: payerId,
                name: payer.name
              },
              to: {
                id: receiverId,
                name: receiver.name
              },
              amount: parseFloat(amountToPay.toFixed(2)),
              status: 'pending',
              createdAt: new Date().toISOString(),
              groupId
            });

            // Update balances
            payerBalance += amountToPay;
            receiverBalance -= amountToPay;
          }
        }
      }
    });
  });

  return settlements;
};

/**
 * Simplifies the settlements by minimizing the number of transactions
 */
export const simplifySettlements = (settlements) => {
  if (!settlements || settlements.length === 0) {
    return [];
  }

  // Group settlements by payer-receiver pairs
  const groupedSettlements = {};
  let counter = 0;
  settlements.forEach(settlement => {
    const key = `${settlement.from.id}-${settlement.to.id}`;
    if (!groupedSettlements[key]) {
      groupedSettlements[key] = {
        ...settlement,
        amount: 0,
        // Create a unique ID for the grouped settlement using counter
        id: `${settlement.groupId}-${settlement.from.id}-${settlement.to.id}-simplified-${counter++}`
      };
    }
    groupedSettlements[key].amount += settlement.amount;
  });

  // Convert back to array and round amounts
  const simplified = Object.values(groupedSettlements)
    .filter(settlement => settlement.amount > 0.01) // Remove settlements with very small amounts
    .map(settlement => ({
      ...settlement,
      amount: parseFloat(settlement.amount.toFixed(2))
    }));

  return simplified;
};

// Calculate net balance for a user in a group (user-centric view)
export function calculateNetBalance(expenses, userId) {
  let owesYou = 0;
  let youOwe = 0;

  expenses.forEach(expense => {
    const total = parseFloat(expense.amount || 0);
    const paidById = expense.paidById || expense.paidBy;

    // Build contributions by memberId (UID)
    const contributions = {};
    expense.splits?.forEach(split => {
      contributions[split.memberId] = parseFloat(split.amount || 0);
    });

    // Calculate balances for each person (by memberId)
    const balances = {};
    for (let memberId in contributions) {
      if (memberId === paidById) continue;
      balances[memberId] = contributions[memberId];
    }

    if (paidById === userId) {
      // Current user paid - they are owed the sum of what others owe
      owesYou += Object.values(balances).reduce((sum, amount) => sum + amount, 0);
    } else {
      // Current user didn't pay - they owe their share
      const userContribution = contributions[userId] || 0;
      youOwe += userContribution;
    }
  });

  const net = owesYou - youOwe;

  return {
    net,
    owesYou,
    youOwe
  };
}

// Calculate net balance for a user in a group, taking into account settlements
export function calculateNetBalanceWithSettlements(expenses, settlements, userId) {
  // First calculate the base balance from expenses
  const baseBalance = calculateNetBalance(expenses, userId);
  

  
  // Then adjust for settlements
  let settlementAdjustment = 0;
  
  settlements.forEach(settlement => {
    if (settlement.status === 'settled') {
      if (settlement.from?.id === userId) {
        // User paid this settlement - reduces their negative balance (they owe less)
        const amount = parseFloat(settlement.amount || 0);
        settlementAdjustment += amount; // Add to reduce negative balance
      } else if (settlement.to?.id === userId) {
        // User received this settlement - reduces their positive balance (they are owed less)
        const amount = parseFloat(settlement.amount || 0);
        settlementAdjustment -= amount; // Subtract to reduce positive balance
      }
    }
  });
  
  const adjustedNet = baseBalance.net + settlementAdjustment;
  const adjustedOwesYou = Math.max(adjustedNet, 0);
  const adjustedYouOwe = Math.max(-adjustedNet, 0);
  

  
  return {
    net: adjustedNet,
    owesYou: adjustedOwesYou,
    youOwe: adjustedYouOwe,
    baseNet: baseBalance.net,
    settlementAdjustment: settlementAdjustment
  };
} 