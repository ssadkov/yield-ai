import React, { useState } from 'react';
import { PieChart, PieChartDatum } from '@/shared/PieChart/PieChart';
import { Legend } from '@/shared/Legend/Legend';
import { formatCurrency } from '@/lib/utils/numberFormat';
import { Skeleton } from '@/components/ui/skeleton';

// Тип данных для сектора: имя и значение в долларах
type SectorDatum = { name: string; value: number }

interface PortfolioChartProps {
  data: SectorDatum[];
  totalValue?: string;
  isLoading?: boolean;
}

export function PortfolioChart({ data, totalValue, isLoading = false }: PortfolioChartProps) {
  const [hoveredItem, setHoveredItem] = useState<PieChartDatum | null>(null);

  const allData = (data || []).filter((d) => d && d.value > 0)
  const sum = allData.reduce((acc, d) => acc + d.value, 0)
  const displayTotalValue =
    typeof totalValue === "string" ? (parseFloat(totalValue) || sum) : sum
  
  // Фильтруем по процентам (скрываем менее 1%)
  const chartData: PieChartDatum[] = allData.filter((d) => {
    const percent = sum > 0 ? (d.value / sum) * 100 : 0
    return percent >= 1
  }).map((d) => ({ name: d.name, value: d.value }))

  // Если есть данные, показываем их (даже если идет загрузка)
  if (chartData.length > 0) {
    const handleSectorHover = (item: PieChartDatum | null) => {
      setHoveredItem(item);
    };

    return (
      <div className="flex flex-col lg:flex-row items-center lg:items-center relative">
        {/* Total on mobile (on desktop it's shown in the chart center) */}
        <div className="flex items-center justify-center my-2 text-2xl font-semibold lg:hidden">
          {formatCurrency(displayTotalValue, 2)}
        </div>

        <div className="order-1 w-64 h-64 lg:w-96 lg:h-96 focus:outline-none">
          <PieChart 
            data={chartData} 
            size={256}
            onSectorHover={handleSectorHover}
            hoveredItem={hoveredItem}
            total={totalValue || sum}
            centerLabel="Total Portfolio"
            formatCenterValue={(value) => formatCurrency(value, 2)}
          />
        </div>

        {/* Одна и та же легенда:
            - на мобильных под графиком (занимает всю ширину)
            - на десктопе справа от PieChart и по центру по вертикали */}
        <Legend
          data={chartData}
          hoveredItem={hoveredItem}
          onItemHover={handleSectorHover}
          total={sum}
          className="order-2 w-full mt-4 lg:mt-0 lg:w-auto"
        />
      </div>
    )
  }

  // Если нет данных и идет загрузка, показываем скелетон
  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center">
          <Skeleton className="h-64 w-64 lg:h-96 lg:w-96 rounded-full" />
        </div>
      </div>
    )
  }

  // Если нет данных и загрузка завершена, показываем сообщение
  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    </div>
  )

}
