
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Terminal, Zap } from "lucide-react";

export default function LiveConsole() {
  const { data: logs } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'success': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Terminal className="h-5 w-5" />
          Live Console
          <Zap className="h-4 w-4 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full">
          <div className="space-y-1 font-mono text-xs">
            {logs && logs.length > 0 ? (
              logs.slice(0, 50).map((log: any, index: number) => (
                <div key={`${log.id}-${index}`} className="flex items-start space-x-2 py-1">
                  <span className="text-gray-400 min-w-0 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant="outline" className="text-xs min-w-0 shrink-0">
                    {log.service || 'system'}
                  </Badge>
                  <span className={`${getLogColor(log.type)} min-w-0 break-all`}>
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Terminal className="mx-auto h-8 w-8 mb-2" />
                <p>No console logs available</p>
                <p className="text-xs mt-1">System logs will appear here in real-time</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
