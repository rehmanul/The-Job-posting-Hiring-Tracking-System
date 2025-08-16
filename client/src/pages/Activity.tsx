import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Plus, UserPlus, AlertTriangle, Database, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ActivityPage() {
  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getActivityIcon = (type: string, service: string) => {
    if (service === 'job_tracker' && type === 'info') return Plus;
    if (service === 'linkedin_tracker' && type === 'info') return UserPlus;
    if (service === 'hire_tracker' && type === 'info') return UserPlus;
    if (type === 'error') return AlertTriangle;
    if (service === 'google_sheets') return Database;
    return Activity;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-600';
      case 'warn': return 'bg-yellow-100 text-yellow-600';
      case 'info': default: return 'bg-green-100 text-green-600';
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': default: return 'default';
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-semibold text-gray-900">Activity Logs</h2>
              <Badge variant="outline" className="text-sm">
                Live Updates
              </Badge>
            </div>
            
            <Button 
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Activity Content */}
        <div className="p-8">
          <Card className="shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                All System Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-start space-x-3 animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
                      </div>
                    </div>
                  ))
                ) : activities && activities.length > 0 ? (
                  activities.map((activity: any) => {
                    const Icon = getActivityIcon(activity.type, activity.service);
                    const timeAgo = Math.floor((Date.now() - new Date(activity.timestamp).getTime()) / (1000 * 60));
                    
                    return (
                      <div key={activity.id} className="flex items-start space-x-3 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant={getBadgeVariant(activity.type)} className="text-xs">
                              {activity.type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {activity.service}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-900 mb-1">{activity.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleString()} 
                            {timeAgo < 1 ? ' (Just now)' : ` (${timeAgo} minute${timeAgo > 1 ? 's' : ''} ago)`}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No Activity Yet</p>
                    <p className="text-sm text-gray-500">
                      Start tracking to see system activities here
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}