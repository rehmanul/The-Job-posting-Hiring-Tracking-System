import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Bell, 
  Search, 
  Settings, 
  Users, 
  Briefcase, 
  TrendingUp,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function MobileDashboard() {
  const [notifications, setNotifications] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState("overview");

  // Enable PWA-like behavior
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  // Real-time data queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 15000, // 15 seconds for mobile
  });

  const { data: recentJobs } = useQuery({
    queryKey: ["/api/jobs"],
    select: (data) => data?.slice(0, 10), // Latest 10 jobs
  });

  const { data: recentHires } = useQuery({
    queryKey: ["/api/hires"],
    select: (data) => data?.slice(0, 10), // Latest 10 hires
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    select: (data) => data?.slice(0, 20), // Latest 20 activities
  });

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifications(permission === 'granted');
      
      if (permission === 'granted') {
        new Notification('Job Tracker Notifications Enabled', {
          body: 'You will now receive real-time job and hire alerts',
          icon: '/icon-192x192.png'
        });
      }
    }
  };

  const quickRefresh = () => {
    refetchStats();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Search className="text-white text-sm" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Job Tracker</h1>
              <p className="text-xs text-gray-500">Mobile Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={quickRefresh}
              className="p-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button
              variant={notifications ? "default" : "outline"}
              size="sm"
              onClick={requestNotificationPermission}
              className="p-2"
            >
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* System Status Banner */}
      {systemStatus && (
        <div className={cn(
          "px-4 py-2 text-sm font-medium text-center",
          systemStatus.isRunning 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        )}>
          <div className="flex items-center justify-center space-x-2">
            {systemStatus.isRunning ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>
              {systemStatus.isRunning ? "System Online" : "System Offline"}
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.companiesTracked || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Jobs Today</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.newJobsToday || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Hires Today</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.newHiresToday || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.successRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Tabs */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              <Activity className="h-4 w-4 mr-1" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-xs">
              <Briefcase className="h-4 w-4 mr-1" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="hires" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              Hires
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {activity && activity.length > 0 ? (
                    <div className="space-y-3">
                      {activity.map((item: any, index: number) => (
                        <div key={index} className="flex items-start space-x-3 p-2 rounded-lg bg-gray-50">
                          <div className="flex-shrink-0">
                            {item.type === 'job_found' && <Briefcase className="h-4 w-4 text-green-600 mt-1" />}
                            {item.type === 'hire_detected' && <Users className="h-4 w-4 text-blue-600 mt-1" />}
                            {item.type === 'system_health' && <Activity className="h-4 w-4 text-orange-600 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.description}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(item.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No recent activity</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Latest Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {recentJobs && recentJobs.length > 0 ? (
                    <div className="space-y-3">
                      {recentJobs.map((job: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 text-sm">{job.jobTitle}</h4>
                            <Badge variant="outline" className="text-xs">
                              {job.source}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{job.company}</p>
                          <div className="flex items-center text-xs text-gray-500 space-x-3">
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {job.location}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {job.postedDate}
                            </span>
                          </div>
                          {job.url && (
                            <Button variant="link" size="sm" className="p-0 mt-2 h-auto" asChild>
                              <a href={job.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Job
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No jobs found yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hires Tab */}
          <TabsContent value="hires" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Latest Hires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {recentHires && recentHires.length > 0 ? (
                    <div className="space-y-3">
                      {recentHires.map((hire: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 text-sm">{hire.personName}</h4>
                            <Badge variant="outline" className="text-xs">
                              {hire.source}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{hire.position}</p>
                          <p className="text-sm text-gray-600 mb-2">{hire.company}</p>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {hire.startDate}
                          </div>
                          {hire.linkedinProfile && (
                            <Button variant="link" size="sm" className="p-0 mt-2 h-auto" asChild>
                              <a href={hire.linkedinProfile} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                LinkedIn
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No hires detected yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Mobile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Push Notifications</span>
                  <Badge variant={notifications ? "default" : "secondary"}>
                    {notifications ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auto Refresh</span>
                  <Badge variant="default">15s</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data Usage</span>
                  <Badge variant="outline">Optimized</Badge>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = '/'}
                >
                  Switch to Desktop
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}