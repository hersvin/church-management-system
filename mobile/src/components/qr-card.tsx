import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { shortDate } from "../lib/format";
import { useProfile, useQrCard } from "../lib/queries";
import { colors, space } from "../lib/theme";
import { Card, ErrorNote, Loading, Txt } from "./ui";

/** The member's personal QR card for ushers to scan. Signing out everywhere makes old cards stop working. */
export function QrCardView() {
  const card = useQrCard();
  const profile = useProfile();

  return (
    <>
      <Txt variant="title">
        {profile.data
          ? `${profile.data.firstName} ${profile.data.lastName}`
          : "Your QR card"}
      </Txt>
      <Txt variant="small">
        Show this to an usher to check in. Turn up your screen brightness if it
        does not scan.
      </Txt>

      <Card style={{ marginTop: space.xl, alignItems: "center" }}>
        {card.isPending ? <Loading /> : null}
        {card.error ? <ErrorNote message={card.error.message} /> : null}
        {card.data ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Your member QR code"
            style={styles.qr}
          >
            <SvgXml xml={card.data.svg} width="100%" height="100%" />
          </View>
        ) : null}
        {profile.data ? (
          <Txt variant="data">{profile.data.branch.name}</Txt>
        ) : null}
        {card.data ? (
          <Txt variant="small">
            Valid until {shortDate(card.data.expiresAt)}
          </Txt>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  qr: {
    width: "100%",
    maxWidth: 280,
    aspectRatio: 1,
    backgroundColor: colors.paper,
  },
});
