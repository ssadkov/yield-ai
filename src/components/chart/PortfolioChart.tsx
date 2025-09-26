import React, { useState, useEffect } from 'react';
import { Pie, PieChart, Tooltip, Cell } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Тип данных для сектора: имя и значение в долларах
type SectorDatum = { name: string; value: number }

// Палитра по умолчанию
const defaultColors = [
  "#9eb1ff", "#6f8fff", "#5a7dff", "#4a6ef7", "#3d5ce6",
  "#2f4bd6", "#2a43c0", "#243aa8", "#1f3292", "#1a2a7b",
]

// Фиксированные цвета для протоколов
const protocolColors: Record<string, string> = {
  "Hyperion": "#ce688c",
  "Echelon": "#77fbfd", 
  "Aries": "#000000",
  "Joule": "#f06500",
  "Tapp Exchange": "#a367e7",
  "Meso Finance": "#675bd8",
  "Auro Finance": "#016d4e",
  "Amnis Finance": "#2069fa",
  "Earnium": "#023697",
  "Aave": "#5998bb",
  "Moar Market": "#00ff7c",
}

// Кастомный Tooltip компонент
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-md">
        <p className="font-medium">{`${payload[0].payload.name}: $${payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</p>
      </div>
    )
  }
  return null
}

export function PortfolioChart({ data }: { data: SectorDatum[] }) {
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const allData = (data || []).filter((d) => d && d.value > 0)
  const sum = allData.reduce((acc, d) => acc + d.value, 0)
  
  // Фильтруем по процентам (скрываем менее 1%)
  const chartData = allData.filter((d) => {
    const percent = sum > 0 ? (d.value / sum) * 100 : 0
    return percent >= 1
  })

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

  // Определяем размер чарта в зависимости от экрана
  const chartSize = isDesktop ? 384 : 256;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="w-64 h-64 lg:w-96 lg:h-96 focus:outline-none" style={{ minWidth: '200px', minHeight: '200px' }}>
        <PieChart 
          width={chartSize} 
          height={chartSize}
        >
          <Tooltip content={<CustomTooltip />} />
          <Pie 
            data={chartData} 
            dataKey="value" 
            nameKey="name"
            cx="50%" 
            cy="50%"
            outerRadius="80%"
            stroke="none"
            strokeWidth={0}
            strokeOpacity={0}
            isAnimationActive={ false }
          >
            {chartData.map((item, index) => {
              const color = protocolColors[item.name] || defaultColors[index % defaultColors.length];
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Pie>
        </PieChart>
      </div>
      

      {/* Десктопная версия - вертикальная легенда справа от чарта */}
      <div className="hidden lg:flex flex-col justify-center gap-2 min-w-[200px]">
        {chartData
          .map((item, index) => ({
            ...item,
            originalIndex: index,
            percent: sum > 0 ? (item.value / sum) * 100 : 0
          }))
          .sort((a, b) => b.value - a.value)
          .map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: protocolColors[item.name] || defaultColors[item.originalIndex % defaultColors.length] }}
              />
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {Math.round(item.percent)}%
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
