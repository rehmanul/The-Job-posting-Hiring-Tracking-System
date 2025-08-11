import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Cell,
  ComposedChart,
  Legend,
  ScatterChart,
  Scatter
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Download,
  Calendar,
  Target,
  Users,
  Briefcase,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface AdvancedChartsProps {
  data: {
    jobs: any[];
    hires: any[];
    analytics: any[];
    companies: any[];
  };
}

export function AdvancedCharts({ data }: AdvancedChartsProps) {
  const { jobs, hires, analytics, companies } = data;

  // Process daily trends data
  const dailyTrends = analytics?.slice(-30).map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    jobs: item.jobsFound || 0,
    hires: item.hiresFound || 0,
    companies: item.activeCompanies || 0,
    successRate: parseFloat(item.avgResponseTime) || 0
  })) || [];

  // Company performance analysis
  const companyPerformance = companies?.map((company: any) => {
    const companyJobs = jobs?.filter(job => job.company === company.name) || [];
    const companyHires = hires?.filter(hire => hire.company === company.name) || [];

    return {
      name: company.name,
      jobs: companyJobs.length,
      hires: companyHires.length,
      ratio: companyJobs.length > 0 ? (companyHires.length / companyJobs.length * 100) : 0,
      lastActive: company.lastScanned ? new Date(company.lastScanned).toLocaleDateString() : 'Never'
    };
  }).sort((a: any, b: any) => b.jobs - a.jobs) || [];

  // Source distribution
  const sourceDistribution = jobs?.reduce((acc: any, job: any) => {
    acc[job.source] = (acc[job.source] || 0) + 1;
    return acc;
  }, {}) || {};

  const sourceData = Object.entries(sourceDistribution).map(([source, count]) => ({
    source,
    count,
    percentage: ((count as number) / jobs?.length * 100).toFixed(1)
  }));

  // Department analysis
  const departmentStats = jobs?.reduce((acc: any, job: any) => {
    const dept = job.department || 'Unknown';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {}) || {};

  const departmentData = Object.entries(departmentStats)
    .map(([department, count]) => ({ department, jobs: count }))
    .sort((a: any, b: any) => b.jobs - a.jobs)
    .slice(0, 8);

  // ML Confidence analysis
  const confidenceStats = jobs?.reduce((acc: any, job: any) => {
    const confidence = parseInt(job.confidenceScore || '0');
    const range = confidence >= 90 ? '90-100%' :
                  confidence >= 80 ? '80-89%' :
                  confidence >= 70 ? '70-79%' :
                  confidence >= 60 ? '60-69%' : 'Below 60%';
    acc[range] = (acc[range] || 0) + 1;
    return acc;
  }, {}) || {};

  const confidenceData = Object.entries(confidenceStats).map(([range, count]) => ({
    range,
    count,
    percentage: ((count as number) / jobs?.length * 100).toFixed(1)
  }));

  // Colors for charts
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Daily Performance Trends */}
      <Card className="col-span-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Trends (30 Days)
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="jobs"
                fill="#2563eb"
                fillOpacity={0.3}
                stroke="#2563eb"
                name="Jobs Found"
              />
              <Bar yAxisId="left" dataKey="hires" fill="#10b981" name="New Hires" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="successRate"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Success Rate %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Company Performance Matrix */}
      <Card className="col-span-full md:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={companyPerformance.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jobs" name="Jobs Posted" />
              <YAxis dataKey="hires" name="Hires Made" />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border rounded shadow">
                        <p className="font-medium">{data.name}</p>
                        <p>Jobs: {data.jobs}</p>
                        <p>Hires: {data.hires}</p>
                        <p>Hire Rate: {data.ratio.toFixed(1)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter dataKey="hires" fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Job Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="count"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Departments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="department" type="category" width={80} />
              <Tooltip />
              <Bar dataKey="jobs" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ML Confidence Analysis */}
      <Card className="col-span-full md:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            ML Detection Confidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {confidenceData.map((item, index) => (
              <div key={item.range} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{item.range}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.count} jobs</Badge>
                  <span className="text-sm text-gray-500">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Average Confidence: {
                  jobs?.length > 0 
                    ? (jobs.reduce((sum: number, job: any) => sum + parseInt(job.confidenceScore || '0'), 0) / jobs.length).toFixed(1)
                    : '0'
                }%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Metrics */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Real-time System Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{jobs?.length || 0}</div>
              <div className="text-sm text-green-800">Total Jobs Tracked</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{hires?.length || 0}</div>
              <div className="text-sm text-blue-800">Total Hires Detected</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{companies?.length || 0}</div>
              <div className="text-sm text-purple-800">Companies Monitored</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {analytics?.length > 0 ? analytics[analytics.length - 1]?.avgResponseTime || '0' : '0'}s
              </div>
              <div className="text-sm text-orange-800">Avg Response Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}