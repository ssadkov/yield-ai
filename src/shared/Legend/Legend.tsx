"use client";

import React from 'react';
import { PieChartDatum } from '@/shared/PieChart/PieChart';
import { cn } from '@/lib/utils';
import styles from './Legend.module.css';

export interface LegendItem extends PieChartDatum {
  percent?: number;
}

export interface LegendProps {
  /** Данные для отображения в легенде */
  data: LegendItem[];
  /** Активный (hovered) элемент */
  hoveredItem?: PieChartDatum | null;
  /** Callback при наведении на элемент */
  onItemHover?: (item: PieChartDatum | null) => void;
  /** Цвета из темы */
  themeColors: Record<string, string>;
  /** Маппинг имен на ключи цветов из палитры */
  colorMap?: Record<string, string>;
  /** Общая сумма для расчета процентов (если не передана, будет вычислена из данных) */
  total?: number;
  /** Сортировать ли элементы по значению (по убыванию) */
  sortByValue?: boolean;
  /** Форматирование процента */
  formatPercent?: (percent: number) => string;
  /** Показывать ли легенду только на десктопе */
  desktopOnly?: boolean;
  /** Дополнительные классы для контейнера */
  className?: string;
}

// Палитра по умолчанию (используем chart цвета)
function getDefaultColors(themeColors: Record<string, string>) {
  return [
    themeColors['chart-1'] || '#9eb1ff',
    themeColors['chart-2'] || '#6f8fff',
    themeColors['chart-3'] || '#5a7dff',
    themeColors['chart-4'] || '#4a6ef7',
    themeColors['chart-5'] || '#3d5ce6',
    themeColors['primary'] || '#2f4bd6',
    themeColors['secondary'] || '#2a43c0',
    themeColors['accent'] || '#243aa8',
    themeColors['warning'] || '#1f3292',
    themeColors['error'] || '#1a2a7b',
  ];
}

export const Legend = React.forwardRef<HTMLDivElement, LegendProps>(
  (
    {
      data,
      hoveredItem,
      onItemHover,
      themeColors,
      colorMap,
      total,
      sortByValue = true,
      formatPercent,
      desktopOnly = false,
      className,
      ...props
    },
    ref
  ) => {
    const defaultColors = getDefaultColors(themeColors);
    const calculatedTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);

    const getColor = (item: LegendItem, index: number): string => {
      // Если цвет указан напрямую в данных - используем его
      if (item.color) {
        return item.color;
      }

      // Если есть colorMap - используем его
      if (colorMap && colorMap[item.name] && themeColors[colorMap[item.name]]) {
        return themeColors[colorMap[item.name]];
      }

      // Иначе используем дефолтную палитру
      return defaultColors[index % defaultColors.length];
    };

    const defaultFormatPercent = (percent: number) => `${Math.round(percent)}%`;

    // Подготовка данных с процентами
    const itemsWithPercent = data.map((item, index) => ({
      ...item,
      originalIndex: index,
      percent: item.percent ?? (calculatedTotal > 0 ? (item.value / calculatedTotal) * 100 : 0),
    }));

    // Сортировка по значению (если включена)
    const sortedItems = sortByValue
      ? [...itemsWithPercent].sort((a, b) => b.value - a.value)
      : itemsWithPercent;

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col justify-center gap-2 min-w-[200px]',
          desktopOnly && 'hidden lg:flex',
          className
        )}
        {...props}
      >
        {sortedItems.map((item) => {
          const isHovered = hoveredItem?.name === item.name;
          const color = getColor(item, item.originalIndex);

          return (
            <div
              key={item.name}
              className={cn(
                styles.legendItem,
                isHovered && styles.legendItemHovered
              )}
              onMouseEnter={() => onItemHover?.(item)}
              onMouseLeave={() => onItemHover?.(null)}
            >
              <div
                className={cn(
                  styles.legendDot,
                  isHovered && styles.legendDotHovered
                )}
                style={{ backgroundColor: color }}
              />
              <span className={styles.legendLabel}>{item.name}</span>
              <span className={styles.legendPercent}>
                {formatPercent ? formatPercent(item.percent) : defaultFormatPercent(item.percent)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
);

Legend.displayName = "Legend";

