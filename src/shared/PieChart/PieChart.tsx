"use client";

import React, { useState } from 'react';
import { useMediaQuery } from "react-responsive";
import { cn } from "@/lib/utils";
import styles from "./PieChart.module.css";

// Тип данных для сектора
export interface PieChartDatum {
  name: string;
  value: number;
  color?: string; // Опциональный цвет, если не указан - будет использован из палитры
}

export interface PieChartProps {
  /** Данные для отрисовки графика */
  data: PieChartDatum[];
  /** Базовый размер графика в пикселях */
  size: number;
  /** Callback при наведении на сектор (для синхронизации с внешними компонентами) */
  onSectorHover?: (item: PieChartDatum | null) => void;
  /** Активный (hovered) сектор (опционально, для контролируемого режима) */
  hoveredItem?: PieChartDatum | null;
  /** Показывать ли тень при hover */
  showShadowOnHover?: boolean;
  /** Показывать ли анимацию увеличения при hover */
  enableHoverScale?: boolean;
  /** Общая сумма для отображения в центре и tooltip */
  total?: number | string;
  /** Лейбл для центрального текста */
  centerLabel?: string;
  /** Форматирование значения в центре */
  formatCenterValue?: (value: number) => string;
  /** Форматирование значения в tooltip */
  formatTooltipValue?: (value: number) => string;
  /** Показывать ли tooltip */
  showTooltip?: boolean;
}

// Константы для размеров и параметров графика
const DEFAULT_DESKTOP_SIZE = 384;
const DEFAULT_MOBILE_SIZE = 256;
const DEFAULT_BREAKPOINT = 1024;
const DEFAULT_INNER_RADIUS = 0.2;
const DEFAULT_OUTER_RADIUS = 0.4;
const DEFAULT_GAP_ANGLE = 1.5;

// Палитра CSS переменных для цветов (используем напрямую через var())
const COLOR_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
];

