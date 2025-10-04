import { useState, useEffect } from 'react';
import NetworkService from '@/services/networkService';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const networkService = NetworkService.getInstance();

  useEffect(() => {
    const handleStatusChange = (online: boolean) => {
      setIsOnline(online);
    };

    networkService.addStatusListener(handleStatusChange);

    return () => {
      networkService.removeStatusListener(handleStatusChange);
    };
  }, [networkService]);

  const checkBackendHealth = async (apiUrl: string) => {
    const healthy = await networkService.checkBackendHealth(apiUrl);
    setIsBackendHealthy(healthy);
    return healthy;
  };

  const safeFetch = async (url: string, options?: RequestInit) => {
    return networkService.safeFetch(url, options);
  };

  const getErrorMessage = (error: any) => {
    return networkService.getErrorMessage(error);
  };

  return {
    isOnline,
    isBackendHealthy,
    checkBackendHealth,
    safeFetch,
    getErrorMessage
  };
};

export default useNetworkStatus;
