import React, { useState, useEffect } from 'react';
import { PieChart, PieChartDatum } from '@/shared/PieChart/PieChart';
import { Legend } from '@/shared/Legend/Legend';

// Тип данных для сектора: имя и значение в долларах
type SectorDatum = { name: string; value: number }

// Хук для получения цветов из CSS переменных палитры
function useThemeColors() {
  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const getComputedColor = (cssVar: string): string => {
      if (typeof window === 'undefined') return '#000000';
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim();
      return value || '#000000';
    };

    setColors({
      'chart-1': getComputedColor('--chart-1'),
      'chart-2': getComputedColor('--chart-2'),
      'chart-3': getComputedColor('--chart-3'),
      'chart-4': getComputedColor('--chart-4'),
      'chart-5': getComputedColor('--chart-5'),
      'primary': getComputedColor('--primary'),
      'secondary': getComputedColor('--secondary'),
      'accent': getComputedColor('--accent'),
      'warning': getComputedColor('--warning'),
      'error': getComputedColor('--error'),
      'success': getComputedColor('--success'),
    });
  }, []);

  return colors;
}

// Маппинг протоколов на цвета из палитры
const protocolColorMap: Record<string, string> = {
  "Hyperion": "chart-1",
  "Echelon": "chart-2", 
  "Aries": "chart-3",
  "Joule": "chart-4",
  "Tapp Exchange": "chart-5",
  "Meso Finance": "primary",
  "Auro Finance": "chart-1",
  "Amnis Finance": "chart-2",
  "Earnium": "chart-3",
  "Aave": "chart-4",
  "Moar Market": "chart-5",
  "Wallet": "accent",
}


export function PortfolioChart({ data }: { data: SectorDatum[] }) {
  const [hoveredItem, setHoveredItem] = useState<PieChartDatum | null>(null);
  const themeColors = useThemeColors();

  const allData = (data || []).filter((d) => d && d.value > 0)
  const sum = allData.reduce((acc, d) => acc + d.value, 0)
  
  // Фильтруем по процентам (скрываем менее 1%)
  const chartData: PieChartDatum[] = allData.filter((d) => {
    const percent = sum > 0 ? (d.value / sum) * 100 : 0
    return percent >= 1
  }).map((d) => ({ name: d.name, value: d.value }))

  // Если нет данных, не рендерим чарт
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    )
  }

  const handleSectorHover = (item: PieChartDatum | null) => {
    setHoveredItem(item);
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 relative">
      <div className="w-64 h-64 lg:w-96 lg:h-96 focus:outline-none">
        <PieChart 
          data={chartData} 
          size={256}
          desktopSize={384}
          mobileSize={256}
          breakpoint={1024}
          innerRadius={0.2}
          outerRadius={0.4}
          gapAngle={1.5}
          onSectorHover={handleSectorHover}
          hoveredItem={hoveredItem}
          themeColors={themeColors}
          colorMap={protocolColorMap}
          total={sum}
          centerLabel="Total Portfolio"
        />
      </div>

      {/* Десктопная версия - вертикальная легенда справа от чарта */}
      <Legend
        data={chartData}
        hoveredItem={hoveredItem}
        onItemHover={handleSectorHover}
        themeColors={themeColors}
        colorMap={protocolColorMap}
        total={sum}
        desktopOnly
      />
    </div>
  )
}
