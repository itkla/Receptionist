'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { format } from 'date-fns';

interface EmailLogData {
  htmlContent: string;
  subject: string;
  sentAt: string; 
}

export default function ViewEmailPage() {
  const params = useParams();
  const logId = params?.logId as string | undefined;

  const [emailData, setEmailData] = useState<EmailLogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logId) {
      setError("Email log ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchEmail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/emails/view/${logId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error fetching email: ${response.statusText}`);
        }
        const data: EmailLogData = await response.json();
        setEmailData(data);
      } catch (err: any) {
        console.error("Failed to fetch email content:", err);
        setError(err.message || "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmail();
  }, [logId]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-semibold mb-4">View Email</h1>
      
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <IconLoader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading email content...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 border border-destructive rounded-md p-4">
          <IconAlertCircle className="mr-2 h-6 w-6" />
          <span>Error: {error}</span>
        </div>
      )}

      {emailData && (
        <div className="border rounded-md shadow-sm">
          <div className="p-4 border-b bg-muted/50">
            <p className="text-sm text-muted-foreground">Subject: <strong className="text-foreground">{emailData.subject}</strong></p>
            <p className="text-sm text-muted-foreground">Sent: {format(new Date(emailData.sentAt), 'PPpp')}</p>
          </div>
          {/* Use iframe with srcDoc for safe HTML rendering */}
          <iframe
            srcDoc={emailData.htmlContent}
            title={`Email Preview: ${emailData.subject}`}
            className="w-full h-[70vh] border-0"
            sandbox="allow-same-origin" // Basic sandbox, adjust if emails need more capabilities (but be cautious)
          />
        </div>
      )}
    </div>
  );
} 