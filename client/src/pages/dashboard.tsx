import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, Pause, Play, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import StatsCards from "@/components/dashboard/statsCards";
import JobsChart from "@/components/dashboard/jobsChart";
import ActivityFeed from "@/components/dashboard/activityFeed";
import JobsTable from "@/components/dashboard/jobsTable";
import HiresTable from "@/components/dashboard/hiresTable";
import LiveConsole from "@/components/dashboard/liveConsole";
import LinkedInAuthButton from "@/components/dashboard/linkedinAuthButton";
import StartTrackingButton from "@/components/dashboard/startTrackingButton";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    refetchInterval: 10000, // 10 seconds
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 10000, // 10 seconds
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/system/status"],
    refetchInterval: 10000,
  });

  const pauseSystemMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/pause"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/status"] });
      toast({
        title: "System Paused",
        description: "Job tracking has been paused successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to pause the system.",
        variant: "destructive",
      });
    },
  });

  const resumeSystemMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/resume"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/status"] });
      toast({
        title: "System Resumed",
        description: "Job tracking has been resumed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resume the system.",
        variant: "destructive",
      });
    },
  });

  const refreshDataMutation = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: "Data Refreshed",
        description: "All data has been refreshed successfully.",
      });
    },
  });

  const isRunning = systemStatus?.isRunning ?? false;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
              <div className="flex items-center text-sm text-gray-500">
                <RefreshCw className="mr-1 h-4 w-4" />
                <span>
                  Last scan: {stats?.lastScanTime 
                    ? new Date(stats.lastScanTime).toLocaleTimeString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative p-2">
                    <Bell className="h-5 w-5 text-gray-600" />
                    {notifications && notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {notifications.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Activities</h4>
                    <ScrollArea className="h-64">
                      {notifications && notifications.length > 0 ? (
                        notifications.slice(0, 10).map((notification: any) => (
                          <div key={notification.id} className="flex items-start space-x-2 p-2 border-b last:border-b-0">
                            <Badge variant={notification.type === 'error' ? 'destructive' : 'default'} className="text-xs">
                              {notification.type}
                            </Badge>
                            <div className="flex-1">
                              <p className="text-sm">{notification.message}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(notification.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 p-2">No recent activities</p>
                      )}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Control buttons */}
              <div className="flex items-center space-x-2">
                <LinkedInAuthButton />
                <StartTrackingButton />
                <Button
                  onClick={() => isRunning ? pauseSystemMutation.mutate() : resumeSystemMutation.mutate()}
                  disabled={pauseSystemMutation.isPending || resumeSystemMutation.isPending}
                  className={`${isRunning ? 'bg-secondary hover:bg-green-600' : 'bg-warning hover:bg-yellow-600'} text-white`}
                >
                  {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {isRunning ? 'Running' : 'Paused'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => refreshDataMutation.mutate()}
                  disabled={refreshDataMutation.isPending}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8">
          {/* Statistics Cards */}
          <div className="mb-8">
            <StatsCards />
          </div>

          {/* Charts and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <JobsChart />
            <ActivityFeed />
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <JobsTable />
            <HiresTable />
          </div>

          {/* Live Console */}
          <div className="mb-8">
            <LiveConsole />
          </div>
        </div>
      </main>
    </div>
  );
}
