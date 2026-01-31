"use client";

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface ActionLogItem {
  id: string;
  message: string;
  status: 'pending' | 'success' | 'error';
  timestamp: Date;
  link?: string;
  linkText?: string;
  duration?: number; // Duration in milliseconds
  startTime?: number; // Start time in milliseconds (timestamp)
}

interface ActionLogProps {
  items: ActionLogItem[];
  /** Заголовок блока (по умолчанию "Bridge Actions") */
  title?: string;
}

// Format duration in ms as "Xs" or "Xm Ys"
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function ActionLog({ items, title = "Bridge Actions" }: ActionLogProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 mt-4">
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
            >
              <div className="flex-shrink-0 mt-0.5">
                {item.status === 'pending' && (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {item.status === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {item.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.message}</p>
                    {item.link && (
                      <Link
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                      >
                        {item.linkText || 'View on Explorer'}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {item.duration !== undefined && (
                    <div className="flex-shrink-0 text-right text-xs text-muted-foreground font-mono whitespace-nowrap" title={`${Math.round(item.duration / 1000)}s`}>
                      {formatDuration(item.duration)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

