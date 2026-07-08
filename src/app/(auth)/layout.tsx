/** Centered layout for the sign-in / sign-up pages. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          S
        </div>
        <span className="text-lg font-semibold">Sprintboard</span>
      </div>
      {children}
    </div>
  );
}
