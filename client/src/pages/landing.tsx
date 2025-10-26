import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Lock, Clock, Database } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-semibold">Browser Automation</h1>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl font-semibold tracking-tight">
                Persistent Browser Automation
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Manage browser sessions that run continuously in the background. Perfect for
                trading bots, automation tasks, and persistent web applications.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" className="h-12 px-8" asChild data-testid="button-get-started">
                <a href="/api/login">Get Started</a>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Always Running</h3>
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
                  <h3 className="font-semibold">Saved Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Cookies and user data are automatically saved and restored
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Secure</h3>
                  <p className="text-sm text-muted-foreground">
                    Protected with admin authentication and encrypted storage
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                    <Globe className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Any Website</h3>
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
            <p>Persistent browser automation system with background session management</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
