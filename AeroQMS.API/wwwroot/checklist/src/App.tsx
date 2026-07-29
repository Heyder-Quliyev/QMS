import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ChecklistPage } from './components/ChecklistPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.message?.toLowerCase?.().includes('401')) return false;
        if (error?.message?.toLowerCase?.().includes('403')) return false;
        if (error?.message?.toLowerCase?.().includes('404')) return false;
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/checklist">
        <Routes>
          <Route path="/:instanceId" element={<ChecklistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
