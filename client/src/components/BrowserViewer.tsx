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
import { RefreshCw, ArrowLeft, ArrowRight, Home, Upload } from "lucide-react";
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
  const [currentUrl, setCurrentUrl] = useState(session.url);
  const [urlInput, setUrlInput] = useState(session.url);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine WebSocket URL based on environment
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}?sessionId=${session.id}`;

  useEffect(() => {
    // Only connect if dialog is open, session is running, and we have a valid session ID
    if (!open || session.status !== "running" || !session.id) {
      setIsConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Add a small delay to ensure the session is fully ready
    const connectTimeout = setTimeout(() => {
      const ws = new WebSocket(`${wsUrl}?sessionId=${session.id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'frame' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const img = new Image();
            img.onload = () => {
              canvas.width = session.viewportWidth || 1920;
              canvas.height = session.viewportHeight || 1080;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = `data:image/jpeg;base64,${message.data}`;
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to browser stream",
          variant: "destructive",
        });
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };
    }, 100);

    return () => {
      clearTimeout(connectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [open, session.status, session.id, session.viewportWidth, session.viewportHeight, wsUrl, toast]);

  const handleNavigate = async (url?: string) => {
    const targetUrl = url || urlInput;
    if (!targetUrl) return;

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", `/api/sessions/${session.id}/navigate`, {
        url: targetUrl,
      }) as any;

      if (response?.currentUrl) {
        setCurrentUrl(response.currentUrl);
        setUrlInput(response.currentUrl);
      }

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

  const sendMouseEvent = (eventType: string, x: number, y: number, button: string = 'left') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mouseEvent',
        eventType,
        x,
        y,
        button,
      }));
    }
  };

  const sendKeyEvent = (eventType: string, key: string, text?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'keyEvent',
        eventType,
        key,
        text,
      }));
    }
  };

  const sendScrollEvent = (deltaX: number, deltaY: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'scroll',
        deltaX,
        deltaY,
      }));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isConnected) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = (session.viewportWidth || 1920) / rect.width;
    const scaleY = (session.viewportHeight || 1080) / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    sendMouseEvent('mousePressed', x, y);
    sendMouseEvent('mouseReleased', x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isConnected) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = (session.viewportWidth || 1920) / rect.width;
    const scaleY = (session.viewportHeight || 1080) / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    sendMouseEvent('mouseMoved', x, y);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    sendScrollEvent(e.deltaX, e.deltaY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Backspace') key = 'Backspace';
    else if (key === 'Tab') key = 'Tab';
    else if (key === 'Escape') key = 'Escape';
    else if (key === 'ArrowUp') key = 'ArrowUp';
    else if (key === 'ArrowDown') key = 'ArrowDown';
    else if (key === 'ArrowLeft') key = 'ArrowLeft';
    else if (key === 'ArrowRight') key = 'ArrowRight';

    const text = e.key.length === 1 ? e.key : undefined;
    sendKeyEvent('keyDown', key, text);
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault();

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Backspace') key = 'Backspace';

    sendKeyEvent('keyUp', key);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await apiRequest("POST", `/api/sessions/${session.id}/upload`, formData);

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const handleGoBack = async () => {
    try {
      await apiRequest("POST", `/api/sessions/${session.id}/back`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to go back",
        variant: "destructive",
      });
    }
  };

  const handleGoForward = async () => {
    try {
      await apiRequest("POST", `/api/sessions/${session.id}/forward`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to go forward",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await apiRequest("POST", `/api/sessions/${session.id}/refresh`);
      toast({
        title: "Success",
        description: "Page refreshed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0"
        data-testid="browser-viewer-dialog"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        tabIndex={0}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl font-semibold">Live Browser Session</DialogTitle>
          <DialogDescription>
            Interact with the browser in real-time - click, type, scroll, and navigate
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col px-6 pb-6 gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={handleGoBack}
              disabled={!isConnected}
              data-testid="button-back"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={handleGoForward}
              disabled={!isConnected}
              data-testid="button-forward"
              title="Go Forward"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={handleRefresh}
              disabled={!isConnected}
              data-testid="button-refresh"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => handleNavigate(session.url)}
              disabled={!isConnected}
              data-testid="button-home"
              title="Home"
            >
              <Home className="w-4 h-4" />
            </Button>

            <div className="flex-1 flex items-center gap-2">
              <Input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    handleNavigate();
                  }
                }}
                placeholder="https://example.com"
                className="font-mono text-sm"
                disabled={!isConnected}
                data-testid="input-url"
              />
              <Button
                onClick={() => handleNavigate()}
                disabled={isLoading || !isConnected}
                data-testid="button-navigate"
              >
                Go
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm"
              data-testid="input-file"
            />
            <Button
              onClick={handleFileUpload}
              disabled={!selectedFile || !isConnected}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-upload"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
          </div>

          {!isConnected && (
            <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm">
              {session.status !== "running" 
                ? "Session is not running. Start the session to view the browser."
                : "Connecting to browser stream..."}
            </div>
          )}

          <div 
            ref={containerRef}
            className="flex-1 border rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 relative"
            style={{ minHeight: 0 }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onWheel={handleCanvasWheel}
              className="w-full h-full object-contain cursor-pointer"
              style={{ imageRendering: 'auto' }}
              data-testid="canvas-browser"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {session.status === "running" ? "Connecting..." : "Session Stopped"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Click on the canvas to interact with the browser. 
            Type anywhere to send keyboard input. Use the mouse wheel to scroll.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}