import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Upload, User, Phone, FileText, CheckCircle, Lock, Timer } from 'lucide-react';
import { toast } from 'sonner';

// Helper function to get the correct API URL for rider endpoints
const getRiderApiUrl = (endpoint: string): string => {
  const isDev = import.meta.env.DEV;
  const hostname = window.location.hostname;
  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isRenderCom = hostname.includes("onrender.com");
  const isLaundrifyDomain = hostname.includes("laundrify.online");

  console.log('🔍 Rider Registration API URL Detection:', {
    isDev,
    hostname,
    isLocalhost,
    isRenderCom,
    isLaundrifyDomain,
    mode: import.meta.env.MODE,
    origin: window.location.origin
  });

  // Always use production backend for rider endpoints due to local server issues
  if (isLocalhost && isDev) {
    console.log('🔄 Using production backend for rider registration API (local server bypass)');
    return `https://home-services-5alb.onrender.com/api/riders${endpoint}`;
  } else if (isRenderCom || isLaundrifyDomain || !isLocalhost) {
    // Any hosted environment - use backend server
    const backendUrl = 'https://home-services-5alb.onrender.com/api/riders' + endpoint;
    console.log('🌐 Using backend server for rider registration API:', backendUrl);
    return backendUrl;
  }

  // Fallback to production backend
  return `https://home-services-5alb.onrender.com/api/riders${endpoint}`;
};

interface RiderRegistrationProps {
  onSwitchToLogin?: () => void;
}

