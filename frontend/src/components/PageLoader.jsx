import { Loader2 } from 'lucide-react';

/**
 * Full-page loading spinner used as the Suspense fallback for React.lazy()
 * route-level code splitting. Keep this component tiny — it is NOT code-split
 * itself and is included in the initial bundle.
 */
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );
}
