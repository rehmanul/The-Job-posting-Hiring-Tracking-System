import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon } from "lucide-react";

export default function Analytics() {
  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics"],
    queryParams: { days: 30 }
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    queryParams: { limit: 1000 }
  });

  const { data: hires } = useQuery({
    queryKey: ["/api/hires"],
    queryParams: { limit: 1000 }
  });

  // Process data for charts
  const dailyData = analytics?.slice(-14).map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    jobs: item.jobsFound || 0,
    hires: item.hiresFound || 0,
    scans: item.successfulScans || 0,
  })) || [];

  // Company performance data
  const companyStats = jobs?.reduce((acc: any, job: any) => {
    acc[job.company] = (acc[job.company] || 0) + 1;
    return acc;
  }, {}) || {};

  const companyData = Object.entries(companyStats)
    .map(([company, count]) => ({ company, jobs: count }))
    .sort((a: any, b: any) => b.jobs - a.jobs)
    .slice(0, 8);

  // Source distribution
  const sourceStats = jobs?.reduce((acc: any, job: any) => {
    acc[job.source] = (acc[job.source] || 0) + 1;
    return acc;
  }, {}) || {};

  const sourceData = Object.entries(sourceStats).map(([source, count]) => ({
    source: source === 'linkedin' ? 'LinkedIn' : source === 'website' ? 'Website' : 'Other',
    count
  }));

  const COLORS = ['hsl(213.8863 88.2845% 53.1373%)', 'hsl(147.2 78.5% 41.96%)', 'hsl(261.3 87.1% 52.35%)', 'hsl(42.0290 92.8251% 56.2745%)'];

  // Calculate trends
  const latestAnalytics = analytics?.[analytics.length - 1];
  const previousAnalytics = analytics?.[analytics.length - 2];
  
  const jobsTrend = latestAnalytics && previousAnalytics 
    ? ((latestAnalytics.jobsFound - previousAnalytics.jobsFound) / previousAnalytics.jobsFound * 100).toFixed(1)
    : 0;
  
  const hiresTrend = latestAnalytics && previousAnalytics 
    ? ((latestAnalytics.hiresFound - previousAnalytics.hiresFound) / previousAnalytics.hiresFound * 100).toFixed(1)
    : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <h2 className="text-2xl font-semibold text-gray-900">Analytics</h2>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">7D</Button>
              <Button variant="ghost" size="sm">30D</Button>
              <Button size="sm" className="bg-primary text-white">90D</Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Jobs Found</p>
                    <p className="text-2xl font-semibold mt-1">{jobs?.length || 0}</p>
                    <div className="flex items-center mt-1 text-sm">
                      {parseFloat(jobsTrend) >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-secondary mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-error mr-1" />
                      )}
                      <span className={parseFloat(jobsTrend) >= 0 ? "text-secondary" : "text-error"}>
                        {Math.abs(parseFloat(jobsTrend))}% vs last period
                      </span>
                    </div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total New Hires</p>
                    <p className="text-2xl font-semibold mt-1">{hires?.length || 0}</p>
                    <div className="flex items-center mt-1 text-sm">
                      {parseFloat(hiresTrend) >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-secondary mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-error mr-1" />
                      )}
                      <span className={parseFloat(hiresTrend) >= 0 ? "text-secondary" : "text-error"}>
                        {Math.abs(parseFloat(hiresTrend))}% vs last period
                      </span>
                    </div>
                  </div>
                  <PieChartIcon className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Jobs/Day</p>
                    <p className="text-2xl font-semibold mt-1">
                      {dailyData.length > 0 
                        ? (dailyData.reduce((sum: number, day: any) => sum + day.jobs, 0) / dailyData.length).toFixed(1)
                        : 0
                      }
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Last 14 days</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-secondary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Hires/Day</p>
                    <p className="text-2xl font-semibold mt-1">
                      {dailyData.length > 0 
                        ? (dailyData.reduce((sum: number, day: any) => sum + day.hires, 0) / dailyData.length).toFixed(1)
                        : 0
                      }
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Last 14 days</p>
                  </div>
                  <PieChartIcon className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Legend />
                      <Line type="monotone" dataKey="jobs" stroke="hsl(213.8863 88.2845% 53.1373%)" strokeWidth={2} name="Jobs" />
                      <Line type="monotone" dataKey="hires" stroke="hsl(261.3 87.1% 52.35%)" strokeWidth={2} name="Hires" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Source Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Job Sources Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Company Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Top Companies by Job Postings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                    <XAxis dataKey="company" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Bar dataKey="jobs" fill="hsl(213.8863 88.2845% 53.1373%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
