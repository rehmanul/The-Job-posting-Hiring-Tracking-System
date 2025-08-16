import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

export default function JobsChart() {
  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics?days=7"]
  });

  // Transform analytics data for chart
  const chartData = analytics?.slice(-7).map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    jobs: item.jobsFound || 0,
    hires: item.hiresFound || 0,
  })) || [
    { date: 'Jan 1', jobs: 12, hires: 8 },
    { date: 'Jan 2', jobs: 19, hires: 12 },
    { date: 'Jan 3', jobs: 15, hires: 10 },
    { date: 'Jan 4', jobs: 25, hires: 15 },
    { date: 'Jan 5', jobs: 22, hires: 13 },
    { date: 'Jan 6', jobs: 18, hires: 11 },
    { date: 'Jan 7', jobs: 24, hires: 16 },
  ];

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Job Postings Trend
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-gray-700">7D</Button>
            <Button size="sm" className="bg-primary text-white">30D</Button>
            <Button variant="ghost" size="sm" className="text-gray-700">90D</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="jobs"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ fill: '#2563EB', strokeWidth: 2 }}
                name="Job Postings"
              />
              <Line
                type="monotone"
                dataKey="hires"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={{ fill: '#7C3AED', strokeWidth: 2 }}
                name="New Hires"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
