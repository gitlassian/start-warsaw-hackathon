export function Skeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+4.5rem)]" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-ui bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  );
}
