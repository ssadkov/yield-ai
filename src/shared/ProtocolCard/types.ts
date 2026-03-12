/** Статус позиции: пул (Active/Inactive) или одиночная (Supply/Borrow) */
export enum PositionBadge {
  Active = "Active",
  Inactive = "Inactive",
  Supply = "Supply",
  Borrow = "Borrow",
}

/** Общий тип позиции для отображения в карточке протокола (все протоколы маппят свои данные в этот формат) */
export interface ProtocolPosition {
  id?: string;
  /** Подпись: пара токенов (APT/USDC), символ (APT) или название пула */
  label: string;
  /** Стоимость в USD */
  value: number;
  /** URL логотипа первого токена */
  logoUrl?: string;
  /** URL логотипа второго токена (для LP / пула) */
  logoUrl2?: string;
  /** Статус: для пула — Active/Inactive, для одиночной — Supply/Borrow */
  badge?: PositionBadge;
  /** Доп. строка: для одиночной — количество токенов; для пула — опционально */
  subLabel?: string;
  /** Цена за единицу (для одиночной позиции, под лого) */
  price?: number;
  /** APR в процентах (например, 12.5 = 12.5%) */
  apr?: string;
  /** Флаг, что позиция используется как коллатерал (для отображения спец. бейджа) */
  isCollateral?: boolean;
}
