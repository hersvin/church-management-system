import { DashboardView } from "./view";

// Client-rendered admin screen: opt out of instant-navigation validation.
export const instant = false;

export default function Page() {
  return <DashboardView />;
}
