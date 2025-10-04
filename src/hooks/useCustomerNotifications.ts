import { useState, useEffect, useCallback } from 'react';
import CustomerNotificationService, { CustomerNotification } from '@/services/customerNotificationService';
import { DVHostingSmsService } from '@/services/dvhostingSmsService';
import { useNotifications } from '@/contexts/NotificationContext';

export const useCustomerNotifications = () => {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const notificationService = CustomerNotificationService.getInstance();
  const authService = DVHostingSmsService.getInstance();
  const { addNotification } = useNotifications();

  // Get current user
  const getCurrentCustomer = useCallback(() => {
    try {
      const currentUser = authService.getCurrentUser();
      return currentUser;
    } catch (error) {
      console.warn('No authenticated user found');
      return null;
    }
  }, [authService]);

  // Load notifications for current customer
  const loadNotifications = useCallback(async () => {
    const customer = getCurrentCustomer();
    if (!customer) return;

    setIsLoading(true);
    try {
      const customerId = customer.phone || customer.id;
      const customerNotifications = notificationService.getNotificationsForCustomer(customerId);
      setNotifications(customerNotifications);
    } catch (error) {
      console.error('Failed to load customer notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentCustomer, notificationService]);

  // Listen for new customer notifications
  useEffect(() => {
    const handleCustomerNotification = (event: CustomEvent) => {
      const { detail } = event;
      console.log('📱 Received customer notification:', detail);

      // Add to in-app notification system
      addNotification({
        type: 'info',
        title: detail.title,
        message: detail.message,
        read: false
      });

      // Reload notifications list
      loadNotifications();
    };

    window.addEventListener('customerNotification', handleCustomerNotification as EventListener);

    return () => {
      window.removeEventListener('customerNotification', handleCustomerNotification as EventListener);
    };
  }, [addNotification, loadNotifications]);

  // Simulate order status notifications (for demo purposes)
  const simulateOrderConfirmation = useCallback(async (orderId: string, bookingId: string) => {
    const customer = getCurrentCustomer();
    if (!customer) return;

    await notificationService.sendOrderConfirmationNotification(
      orderId,
      customer.phone || customer.id,
      customer.phone,
      {
        bookingId,
        riderName: 'Demo Rider',
        pickupTime: 'Today 2:00 PM - 4:00 PM'
      }
    );
  }, [getCurrentCustomer, notificationService]);

  const simulateRiderAssignment = useCallback(async (orderId: string) => {
    const customer = getCurrentCustomer();
    if (!customer) return;

    await notificationService.sendRiderAssignedNotification(
      orderId,
      customer.phone || customer.id,
      customer.phone,
      {
        name: 'Raj Kumar',
        phone: '+91 9876543210',
        pickupTime: 'Today 2:00 PM - 4:00 PM'
      }
    );
  }, [getCurrentCustomer, notificationService]);

  const simulateStatusUpdate = useCallback(async (orderId: string, bookingId: string, newStatus: string) => {
    const customer = getCurrentCustomer();
    if (!customer) return;

    await notificationService.sendStatusUpdateNotification(
      orderId,
      customer.phone || customer.id,
      customer.phone,
      {
        oldStatus: 'pending',
        newStatus,
        bookingId
      }
    );
  }, [getCurrentCustomer, notificationService]);

  // Initialize and load notifications
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    isLoading,
    loadNotifications,
    simulateOrderConfirmation,
    simulateRiderAssignment,
    simulateStatusUpdate,
    notificationService
  };
};

export default useCustomerNotifications;
