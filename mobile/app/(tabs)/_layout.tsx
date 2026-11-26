import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../src/components/ui";
import { scanTab } from "../../src/lib/roles";
import { useAccount } from "../../src/lib/queries";
import { colors, fonts } from "../../src/lib/theme";

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ focused }: { focused: boolean }) => (
    <Icon name={icon} color={focused ? colors.ink : colors.ink2} />
  ),
});

export default function TabsLayout() {
  const account = useAccount();
  const scan = scanTab(account.data?.ministries);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink2,
        tabBarStyle: {
          backgroundColor: colors.raised,
          borderTopColor: colors.hairline,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.5,
        },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home")} />
      <Tabs.Screen name="services" options={tab("Services", "clock")} />
      <Tabs.Screen name="scan" options={tab(scan.title, scan.icon)} />
      <Tabs.Screen name="events" options={tab("Events", "calendar")} />
      <Tabs.Screen name="me" options={tab("Me", "user")} />
      {/* Ministries live on the Me tab now (what you serve in); the old list stays reachable by link only. */}
      <Tabs.Screen
        name="ministries"
        options={{ ...tab("Ministries", "heart"), href: null }}
      />
    </Tabs>
  );
}
