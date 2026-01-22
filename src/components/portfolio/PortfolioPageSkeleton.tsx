import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PortfolioPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="w-full">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="container mx-auto">
              <div className="mx-auto">
                <div className="flex items-left">
                  <Skeleton className="h-10 w-64" />
                </div>
              </div>
            </div>

            <div className="min-h-screen to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <div className="flex-1 overflow-y-auto m-4">
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-10 w-40" />
                  </div>
                </div>

                <div className="w-full mb-4 mt-2">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>

                {/* Mobile chart skeleton */}
                <div className="block lg:hidden mb-4">
                  <div className="flex items-center justify-center from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded p-20">
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      {/* Total value skeleton (moved above chart) */}
                      <div className="flex items-center justify-center mb-2">
                        <Skeleton className="h-8 w-48" />
                      </div>
                      <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center">
                        <Skeleton className="h-64 w-64 lg:h-96 lg:w-96 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="mt-4 space-y-4">
                      {/* Checkbox and refresh button skeleton */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-4 rounded" />
                      </div>

                      {/* Portfolio card skeleton */}
                      <Card className="w-full h-full flex flex-col">
                        <CardHeader className="py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-5" />
                              <Skeleton className="h-5 w-20" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-24" />
                              <Skeleton className="h-5 w-5" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pt-0">
                          <div className="space-y-2">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="flex items-center gap-3 py-2">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-1">
                                  <Skeleton className="h-4 w-24" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton className="h-5 w-20" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Protocol cards skeleton */}
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="w-full">
                          <CardHeader className="py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5" />
                                <Skeleton className="h-5 w-32" />
                              </div>
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-5" />
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop chart skeleton */}
        <div className="w-full">
          <div className="hidden lg:block mb-4 mt-17">
            <div className="h-[500px] flex items-center justify-center from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded p-8">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center">
                  <Skeleton className="h-64 w-64 lg:h-96 lg:w-96 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