// Встроенный Tooltip компонент
function DefaultTooltip({
  item,
  total,
  itemIndex,
  formatValue,
}: {
  item: PieChartDatum | null;
  total: number;
  itemIndex: number;
  formatValue?: (value: number) => string;
}) {
  if (!item) return null;

  const percentage = total > 0 ? (item.value / total) * 100 : 0;
  const safeIndex = itemIndex >= 0 ? itemIndex : 0;
  const color = item.color || COLOR_PALETTE[safeIndex % COLOR_PALETTE.length];

  const defaultFormatValue = (value: number) =>
    `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl pointer-events-none z-50 min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        />
        <p className="font-semibold text-sm">{item.name}</p>
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">
          {formatValue ? formatValue(item.value) : defaultFormatValue(item.value)}
        </p>
        <p className="text-xs text-muted-foreground">
          {percentage.toFixed(1)}% of portfolio
        </p>
      </div>
    </div>
  );
}

// Функция для создания SVG path для сектора donut chart с gap
function createDonutSector(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
  centerX: number,
  centerY: number,
  gapAngle: number = 0
): string {
  // Учитываем gap между секторами
  const adjustedStartAngle = startAngle + gapAngle / 2;
  const adjustedEndAngle = endAngle - gapAngle / 2;

  const startAngleRad = (adjustedStartAngle * Math.PI) / 180;
  const endAngleRad = (adjustedEndAngle * Math.PI) / 180;

  const x1 = centerX + innerRadius * Math.cos(startAngleRad);
  const y1 = centerY + innerRadius * Math.sin(startAngleRad);
  const x2 = centerX + innerRadius * Math.cos(endAngleRad);
  const y2 = centerY + innerRadius * Math.sin(endAngleRad);
  const x3 = centerX + outerRadius * Math.cos(endAngleRad);
  const y3 = centerY + outerRadius * Math.sin(endAngleRad);
  const x4 = centerX + outerRadius * Math.cos(startAngleRad);
  const y4 = centerY + outerRadius * Math.sin(startAngleRad);

  const largeArc = adjustedEndAngle - adjustedStartAngle > 180 ? 1 : 0;

  // Если innerRadius = 0, это обычный pie chart
  if (innerRadius === 0) {
    return [
      `M ${centerX} ${centerY}`,
      `L ${x4} ${y4}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${x1} ${y1}`,
    `L ${x4} ${y4}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}`,
    `L ${x2} ${y2}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`,
    'Z'
  ].join(' ');
}

export const PieChart = React.forwardRef<HTMLDivElement, PieChartProps>(
  (
    {
      data,
      size,
      onSectorHover,
      hoveredItem,
      showShadowOnHover = true,
      enableHoverScale = true,
      total: providedTotal,
      centerLabel,
      formatCenterValue,
      formatTooltipValue,
      showTooltip = true,
      ...props
    },
    ref
  ) => {
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [internalHoveredItem, setInternalHoveredItem] = useState<PieChartDatum | null>(null);

    // Используем переданный hoveredItem или внутреннее состояние
    const currentHoveredItem = hoveredItem !== undefined ? hoveredItem : internalHoveredItem;

    const handleSectorHover = (item: PieChartDatum | null) => {
      if (hoveredItem === undefined) {
        setInternalHoveredItem(item);
      }
      onSectorHover?.(item);
    };
    // Определяем, десктоп это или мобильный
    const isDesktop = useMediaQuery({ minWidth: DEFAULT_BREAKPOINT });
    const chartSize = isDesktop ? DEFAULT_DESKTOP_SIZE : DEFAULT_MOBILE_SIZE;

    const center = chartSize / 2;
    const outerRadiusPx = chartSize * DEFAULT_OUTER_RADIUS;
    const innerRadiusPx = chartSize * DEFAULT_INNER_RADIUS;

    const calculatedTotal = data.reduce((sum, d) => sum + d.value, 0);
    // Преобразуем total в число, если передана строка
    const total = providedTotal !== undefined
      ? (typeof providedTotal === 'string' ? parseFloat(providedTotal) || calculatedTotal : providedTotal)
      : calculatedTotal;
    let currentAngle = -90; // Начинаем сверху

    const getColor = (item: PieChartDatum, index: number): string => {
      // Если цвет указан напрямую в данных - используем его
      if (item.color) {
        return item.color;
      }

      // Используем палитру CSS переменных по порядку (индекс)
      return COLOR_PALETTE[index % COLOR_PALETTE.length];
    };

    const defaultFormatValue = (value: number) =>
      `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    return (
      <div
        ref={ref}
        className="relative flex items-center justify-center"
        style={{ width: chartSize, height: chartSize, minWidth: chartSize, minHeight: chartSize }}
        onMouseMove={(e) => {
          if (currentHoveredItem && showTooltip) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPosition({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }
        }}
        {...props}
      >
        <svg
          width={chartSize}
          height={chartSize}
          viewBox={`0 0 ${chartSize} ${chartSize}`}
          className="overflow-visible"
        >
        <defs>
          {/* Фильтр для тени */}
          {showShadowOnHover && (
            <filter id="pie-chart-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>
        {data.map((item, index) => {
          if (item.value <= 0 || total === 0) return null;

          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;

          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;

          const color = getColor(item, index);
          const isHovered = currentHoveredItem?.name === item.name;

          // Увеличение при hover
          const scale = enableHoverScale && isHovered ? 1.05 : 1;
          const hoverRadius = enableHoverScale && isHovered ? outerRadiusPx * 1.05 : outerRadiusPx;
          const hoverInnerRadius = enableHoverScale && isHovered ? innerRadiusPx * 1.05 : innerRadiusPx;

          return (
            <g
              key={`sector-${index}`}
              transform={`translate(${center}, ${center}) scale(${scale}) translate(${-center}, ${-center})`}
            >
              <path
                d={createDonutSector(
                  startAngle,
                  endAngle,
                  hoverInnerRadius,
                  hoverRadius,
                  center,
                  center,
                  DEFAULT_GAP_ANGLE
                )}
                fill={color}
                stroke="none"
                filter={showShadowOnHover && isHovered ? "url(#pie-chart-shadow)" : undefined}
                onMouseEnter={() => handleSectorHover(item)}
                onMouseLeave={() => handleSectorHover(null)}
                className={cn(
                  styles.sector,
                  currentHoveredItem && !isHovered && styles.sectorDimmed
                )}
              />
            </g>
          );
        })}
        </svg>

        {/* Центральный текст с общей суммой (только на десктопе) */}
        {isDesktop && (centerLabel !== undefined || providedTotal !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerLabel && (
              <p className="text-xs text-muted-foreground font-medium mb-1">{centerLabel}</p>
            )}
            <p className="text-2xl lg:text-3xl font-bold">
              {formatCenterValue ? formatCenterValue(total) : defaultFormatValue(total)}
            </p>
          </div>
        )}

        {/* Tooltip */}
        {showTooltip && currentHoveredItem && (
          <div
            className="absolute z-50 transition-opacity duration-200"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-12px',
            }}
          >
            <DefaultTooltip
              item={currentHoveredItem}
              total={total}
              itemIndex={currentHoveredItem ? data.findIndex(d => d.name === currentHoveredItem.name) : 0}
              formatValue={formatTooltipValue}
            />
          </div>
        )}
      </div>
    );
  }
);

PieChart.displayName = "PieChart";


