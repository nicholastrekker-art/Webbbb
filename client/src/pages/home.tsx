import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionCard } from "@/components/SessionCard";
import { MetricsCard } from "@/components/MetricsCard";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";
import { CookieViewer } from "@/components/CookieViewer";
import { BrowserViewer } from "@/components/BrowserViewer";
import { Activity, Clock, Cookie as CookieIcon, Globe, Zap } from "lucide-react";
import type { BrowserSession, Cookie, InsertBrowserSessionInput } from "@shared/schema";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedSessionForCookies, setSelectedSessionForCookies] = useState<BrowserSession | null>(
    null
  );
  const [selectedSessionForViewer, setSelectedSessionForViewer] = useState<BrowserSession | null>(
    null
  );

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch sessions with automatic refresh every 5 seconds
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<BrowserSession[]>({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time status updates
  });

  // Fetch cookies for selected session
  const { data: cookies = [] } = useQuery<Cookie[]>({
    queryKey: ["/api/sessions", selectedSessionForCookies?.id, "cookies"],
    enabled: !!selectedSessionForCookies,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: InsertBrowserSessionInput) => {
      return await apiRequest("POST", "/api/sessions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Browser session created successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create session",
        variant: "destructive",
      });
    },
  });

  // Update session status mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/sessions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Session status updated",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update session",
        variant: "destructive",
      });
    },
  });

  const handleCreateSession = (data: InsertBrowserSessionInput) => {
    createSessionMutation.mutate(data);
  };

  const handlePauseSession = (session: BrowserSession) => {
    updateSessionMutation.mutate({ id: session.id, status: "paused" });
  };

  const handleResumeSession = (session: BrowserSession) => {
    updateSessionMutation.mutate({ id: session.id, status: "running" });
  };

  const handleStopSession = (session: BrowserSession) => {
    updateSessionMutation.mutate({ id: session.id, status: "stopped" });
  };

  const handleViewSession = (session: BrowserSession) => {
    setSelectedSessionForViewer(session);
  };
  
  const handleViewCookies = (session: BrowserSession) => {
    setSelectedSessionForCookies(session);
  };

  const handleQuickStart = (url: string) => {
    if (!user) return;
    const sessionData: InsertBrowserSessionInput = {
      userId: user.id,
      url,
      status: "running",
      viewportWidth: 1920,
      viewportHeight: 1080,
    };
    createSessionMutation.mutate(sessionData);
  };

  // Calculate metrics
  const activeSessions = sessions.filter((s) => s.status === "running").length;
  const totalSessions = sessions.length;

  // Calculate total runtime (simplified - would need actual runtime tracking)
  const totalRuntime = "N/A";

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <div className="w-10" />
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto p-8 space-y-8">
              {/* Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricsCard
                  title="Active Sessions"
                  value={activeSessions}
                  icon={Activity}
                  testId="metric-active-sessions"
                />
                <MetricsCard
                  title="Total Sessions"
                  value={totalSessions}
                  icon={Clock}
                  testId="metric-total-sessions"
                />
                <MetricsCard
                  title="Stored Cookies"
                  value={totalRuntime}
                  icon={CookieIcon}
                  testId="metric-stored-cookies"
                />
              </div>

              {/* Header with create button */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Browser Sessions</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your persistent browser automation sessions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleQuickStart("https://google.com")}
                    disabled={createSessionMutation.isPending}
                    data-testid="button-quickstart-google"
                    className="gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Google
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleQuickStart("https://deriv.com")}
                    disabled={createSessionMutation.isPending}
                    data-testid="button-quickstart-deriv"
                    className="gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Deriv
                  </Button>
                  {user && (
                    <CreateSessionDialog
                      userId={user.id}
                      onSubmit={handleCreateSession}
                      isPending={createSessionMutation.isPending}
                    />
                  )}
                </div>
              </div>

              {/* Sessions Grid */}
              {isLoadingSessions ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading sessions...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No active sessions</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Create your first browser session to get started with automation
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Button
                      onClick={() => handleQuickStart("https://google.com")}
                      disabled={createSessionMutation.isPending}
                      data-testid="button-quickstart-google-empty"
                      className="gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Start with Google
                    </Button>
                    <Button
                      onClick={() => handleQuickStart("https://deriv.com")}
                      disabled={createSessionMutation.isPending}
                      data-testid="button-quickstart-deriv-empty"
                      className="gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Start with Deriv
                    </Button>
                  </div>
                  {user && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-2">Or create a custom session:</p>
                      <CreateSessionDialog
                        userId={user.id}
                        onSubmit={handleCreateSession}
                        isPending={createSessionMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="sessions-grid">
                  {sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onView={handleViewSession}
                      onViewCookies={handleViewCookies}
                      onPause={handlePauseSession}
                      onResume={handleResumeSession}
                      onStop={handleStopSession}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Cookie Viewer Modal */}
      {selectedSessionForCookies && (
        <CookieViewer
          open={!!selectedSessionForCookies}
          onOpenChange={(open) => !open && setSelectedSessionForCookies(null)}
          cookies={cookies}
          sessionUrl={selectedSessionForCookies.url}
        />
      )}

      {/* Browser Viewer Modal */}
      {selectedSessionForViewer && (
        <BrowserViewer
          open={!!selectedSessionForViewer}
          onOpenChange={(open) => !open && setSelectedSessionForViewer(null)}
          session={selectedSessionForViewer}
        />
      )}
    </SidebarProvider>
  );
}
