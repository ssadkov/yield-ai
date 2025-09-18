import PortfolioPage from '@/components/PortfolioPage';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function Dashboard2Page() {
  return (
    <ThemeProvider>
      <div className="container mx-auto py-6">
        <PortfolioPage />
      </div>
    </ThemeProvider>
  );
} 