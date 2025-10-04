import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function TrainingVideo({ videoUrl }: { videoUrl?: string }) {
  const envUrl = (import.meta as any).env?.VITE_RIDER_TRAINING_VIDEO_URL;
  const src = videoUrl || envUrl || undefined;

  return (
    <Card className="mb-3">
      <CardHeader>
        <CardTitle>Training</CardTitle>
      </CardHeader>
      <CardContent>
        {src ? (
          <div className="w-full aspect-video bg-black">
            <video controls className="w-full h-full">
              <source src={src} />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No training video configured. Please upload via admin panel.</div>
        )}
      </CardContent>
    </Card>
  );
}
