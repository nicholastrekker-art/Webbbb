import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, ArrowLeft, ArrowRight, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BrowserSession } from "@shared/schema";

interface BrowserViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: BrowserSession;
}

export function BrowserViewer({ open, onOpenChange, session }: BrowserViewerProps) {
  const { toast } = useToast();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(session.url);
  const [urlInput, setUrlInput] = useState(session.url);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load screenshot
  const loadScreenshot = async () => {
    if (!open || session.status !== "running") return;

    try {
      const response = await fetch(`/api/sessions/${session.id}/screenshot`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setScreenshot(url);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to load screenshot",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load screenshot:", error);
    }
  };

  // Navigate to URL
  const handleNavigate = async (url?: string) => {
    const targetUrl = url || urlInput;
    if (!targetUrl) return;

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", `/api/sessions/${session.id}/navigate`, {
        url: targetUrl,
      });

      if (response.currentUrl) {
        setCurrentUrl(response.currentUrl);
        setUrlInput(response.currentUrl);
      }

      await loadScreenshot();

      toast({
        title: "Success",
        description: "Navigated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to navigate",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle click on screenshot
  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current || session.status !== "running") return;

    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = (session.viewportWidth || 1920) / rect.width;
    const scaleY = (session.viewportHeight || 1080) / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    try {
      await apiRequest("POST", `/api/sessions/${session.id}/click`, { x, y });

      // Refresh screenshot after a short delay to show the result
      setTimeout(loadScreenshot, 1000);

      toast({
        title: "Clicked",
        description: `Clicked at (${Math.round(x)}, ${Math.round(y)})`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to click",
        variant: "destructive",
      });
    }
  };

  // Set up auto-refresh
  useEffect(() => {
    if (open && session.status === "running") {
      loadScreenshot();

      const interval = setInterval(loadScreenshot, 3000); // Refresh every 3 seconds
      setRefreshInterval(interval);

      return () => {
        clearInterval(interval);
      };
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [open, session.status]);

  // Clean up screenshot URL
  useEffect(() => {
    return () => {
      if (screenshot) {
        URL.revokeObjectURL(screenshot);
      }
    };
  }, [screenshot]);

  // Function to refresh screenshot
  const refreshScreenshot = () => {
    loadScreenshot();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Browser View</DialogTitle>
          <DialogDescription className="font-mono text-xs">{session.url}</DialogDescription>
        </DialogHeader>

        {session.status !== "running" ? (
          <div className="flex-1 flex items-center justify-center p-12 text-center">
            <div>
              <p className="text-lg font-medium mb-2">Session Not Running</p>
              <p className="text-sm text-muted-foreground">
                Start the session to view and interact with the browser
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleNavigate(currentUrl)}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <div className="flex-1 flex items-center gap-2">
                <Label htmlFor="url-input" className="sr-only">
                  URL
                </Label>
                <Input
                  id="url-input"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNavigate();
                    }
                  }}
                  placeholder="Enter URL..."
                  className="h-10 font-mono text-sm"
                  data-testid="input-browser-url"
                />
                <Button
                  onClick={() => handleNavigate()}
                  disabled={isLoading}
                  data-testid="button-navigate"
                >
                  Go
                </Button>
              </div>
            </div>

            {/* Browser Screenshot */}
            <div className="flex-1 overflow-auto border rounded-md bg-muted/30">
              {screenshot ? (
                <img
                  ref={imageRef}
                  src={screenshot}
                  alt="Browser screenshot"
                  className="w-full h-auto cursor-pointer"
                  onClick={handleImageClick}
                  data-testid="browser-screenshot"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-12">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading browser view...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Click anywhere on the screenshot to interact with the browser
            </div>

            {/* Keyboard Input */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Label htmlFor="keyboard-input" className="text-sm font-medium whitespace-nowrap">
                Type:
              </Label>
              <Input
                id="keyboard-input"
                type="text"
                placeholder="Type text to send to browser..."
                className="flex-1"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    const text = e.currentTarget.value;
                    e.currentTarget.value = '';

                    try {
                      await apiRequest("POST", `/api/sessions/${session.id}/type`, { text });
                      setTimeout(loadScreenshot, 500);
                      toast({
                        title: "Text sent",
                        description: `Typed: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`,
                      });
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to send text",
                        variant: "destructive",
                      });
                    }
                  }
                }}
                data-testid="input-keyboard"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await apiRequest("POST", `/api/sessions/${session.id}/type`, { key: "Enter" });
                    setTimeout(loadScreenshot, 500);
                    toast({
                      title: "Key pressed",
                      description: "Sent Enter key",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to send key",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Enter ↵
              </Button>
            </div>

            {/* File Upload */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Label htmlFor="file-upload" className="text-sm font-medium whitespace-nowrap">
                Upload File:
              </Label>
              <Input
                id="file-upload"
                type="file"
                className="flex-1"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('file', file);

                  // Show loading toast
                  const loadingToast = toast({
                    title: "Uploading...",
                    description: `Uploading ${file.name}`,
                  });

                  try {
                    const response = await fetch(`/api/sessions/${session.id}/upload`, {
                      method: 'POST',
                      credentials: 'include',
                      body: formData,
                    });

                    if (!response.ok) {
                      const data = await response.json();
                      throw new Error(data.message || 'Upload failed');
                    }

                    const result = await response.json();

                    toast({
                      title: "File uploaded successfully",
                      description: `${file.name} has been uploaded to the file input on the page`,
                    });

                    // Clear the file input
                    e.target.value = '';

                    // Refresh screenshot after upload to show the result
                    setTimeout(() => {
                      refreshScreenshot();
                    }, 1000);

                  } catch (error: any) {
                    toast({
                      title: "Upload failed",
                      description: error.message || 'Make sure the page has a file upload field',
                      variant: "destructive",
                    });

                    // Clear the file input even on error
                    e.target.value = '';
                  }
                }}
                data-testid="input-file-upload"
              />
              <p className="text-xs text-muted-foreground col-span-2">
                Select a file to upload to any file input field on the current page
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}