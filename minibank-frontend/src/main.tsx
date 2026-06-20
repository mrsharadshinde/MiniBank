import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 1. Import React Query tools
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import App from "./App.tsx";

// 2. Create the Query Engine Instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't spam the API every time the user clicks the browser tab
      retry: 1, // If a request fails, retry exactly 1 time before showing an error
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* wrap ap to give it access to the Cache  */}
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Optional: Adds the tiny floating button in devlopment to view your cache */}
      <ReactQueryDevtools initialIsOpen={false}/>
    </QueryClientProvider>
  </StrictMode>,
);
