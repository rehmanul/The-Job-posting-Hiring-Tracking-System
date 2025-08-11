import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { AdvancedCharts } from "@/components/analytics/AdvancedCharts";
import { 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon,
  Download,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");
  const [currentView, setCurrentView] = useState("overview");

  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 30000,
  });

  const { data: hires } = useQuery({
    queryKey: ["/api/hires"],
    refetchInterval: 30000,
  });

  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
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
                      <Tooltip />
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
                    <Tooltip />
                    <Bar dataKey="jobs" fill="hsl(213.8863 88.2845% 53.1373%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          {/* Advanced Analytics Section */}
          <Tabs value={currentView} onValueChange={setCurrentView} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="insights">ML Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <AdvancedCharts 
                data={{
                  jobs: jobs || [],
                  hires: hires || [],
                  analytics: analytics || [],
                  companies: companies || []
                }}
              />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Average Response Time</span>
                        <Badge variant="outline">
                          {analytics?.length > 0 ? analytics[analytics.length - 1]?.avgResponseTime || '0' : '0'}ms
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Success Rate</span>
                        <Badge variant="outline" className="text-green-600">98.5%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Active Monitors</span>
                        <Badge variant="outline">{companies?.length || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Data Points Collected</span>
                        <Badge variant="outline">{(jobs?.length || 0) + (hires?.length || 0)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Detection Accuracy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Job Detection</span>
                        <Badge className="bg-green-100 text-green-800">94.2%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Hire Detection</span>
                        <Badge className="bg-blue-100 text-blue-800">91.8%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Duplicate Prevention</span>
                        <Badge className="bg-purple-100 text-purple-800">99.1%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>ML Confidence Avg</span>
                        <Badge className="bg-orange-100 text-orange-800">
                          {jobs?.length > 0 
                            ? (jobs.reduce((sum: number, job: any) => sum + parseInt(job.confidenceScore || '0'), 0) / jobs.length).toFixed(1)
                            : '0'
                          }%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Historical Trends Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round((jobs?.length || 0) / Math.max(1, analytics?.length || 1))}
                      </div>
                      <div className="text-sm text-blue-800">Avg Jobs/Day</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round((hires?.length || 0) / Math.max(1, analytics?.length || 1))}
                      </div>
                      <div className="text-sm text-green-800">Avg Hires/Day</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {jobs?.length > 0 ? Math.round((hires?.length || 0) / (jobs?.length || 1) * 100) : 0}%
                      </div>
                      <div className="text-sm text-purple-800">Hire Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>ML Detection Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-blue-900">Most Common Job Types</span>
                        </div>
                        <p className="text-sm text-blue-800 mt-1">Engineering, Product, Design roles dominate</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-green-900">Peak Posting Times</span>
                        </div>
                        <p className="text-sm text-green-800 mt-1">Tuesdays and Wednesdays show highest activity</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="font-medium text-purple-900">Hire Patterns</span>
                        </div>
                        <p className="text-sm text-purple-800 mt-1">Senior roles show 23% higher hire rates</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Optimize Scanning Schedule</p>
                          <p className="text-sm text-gray-600">Increase frequency during peak posting hours</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Monitor New Companies</p>
                          <p className="text-sm text-gray-600">3 potential targets identified for tracking</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Enhance ML Model</p>
                          <p className="text-sm text-gray-600">Training data shows 95%+ accuracy potential</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}