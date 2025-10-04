import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceSearchProps {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

const VoiceSearch: React.FC<VoiceSearchProps> = ({
  onResult,
  onError,
  className = "",
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-IN"; // English (India)

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);

        let errorMessage = "Voice recognition failed";
        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech detected. Please try again.";
            break;
          case "audio-capture":
            errorMessage = "Microphone not available";
            break;
          case "not-allowed":
            errorMessage = "Microphone permission denied";
            break;
          case "network":
            errorMessage = "Network error occurred";
            break;
          default:
            errorMessage = `Voice recognition error: ${event.error}`;
        }

        if (onError) {
          onError(errorMessage);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, onError]);

  const startListening = () => {
    if (!isSupported || !recognitionRef.current || isListening || disabled) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      if (onError) {
        onError("Failed to start voice recognition");
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  if (!isSupported) {
    return null; // Hide component if not supported
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={isListening ? stopListening : startListening}
      disabled={disabled}
      className={`p-2 h-auto ${className} ${
        isListening
          ? "text-red-600 hover:text-red-700 hover:bg-red-50"
          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      }`}
      title={isListening ? "Stop voice search" : "Voice search"}
    >
      {isListening ? (
        <div className="flex items-center gap-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="sr-only">Listening...</span>
        </div>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};

export default VoiceSearch;