export default function RiderRegistration({ onSwitchToLogin }: RiderRegistrationProps) {
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    aadharNumber: ''
  });
  const [otp, setOTP] = useState('');
  const [aadharImage, setAadharImage] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAadharUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      setAadharImage(file);
    }
  };

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      setSelfieImage(file);
      toast.success('Selfie uploaded successfully!');
    }
  };

  const startCamera = async () => {
    try {
      // Check if we're in a secure context and camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not available in this environment');
        return;
      }

      // Check if we're in an iframe with restricted permissions
      if (window.self !== window.top) {
        toast.error('Camera access not available in embedded view. Please use file upload instead.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Camera access error:', err);

      if (err.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access or use file upload instead.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No camera found. Please use file upload instead.');
      } else if (err.name === 'NotSupportedError') {
        toast.error('Camera not supported in this browser. Please use file upload instead.');
      } else {
        toast.error('Camera not available. Please use file upload instead.');
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
            setSelfieImage(file);
            stopCamera();
            toast.success('Selfie captured successfully!');
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.aadharNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!aadharImage) {
      toast.error('Please upload Aadhar card image');
      return;
    }

    if (!selfieImage) {
      toast.error('Please capture your selfie');
      return;
    }

    setIsSubmitting(true);

    try {
      // Request OTP for registration
      const response = await fetch(getRiderApiUrl('/register/request-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: formData.phone.trim() }),
      });

      // Read response once to avoid "body stream already read" error
      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
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
        if (response.status === 400 && responseData.message?.includes('already exists')) {
          toast.error('A rider with this phone number already exists');
        } else {
          toast.error(responseData.message || 'Failed to send OTP');
        }
      }
    } catch (error) {
      console.error('OTP request error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }

    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('aadharNumber', formData.aadharNumber);
      formDataToSend.append('otp', otp.trim());
      formDataToSend.append('aadharImage', aadharImage!);
      formDataToSend.append('selfieImage', selfieImage!);

      const response = await fetch(getRiderApiUrl('/register'), {
        method: 'POST',
        body: formDataToSend,
      });

      // Read response once to avoid "body stream already read" error
      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        setStep('success');
        toast.success('Registration submitted successfully!');
      } else {
        if (response.status === 400) {
          toast.error(responseData.message || 'Invalid OTP');
          if (responseData.attemptsRemaining) {
            toast.info(`${responseData.attemptsRemaining} attempts remaining`);
          }
        } else {
          toast.error(responseData.message || 'Registration failed');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setOTP('');
    await handleFormSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  if (step === 'success') {
    return (
      <div className="text-center p-6 rider-mobile-layout">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-700 mb-2 rider-heading-small-mobile">
          Registration Submitted!
        </h3>
        <p className="text-gray-600 mb-4 rider-text-body-mobile">
          Thank you for registering. Our admin will verify your details and approve your account.
          You'll receive a notification once your account is approved.
        </p>
        <Button
          onClick={() => {
            setStep('form');
            setFormData({ name: '', phone: '', aadharNumber: '' });
            setOTP('');
            setAadharImage(null);
            setSelfieImage(null);
          }}
          variant="outline"
          className="rider-action-button-mobile rider-outline-action-mobile"
        >
          Register Another Rider
        </Button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="space-y-6 rider-mobile-layout">
        <Card className="rider-card-mobile">
          <CardHeader>
            <CardTitle className="rider-heading-small-mobile">Verify Phone Number</CardTitle>
            <CardDescription className="rider-text-body-mobile">
              Enter the OTP sent to {formData.phone}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center space-x-2 rider-label-mobile">
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
                  className="rider-input-mobile"
                />
              </div>

              <Button
                type="submit"
                className="rider-action-button-mobile rider-primary-action-mobile"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  'Submitting Registration...'
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete Registration
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setStep('form')}
                >
                  Back to form
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 rider-mobile-layout">
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center space-x-2 rider-label-mobile">
            <User className="h-4 w-4" />
            <span>Full Name *</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="rider-input-mobile"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center space-x-2 rider-label-mobile">
            <Phone className="h-4 w-4" />
            <span>Phone Number *</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Enter your phone number"
            value={formData.phone}
            onChange={handleInputChange}
            required
            className="rider-input-mobile"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aadharNumber" className="flex items-center space-x-2 rider-label-mobile">
            <FileText className="h-4 w-4" />
            <span>Aadhar Number *</span>
          </Label>
          <Input
            id="aadharNumber"
            name="aadharNumber"
            type="text"
            placeholder="Enter your 12-digit Aadhar number"
            value={formData.aadharNumber}
            onChange={handleInputChange}
            maxLength={12}
            required
            className="rider-input-mobile"
          />
        </div>

        {/* Aadhar Upload */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-2 rider-label-mobile">
            <Upload className="h-4 w-4" />
            <span>Upload Aadhar Card *</span>
          </Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 rider-touch-target">
            <input
              type="file"
              accept="image/*"
              onChange={handleAadharUpload}
              className="hidden"
              id="aadhar-upload"
            />
            <label htmlFor="aadhar-upload" className="cursor-pointer block text-center rider-touch-target">
              {aadharImage ? (
                <div className="text-green-600">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="rider-text-body-mobile">{aadharImage.name}</p>
                </div>
              ) : (
                <div className="text-gray-500">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p className="rider-text-body-mobile">Click to upload Aadhar card image</p>
                  <p className="rider-text-small-mobile">Max size: 5MB</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Selfie Capture */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-2 rider-label-mobile">
            <Camera className="h-4 w-4" />
            <span>Capture Live Selfie or Upload Photo *</span>
          </Label>

          {!isCameraOpen && !selfieImage && (
            <div className="space-y-2">
              <Button
                type="button"
                onClick={startCamera}
                variant="outline"
                className="rider-action-button-mobile rider-outline-action-mobile"
              >
                <Camera className="h-4 w-4 mr-2" />
                Open Camera
              </Button>

              <div className="text-center text-gray-500 text-sm">or</div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 rider-touch-target">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSelfieUpload}
                  className="hidden"
                  id="selfie-upload"
                />
                <label htmlFor="selfie-upload" className="cursor-pointer block text-center rider-touch-target">
                  <div className="text-gray-500">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="rider-text-body-mobile">Click to upload your photo</p>
                    <p className="rider-text-small-mobile">Max size: 5MB</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {isCameraOpen && (
            <div className="space-y-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
                style={{ maxHeight: '300px' }}
              />
              <div className="flex space-x-2">
                <Button
                  type="button"
                  onClick={captureSelfie}
                  className="rider-action-button-mobile rider-primary-action-mobile flex-1"
                >
                  Capture Selfie
                </Button>
                <Button
                  type="button"
                  onClick={stopCamera}
                  variant="outline"
                  className="rider-action-button-mobile rider-outline-action-mobile"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {selfieImage && (
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-700">
                {selfieImage.name ? 'Photo uploaded successfully!' : 'Selfie captured successfully!'}
              </p>
              <div className="flex space-x-2 mt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setSelfieImage(null);
                    startCamera();
                  }}
                  variant="outline"
                  size="sm"
                >
                  Take with Camera
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setSelfieImage(null);
                    document.getElementById('selfie-upload')?.click();
                  }}
                  variant="outline"
                  size="sm"
                >
                  Upload New Photo
                </Button>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <Button
          type="submit"
          className="rider-action-button-mobile rider-primary-action-mobile"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending OTP...' : 'Send OTP & Continue'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already registered?{' '}
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={onSwitchToLogin}
            >
              Login here
            </Button>
          </p>
        </div>
      </form>
    </div>
  );
}
