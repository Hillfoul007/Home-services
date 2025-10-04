import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RiderRegistration from './RiderRegistration';
import RiderOTPLogin from './RiderOTPLogin';

export default function RiderAuth() {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(true);

  // Make setActiveTab available globally for tab switching from child components
  useEffect(() => {
    (window as any).switchToRegisterTab = () => setActiveTab('register');
    (window as any).switchToLoginTab = () => setActiveTab('login');

    return () => {
      delete (window as any).switchToRegisterTab;
      delete (window as any).switchToLoginTab;
    };
  }, []);

  // Add console log to verify component is loading
  console.log('🔍 RiderAuth component loading...', { activeTab, location: window.location.href });

  useEffect(() => {
    // Simulate loading and ensure component is ready
    const timer = setTimeout(() => {
      setIsLoading(false);
      console.log('✅ RiderAuth component fully loaded');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600 mb-4">🚀 Loading Rider Portal...</div>
          <div className="text-gray-600">Please wait while we load the rider system</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4 rider-mobile-layout">
      <Card className="w-full max-w-md shadow-lg rider-card-mobile">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-purple-600 rider-heading-medium-mobile">
            Rider Portal
          </CardTitle>
          <CardDescription className="rider-text-body-mobile">
            Join our delivery team or login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <RiderOTPLogin onSwitchToRegister={() => setActiveTab('register')} />
            </TabsContent>

            <TabsContent value="register">
              <RiderRegistration onSwitchToLogin={() => setActiveTab('login')} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
