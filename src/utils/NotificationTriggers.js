import NotificationService from '../services/NotificationService';

// Common notification triggers for your SplitMate app
export const NotificationTriggers = {
  // When a new group is created
  async onGroupCreated(groupId, groupName, createdByUserId, memberIds, categoryIconKey = 'Miscellaneous') {
    const notification = {
      title: 'New Group Created',
      body: `You've been added to "${groupName}"`,
      type: 'group_created',
      categoryIconKey,
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    // Send to all members except the creator
    const memberIdsToNotify = memberIds.filter(id => id !== createdByUserId);
    
    // Only send notifications if there are members to notify
    if (memberIdsToNotify.length > 0) {
      await NotificationService.sendNotificationToUsers(memberIdsToNotify, notification);
    } else {
      await NotificationService.sendNotificationToUser(createdByUserId, notification);
    }
  },

  // When a new expense is added to a group
  async onGroupExpenseAdded(groupId, groupName, expenseName, amount, addedByUserId, memberIds, categoryIconKey = 'Miscellaneous') {
    const notification = {
      title: 'New Expense Added',
      body: `${expenseName} ($${amount}) was added to "${groupName}"`,
      type: 'expense_added',
      categoryIconKey,
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    // Send to all group members (including the person who added the expense)
    await NotificationService.sendNotificationToUsers(memberIds, notification);
  },

  // When a new personal expense is added
  async onPersonalExpenseAdded(expenseName, amount, memberIds, categoryIconKey = 'Miscellaneous') {
    const notification = {
      title: 'Personal Expense Added',
      body: `You added "${expenseName}" ($${amount}) to your personal expenses`,
      type: 'personal_expense_added',
      categoryIconKey,
      data: {
        screen: 'ExpenseScreen',
        params: {}
      }
    };

    // Send notification to the expense creator
    if (memberIds && memberIds.length > 0) {
      try {
        await NotificationService.sendPersonalExpenseNotification(memberIds, notification);
      } catch (error) {
        console.error('Error in NotificationTriggers.onPersonalExpenseAdded:', error);
      }
    }
  },

  // When a payment is settled
  async onPaymentSettled(groupId, groupName, settledByUserId, memberIds) {
    const notification = {
      title: 'Payment Settled',
      body: `Payments have been settled in "${groupName}"`,
      type: 'payment_settled',
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    // Send to all group members
    await NotificationService.sendNotificationToUsers(memberIds, notification);
  },

  // When a new member is added to a group
  async onMemberAdded(groupId, groupName, newMemberName, addedByUserId, memberIds) {
    const notification = {
      title: 'New Member Added',
      body: `${newMemberName} joined "${groupName}"`,
      type: 'member_added',
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    // Always notify the new member
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      await NotificationService.sendNotificationToUsers(memberIds, notification);
    } else if (typeof memberIds === 'string') {
      await NotificationService.sendNotificationToUser(memberIds, notification);
    }
  },

  // When someone is invited to a group
  async onGroupInvite(groupId, groupName, invitedByUserId, invitedUserId) {
    const notification = {
      title: 'Group Invitation',
      body: `You've been invited to join "${groupName}"`,
      type: 'group_invite',
      data: {
        screen: 'InviteMembers',
        params: { groupId }
      }
    };

    await NotificationService.sendNotificationToUser(invitedUserId, notification);
  },

  // When an expense is edited
  async onExpenseEdited(groupId, groupName, expenseName, editedByUserId, memberIds) {
    const notification = {
      title: 'Expense Updated',
      body: `${expenseName} was updated in "${groupName}"`,
      type: 'expense_edited',
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    // Send to all group members except the person who edited
    const memberIdsToNotify = memberIds.filter(id => id !== editedByUserId);
    await NotificationService.sendNotificationToUsers(memberIdsToNotify, notification);
  },

  // When someone leaves a group
  async onMemberLeft(groupId, groupName, leftMemberName, memberIds) {
    const notification = {
      title: 'Member Left Group',
      body: `${leftMemberName} left "${groupName}"`,
      type: 'member_left',
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    await NotificationService.sendNotificationToUsers(memberIds, notification);
  },

  // When a group is deleted
  async onGroupDeleted(groupName, memberIds) {
    const notification = {
      title: 'Group Deleted',
      body: `"${groupName}" has been deleted`,
      type: 'group_deleted',
      data: {
        screen: 'GroupsTab'
      }
    };

    await NotificationService.sendNotificationToUsers(memberIds, notification);
  },

  // When there's a reminder for unsettled expenses
  async onExpenseReminder(groupId, groupName, memberIds) {
    const notification = {
      title: 'Payment Reminder',
      body: `You have unsettled expenses in "${groupName}"`,
      type: 'expense_reminder',
      data: {
        screen: 'GroupDetails',
        params: { groupId }
      }
    };

    await NotificationService.sendNotificationToUsers(memberIds, notification);
  },

  // Custom notification
  async sendCustomNotification(userIds, title, body, type = 'custom', data = {}) {
    const notification = {
      title,
      body,
      type,
      data
    };

    if (Array.isArray(userIds)) {
      await NotificationService.sendNotificationToUsers(userIds, notification);
    } else {
      await NotificationService.sendNotificationToUser(userIds, notification);
    }
  }
};

export default NotificationTriggers; 