import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "sonner";
import Chat from "@/pages/Chat";
import Metrics from "@/pages/Metrics";
import Moves from "@/pages/Moves";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Chat} />
      <Route path="/moves" component={Moves} />
      <Route path="/metrics" component={Metrics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="h-screen gradient-bg">
          <Router />
        </div>
        <Toaster />
        <SonnerToaster 
          position="top-right" 
          toastOptions={{
            className: "glass rounded-2xl border-white/10",
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
