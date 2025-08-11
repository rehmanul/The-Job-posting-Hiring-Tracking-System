import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Heart, CheckCircle, AlertCircle, XCircle, RefreshCw, Clock } from "lucide-react";

export default function Health() {
  const { data: healthMetrics, isLoading } = useQuery({
    queryKey: ["/api/health"],
    queryParams: { hours: 24 },
    refetchInterval: 30000,
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/system/status"],
    refetchInterval: 10000,
  });

  // Group metrics by service and get latest status
  const serviceHealth = healthMetrics?.reduce((acc: any, metric: any) => {
    if (!acc[metric.service] || new Date(metric.timestamp) > new Date(acc[metric.service].timestamp)) {
      acc[metric.service] = metric;
    }
    return acc;
  }, {}) || {};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-secondary" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'down': return <XCircle className="h-5 w-5 text-error" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'degraded': return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
      case 'down': return <Badge className="bg-red-100 text-red-800">Down</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getOverallHealth = () => {
    const statuses = Object.values(serviceHealth).map((metric: any) => metric.status);
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.includes('healthy')) return 'healthy';
    return 'unknown';
  };

  const overallHealth = getOverallHealth();

  const services = [
    { key: 'linkedin', name: 'LinkedIn', description: 'Job and hire scraping from LinkedIn' },
    { key: 'google_sheets', name: 'Google Sheets', description: 'Data synchronization with Google Sheets' },
    { key: 'slack', name: 'Slack', description: 'Notification delivery to Slack channels' },
    { key: 'email', name: 'Email', description: 'Email notification service' },
    { key: 'storage', name: 'Storage', description: 'Data storage and retrieval' },
    { key: 'system', name: 'System', description: 'Overall system health and performance' },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-semibold text-gray-900">Health Metrics</h2>
              <div className="flex items-center space-x-2">
                {getStatusIcon(overallHealth)}
                <span className="text-sm text-gray-600">Overall Status</span>
                {getStatusBadge(overallHealth)}
              </div>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {/* Overall System Health */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="mr-2 h-5 w-5 text-red-500" />
                System Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {Object.keys(serviceHealth).length}
                  </div>
                  <div className="text-sm text-gray-600">Services Monitored</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-secondary">
                    {Object.values(serviceHealth).filter((m: any) => m.status === 'healthy').length}
                  </div>
                  <div className="text-sm text-gray-600">Healthy Services</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {systemStatus?.isRunning ? 'Running' : 'Stopped'}
                  </div>
                  <div className="text-sm text-gray-600">System Status</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const health = serviceHealth[service.key];
              const status = health?.status || 'unknown';
              const lastCheck = health?.timestamp ? new Date(health.timestamp) : null;
              const responseTime = health?.responseTime ? parseFloat(health.responseTime) : null;
              
              return (
                <Card key={service.key} className="shadow-sm border border-gray-100">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      {getStatusIcon(status)}
                    </div>
                    <p className="text-sm text-gray-600">{service.description}</p>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      {getStatusBadge(status)}
                    </div>
                    
                    {responseTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Response Time</span>
                        <span className="text-sm font-medium">{responseTime.toFixed(0)}ms</span>
                      </div>
                    )}
                    
                    {lastCheck && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Last Check</span>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="mr-1 h-3 w-3" />
                          {lastCheck.toLocaleTimeString()}
                        </div>
                      </div>
                    )}
                    
                    {health?.errorMessage && (
                      <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-red-700">{health.errorMessage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent Health Events */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recent Health Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {healthMetrics?.slice(0, 10).map((metric: any) => (
                  <div key={metric.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(metric.status)}
                      <div>
                        <span className="font-medium">{metric.service}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {metric.status === 'healthy' ? 'Operating normally' : metric.errorMessage || 'Status changed'}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(metric.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
                
                {(!healthMetrics || healthMetrics.length === 0) && (
                  <div className="text-center py-8">
                    <Heart className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No health metrics</h3>
                    <p className="mt-1 text-sm text-gray-500">Health monitoring will appear here once the system starts collecting data.</p>
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
