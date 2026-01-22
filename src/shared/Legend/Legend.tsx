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

export const Legend = React.forwardRef<HTMLDivElement, LegendProps>(
  (
    {
      data,
      hoveredItem,
      onItemHover,
      total,
      sortByValue = true,
      formatPercent,
      desktopOnly = false,
      className,
      ...props
    },
    ref
  ) => {
    const calculatedTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);

    const getColor = (item: LegendItem, index: number): string => {
      // Если цвет указан напрямую в данных - используем его
      if (item.color) {
        return item.color;
      }

      // Используем палитру CSS переменных по порядку (индекс)
      return COLOR_PALETTE[index % COLOR_PALETTE.length];
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
          // Мобильная версия: компактная сетка в несколько колонок
          'grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs',
          // На десктопе возвращаем вертикальную колонку
          'lg:flex lg:flex-col lg:justify-center lg:gap-2 lg:text-sm lg:min-w-[200px]',
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

