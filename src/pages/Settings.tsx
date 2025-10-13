import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Building2, User, Bell, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground">
                  Manage your account and application settings
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Templates */}
            <Link to="/invoice-templates">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Invoice Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Customize invoice designs, logos, colors, and layouts
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Reminder Settings */}
            <Link to="/reminders">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Payment Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Configure automatic payment reminder schedules
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Business Profile (Future) */}
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Profile
                  <span className="ml-auto text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage your business information and tax details
                </p>
              </CardContent>
            </Card>

            {/* User Account (Future) */}
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Settings
                  <span className="ml-auto text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Update your profile, password, and preferences
                </p>
              </CardContent>
            </Card>

            {/* Security (Future) */}
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Privacy
                  <span className="ml-auto text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage security settings and data privacy options
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
