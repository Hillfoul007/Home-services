import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Lock, LogIn, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { riderApiFetch } from '@/lib/riderApi';

interface RiderOTPLoginProps {
  onSwitchToRegister?: () => void;
}

export default function RiderOTPLogin({ onSwitchToRegister }: RiderOTPLoginProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOTP] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  const handleSwitchToRegister = () => {
    if (onSwitchToRegister) {
      onSwitchToRegister();
    } else {
      // Fallback method
      const registerTab = document.querySelector('[value="register"]') as HTMLElement;
      if (registerTab) {
        registerTab.click();
      }
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    setIsLoading(true);

    try {
      const res = await riderApiFetch('/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() })
      });

      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success('OTP sent to your phone number');
        setStep('otp');

        // Start countdown timer
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (res.status === 404) {
          toast.error('Rider not found. Please register first.', {
            duration: 5000,
            action: {
              label: 'Register Now',
              onClick: handleSwitchToRegister
            }
          });
        } else if (res.status === 403) {
          const status = responseData.status;
          if (status === 'pending') {
            toast.error('Your account is pending approval from admin. Please wait for verification.', {
              duration: 6000
            });
          } else if (status === 'rejected') {
            toast.error(`Your account has been rejected. ${responseData.rejectionReason ? 'Reason: ' + responseData.rejectionReason : 'Please contact admin for more details.'}`, {
              duration: 8000
            });
          } else {
            toast.error(responseData.message || 'Account not approved by admin');
          }
        } else {
          toast.error(responseData.message || 'Failed to send OTP');
        }
      }
    } catch (error: any) {
      console.error('Request OTP error:', error);
      const msg = error?.name === 'AbortError' ? 'Request timed out. Check your network.' : (error?.message || '').includes('Failed to fetch') ? 'Network or CORS error. Ensure your backend is reachable and permits this origin.' : 'Network error. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }

    setIsLoading(true);

    try {
      const res = await riderApiFetch('/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() })
      });

      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        // Store authentication data
        localStorage.setItem('riderAuth', JSON.stringify(responseData.rider));
        localStorage.setItem('riderToken', responseData.token);

        toast.success('Login successful!');
        navigate('/rider/dashboard');
      } else {
        if (res.status === 400) {
          toast.error(responseData.message || 'Invalid OTP');
          if (responseData.attemptsRemaining) {
            toast.info(`${responseData.attemptsRemaining} attempts remaining`);
          }
        } else if (res.status === 404) {
          toast.error('Rider not found. Please register first.', {
            duration: 5000,
            action: {
              label: 'Register Now',
              onClick: handleSwitchToRegister
            }
          });
          setStep('phone');
        } else if (res.status === 403) {
          const status = responseData.status;
          if (status === 'pending') {
            toast.error('Your account is pending approval from admin. Please wait for verification.', {
              duration: 6000
            });
          } else if (status === 'rejected') {
            toast.error(`Your account has been rejected. ${responseData.rejectionReason ? 'Reason: ' + responseData.rejectionReason : 'Please contact admin for more details.'}`, {
              duration: 8000
            });
          } else {
            toast.error(responseData.message || 'Account not approved');
          }
        } else {
          toast.error(responseData.message || 'Verification failed');
        }
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const msg = error?.name === 'AbortError' ? 'Request timed out. Check your network.' : (error?.message || '').includes('Failed to fetch') ? 'Network or CORS error. Ensure your backend is reachable and permits this origin.' : 'Network error. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setOTP('');
    await handleRequestOTP({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="space-y-6">
      {step === 'phone' ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>Phone Number</span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              'Sending OTP...'
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Send OTP
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp" className="flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <span>Enter OTP</span>
            </Label>
            <Input
              id="otp"
              name="otp"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
            />
            <p className="text-sm text-gray-600">
              OTP sent to {phone}
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              'Verifying...'
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Verify & Login
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto"
              onClick={() => setStep('phone')}
            >
              Change phone number
            </Button>
            
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto"
              onClick={handleResendOTP}
              disabled={countdown > 0}
            >
              {countdown > 0 ? (
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Resend in {countdown}s
                </span>
              ) : (
                'Resend OTP'
              )}
            </Button>
          </div>
        </form>
      )}

      
      <Alert>
        <AlertDescription>
          <strong>New Rider?</strong> Use the Register tab above to join our delivery team.
          <br />
          <strong>Account Status Info:</strong>
          <br />• <span className="text-blue-600">Pending</span>: Account awaiting admin approval
          <br />• <span className="text-red-600">Rejected</span>: Contact admin for resubmission
          <br />• <span className="text-green-600">Approved</span>: Ready to receive orders
        </AlertDescription>
      </Alert>
    </div>
  );
}
