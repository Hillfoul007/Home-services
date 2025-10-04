import React from 'react';
import { AlertTriangle, RefreshCw, MapPin, Wifi, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getErrorMessage, isNetworkError } from '@/lib/error-utils';

interface ErrorDisplayProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
  showDetails?: boolean;
}

const getErrorIcon = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  
  if (message.includes('location') || message.includes('position')) {
    return <MapPin className="h-4 w-4" />;
  }
  
  if (isNetworkError(error)) {
    return <Wifi className="h-4 w-4" />;
  }
  
  if (message.includes('permission') || message.includes('denied')) {
    return <Lock className="h-4 w-4" />;
  }
  
  return <AlertTriangle className="h-4 w-4" />;
};

const getErrorSuggestion = (error: unknown): string | null => {
  const message = getErrorMessage(error).toLowerCase();
  
  if (message.includes('location access denied') || message.includes('permission denied')) {
    return 'Please enable location access in your browser settings and reload the page.';
  }
  
  if (message.includes('location') && message.includes('timeout')) {
    return 'Try moving to an area with better signal or closer to a window.';
  }
  
  if (message.includes('location') && message.includes('unavailable')) {
    return 'Make sure GPS is enabled and try again in a few moments.';
  }
  
  if (isNetworkError(error)) {
    return 'Check your internet connection and try again.';
  }
  
  if (message.includes('body stream already read')) {
    return 'A network error occurred. Please try again.';
  }
  
  return null;
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title = 'Error',
  onRetry,
  className = '',
  showDetails = false
}) => {
  const errorMessage = getErrorMessage(error);
  const suggestion = getErrorSuggestion(error);
  const icon = getErrorIcon(error);

  return (
    <Alert variant="destructive" className={className}>
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{errorMessage}</p>
        
        {suggestion && (
          <p className="text-sm text-muted-foreground italic">
            💡 {suggestion}
          </p>
        )}
        
        {showDetails && import.meta.env.DEV && (
          <details className="text-xs text-muted-foreground mt-2">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
              {typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)}
            </pre>
          </details>
        )}
        
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default ErrorDisplay;
