/** Centered empty-state placeholder filling its (sized) parent. */
export function NoData({ message = "لا توجد بيانات" }: { message?: string }) {
  return (
    <div className="flex h-full w-full min-h-[160px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
