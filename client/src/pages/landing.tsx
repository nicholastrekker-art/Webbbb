import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Clock, Database, Lock } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" data-testid="logo-icon" />
            <h1 className="text-2xl font-semibold" data-testid="text-title">Browser Automation</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-4xl mx-auto w-full space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-5xl font-semibold tracking-tight" data-testid="text-heading">
                Persistent Browser Automation
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-description">
                Manage browser sessions that run continuously in the background. Perfect for
                trading bots, automation tasks, and persistent web applications.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <Card className="w-full max-w-md">
                <CardContent className="p-8 text-center space-y-4">
                  <h3 className="text-2xl font-semibold" data-testid="text-login-title">
                    Get Started
                  </h3>
                  <p className="text-muted-foreground" data-testid="text-login-description">
                    Log in to manage your browser sessions
                  </p>
                  <Button
                    onClick={handleLogin}
                    className="w-full"
                    size="lg"
                    data-testid="button-login"
                  >
                    Log In
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold" data-testid="text-feature-always-running">Always Running</h3>
                  <p className="text-sm text-muted-foreground">
                    Sessions continue running even when you close the browser
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold" data-testid="text-feature-storage">Persistent Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    Cookies and session data stored securely
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold" data-testid="text-feature-secure">Secure</h3>
                  <p className="text-sm text-muted-foreground">
                    Protected with authentication and secure sessions
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Globe className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold" data-testid="text-feature-any-website">Any Website</h3>
                  <p className="text-sm text-muted-foreground">
                    Access and automate any website just like a real browser
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <footer className="border-t">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            <p data-testid="text-footer">Persistent browser automation system with background session management</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
