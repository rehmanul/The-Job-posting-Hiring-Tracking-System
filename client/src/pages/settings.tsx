import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Settings as SettingsIcon, Bell, Database, Link, Mail } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  
  // Mock settings state - in a real app, this would come from the backend
  const [settings, setSettings] = useState({
    // Scheduling
    jobCheckInterval: "15",
    hireCheckInterval: "60",
    analyticsInterval: "30",
    
    // Notifications
    slackEnabled: true,
    emailEnabled: true,
    
    // System
    maxRetries: "3",
    requestTimeout: "30000",
    maxConcurrent: "5",
    
    // Anti-detection
    stealthMode: true,
    minDelay: "2000",
    maxDelay: "8000",
    
    // Environment
    linkedinEmail: "dglink3tr@gmail.com",
    slackChannel: "#job-alerts",
    emailRecipients: "rehman.shoj@gmail.com,matt@boostkit.io",
    googleSheetsId: "1yrPK6x7vCdodnkMWxHyuWI0vv7H-1xVbg7qMmYkNGXY",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Settings Saved",
      description: "Your configuration has been updated successfully.",
    });
    
    setIsSaving(false);
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="h-6 w-6 text-gray-600" />
              <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-blue-600 text-white">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 max-w-4xl">
          <div className="space-y-8">
            {/* Scheduling Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="mr-2 h-5 w-5" />
                  Scheduling Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="jobInterval">Job Check Interval (minutes)</Label>
                    <Input
                      id="jobInterval"
                      type="number"
                      value={settings.jobCheckInterval}
                      onChange={(e) => handleInputChange("jobCheckInterval", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hireInterval">Hire Check Interval (minutes)</Label>
                    <Input
                      id="hireInterval"
                      type="number"
                      value={settings.hireCheckInterval}
                      onChange={(e) => handleInputChange("hireCheckInterval", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="analyticsInterval">Analytics Update Interval (minutes)</Label>
                    <Input
                      id="analyticsInterval"
                      type="number"
                      value={settings.analyticsInterval}
                      onChange={(e) => handleInputChange("analyticsInterval", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="mr-2 h-5 w-5" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Slack Notifications</Label>
                    <p className="text-sm text-gray-600">Send job and hire alerts to Slack</p>
                  </div>
                  <Switch
                    checked={settings.slackEnabled}
                    onCheckedChange={(checked) => handleInputChange("slackEnabled", checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-gray-600">Send job and hire alerts via email</p>
                  </div>
                  <Switch
                    checked={settings.emailEnabled}
                    onCheckedChange={(checked) => handleInputChange("emailEnabled", checked)}
                  />
                </div>

                <div>
                  <Label htmlFor="slackChannel">Slack Channel</Label>
                  <Input
                    id="slackChannel"
                    value={settings.slackChannel}
                    onChange={(e) => handleInputChange("slackChannel", e.target.value)}
                    className="mt-1"
                    placeholder="#job-alerts"
                  />
                </div>

                <div>
                  <Label htmlFor="emailRecipients">Email Recipients</Label>
                  <Textarea
                    id="emailRecipients"
                    value={settings.emailRecipients}
                    onChange={(e) => handleInputChange("emailRecipients", e.target.value)}
                    className="mt-1"
                    placeholder="email1@example.com,email2@example.com"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="maxRetries">Max Retries</Label>
                    <Input
                      id="maxRetries"
                      type="number"
                      value={settings.maxRetries}
                      onChange={(e) => handleInputChange("maxRetries", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="requestTimeout">Request Timeout (ms)</Label>
                    <Input
                      id="requestTimeout"
                      type="number"
                      value={settings.requestTimeout}
                      onChange={(e) => handleInputChange("requestTimeout", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxConcurrent">Max Concurrent Requests</Label>
                    <Input
                      id="maxConcurrent"
                      type="number"
                      value={settings.maxConcurrent}
                      onChange={(e) => handleInputChange("maxConcurrent", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Stealth Mode</Label>
                    <p className="text-sm text-gray-600">Enable anti-detection measures</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.stealthMode}
                      onCheckedChange={(checked) => handleInputChange("stealthMode", checked)}
                    />
                    <Badge variant={settings.stealthMode ? "default" : "secondary"}>
                      {settings.stealthMode ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minDelay">Min Delay Between Requests (ms)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      value={settings.minDelay}
                      onChange={(e) => handleInputChange("minDelay", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxDelay">Max Delay Between Requests (ms)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      value={settings.maxDelay}
                      onChange={(e) => handleInputChange("maxDelay", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integration Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Link className="mr-2 h-5 w-5" />
                  Integration Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="linkedinEmail">LinkedIn Email</Label>
                  <Input
                    id="linkedinEmail"
                    type="email"
                    value={settings.linkedinEmail}
                    onChange={(e) => handleInputChange("linkedinEmail", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="googleSheetsId">Google Sheets ID</Label>
                  <Input
                    id="googleSheetsId"
                    value={settings.googleSheetsId}
                    onChange={(e) => handleInputChange("googleSheetsId", e.target.value)}
                    className="mt-1"
                    placeholder="Google Sheets document ID"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Environment Variables</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Some sensitive settings are configured via environment variables for security:
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <code>LINKEDIN_PASSWORD</code> - LinkedIn account password</li>
                    <li>• <code>SLACK_BOT_TOKEN</code> - Slack bot authentication token</li>
                    <li>• <code>GMAIL_APP_PASSWORD</code> - Gmail app-specific password</li>
                    <li>• <code>GOOGLE_PRIVATE_KEY</code> - Google Sheets service account key</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
