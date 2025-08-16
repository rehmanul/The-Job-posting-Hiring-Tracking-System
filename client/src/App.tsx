
import React from "react";
import { Switch, Route } from "wouter";
import { SidebarProvider } from "@/components/ui/sidebar";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import Dashboard from "@/pages/dashboard";
import Companies from "@/pages/companies";
import Jobs from "@/pages/jobs";
import Hires from "@/pages/hires";
import Analytics from "@/pages/analytics";
import Health from "@/pages/health";
import Settings from "@/pages/settings";
import MobileDashboard from "@/pages/mobile";
import Activity from "@/pages/Activity";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/mobile" component={MobileDashboard} />
      <Route path="/companies" component={Companies} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/hires" component={Hires} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/activity" component={Activity} />
      <Route path="/health" component={Health} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <SidebarProvider>
            <Toaster />
            <Router />
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
