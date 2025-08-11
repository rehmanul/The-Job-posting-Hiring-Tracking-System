import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, Pause, Play, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "@/components/dashboard/statsCards";
import JobsChart from "@/components/dashboard/jobsChart";
import ActivityFeed from "@/components/dashboard/activityFeed";
import JobsTable from "@/components/dashboard/jobsTable";
import HiresTable from "@/components/dashboard/hiresTable";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000,
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
              <div className="relative">
                <Button variant="ghost" size="sm" className="relative p-2">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    3
                  </span>
                </Button>
              </div>
              
              {/* Control buttons */}
              <div className="flex items-center space-x-2">
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <JobsTable />
            <HiresTable />
          </div>
        </div>
      </main>
    </div>
  );
}
