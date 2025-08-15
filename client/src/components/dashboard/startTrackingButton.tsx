import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play } from "lucide-react";

export default function StartTrackingButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startTrackingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/start-tracking"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/status"] });
      toast({
        title: "Tracking Started",
        description: "Job tracking engine has been started successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start tracking engine.",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      onClick={() => startTrackingMutation.mutate()}
      disabled={startTrackingMutation.isPending}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      <Play className="mr-2 h-4 w-4" />
      Start Tracking
    </Button>
  );
}