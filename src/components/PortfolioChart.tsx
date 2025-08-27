import React from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts"
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
  const chartData = (data || []).filter((d) => d && d.value > 0)
  const sum = chartData.reduce((acc, d) => acc + d.value, 0)
  return (
   
        <div className="mx-auto aspect-square w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie 
                data={chartData} 
                dataKey="value" 
                nameKey="name"
                cx="50%" 
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name}: ${percent ? Math.round(percent * 100) : 0}%`}
                labelLine={false}
              >
              
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={defaultColors[index % defaultColors.length]} />
                ))}
              
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
     
  )
}
