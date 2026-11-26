// Templates remount on every navigation, so each admin page replays its top-to-bottom entrance (see .ink-page in globals.css).
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="ink-page flex flex-1 flex-col gap-4">{children}</div>;
}
