import { useIsFocused } from "expo-router";
import { QrCardView } from "../../src/components/qr-card";
import { UsherScanner } from "../../src/components/usher-scanner";
import { NotLinkedNote, Screen, Txt } from "../../src/components/ui";
import { useAccount, useLinked } from "../../src/lib/queries";
import { scanTab } from "../../src/lib/roles";

/** Ushers get the camera to scan member cards; everyone else gets their own QR card to show the usher. */
export default function Scan() {
  const account = useAccount();
  const focused = useIsFocused();
  const linked = useLinked();

  if (scanTab(account.data?.ministries).mode === "scanner") {
    return (
      <Screen>
        {/* The camera runs only while this tab is on screen. */}
        <UsherScanner active={focused} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="micro">Member card</Txt>
      {linked === false ? <NotLinkedNote /> : <QrCardView />}
    </Screen>
  );
}
