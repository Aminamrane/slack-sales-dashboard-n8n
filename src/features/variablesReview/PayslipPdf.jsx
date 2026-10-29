// Relevé du mois en ticket (dev 28/10/2026 : « quelque chose comme ça qu'on peut télécharger, avec un joli SVG, un
// PDF avec les infos du mois qu'on peut envoyer aux sales »). Forme de la référence montrée par le dev : ticket blanc
// arrondi sur fond doux, illustration en tête, encoches et pointillés, bloc de la personne, perforation, code-barres,
// bas dentelé. Couleurs de la charte Owner (marine, vert, bleu clair), police de la page (Inter).
// Contenu : payslipOf (payslip.js), même ticket que la carte. Page à la largeur du ticket, hauteur selon le contenu
// (jamais coupé sur deux pages). Module chargé à la demande : @react-pdf/renderer part dans un chunk séparé.
import { Circle, Document, Font, Page, Path, Rect, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff";
import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff";

Font.register({ family: "Inter", fonts: [
  { src: inter400, fontWeight: 400 }, { src: inter500, fontWeight: 500 },
  { src: inter600, fontWeight: 600 }, { src: inter700, fontWeight: 700 },
] });
Font.registerHyphenationCallback((word) => [word]);   // jamais de coupure de mot

const NAVY = "#121b35", INK = "#1b2236", MUTED = "#6b7487", FAINT = "#9aa2b4", LINE = "#d8e0ec";
const BG = "#eef1f6", SOFT = "#f5f7fb", GREEN = "#3e7d5a", GREEN_SOFT = "#eaf3ee", GREEN_LIGHT = "#8fbf9f";
const SKY = "#a8c5e0", SKY_SOFT = "#e9eef6";
const PAGE_W = 440, TICKET_W = 368, PAD = 26, NOTCH = 22;

const TONES = {
  paid: { bg: GREEN_SOFT, fg: GREEN }, later: { bg: SKY_SOFT, fg: NAVY }, upcoming: { bg: SKY_SOFT, fg: NAVY },
  waiting: { bg: SKY_SOFT, fg: NAVY }, lost: { bg: SOFT, fg: FAINT }, unknown: { bg: SOFT, fg: MUTED },
};

const st = StyleSheet.create({
  page: { backgroundColor: BG, paddingTop: 36, paddingBottom: 44, paddingHorizontal: (PAGE_W - TICKET_W) / 2, fontFamily: "Inter", color: INK },
  ticket: { backgroundColor: "#ffffff", borderRadius: 22, paddingTop: 28, paddingBottom: 30 },
  head: { alignItems: "center", paddingHorizontal: PAD },
  title: { fontSize: 16, fontWeight: 700, marginTop: 10, color: INK },
  subtitle: { fontSize: 9.5, color: MUTED, marginTop: 4 },
  cut: { height: NOTCH, marginTop: 20, marginBottom: 16, justifyContent: "center" },
  cutLine: { marginHorizontal: PAD + 6, borderTopWidth: 1, borderTopColor: LINE, borderStyle: "dashed" },
  notch: { position: "absolute", top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: BG },
  body: { paddingHorizontal: PAD },
  facts: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  label: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, color: FAINT, textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 10.5, fontWeight: 600, color: INK },
  total: { fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: -0.4 },
  person: { flexDirection: "row", alignItems: "center", backgroundColor: SOFT, borderRadius: 12, padding: 11, marginTop: 2 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
  pill: { fontSize: 7.5, fontWeight: 600, paddingVertical: 2.5, paddingHorizontal: 7, borderRadius: 8 },
  section: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, color: FAINT, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 3.5 },
  rowLabel: { flex: 1, fontSize: 9.5, color: INK },
  rowCount: { width: 52, textAlign: "right", fontSize: 8, color: MUTED },
  rowAmount: { width: 82, textAlign: "right", fontSize: 9.5, fontWeight: 600, color: INK },
  sale: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: SKY_SOFT },
  footer: { fontSize: 7, color: FAINT, textAlign: "center", marginTop: 6 },
});

// Cotillon dessiné aux couleurs Owner : cône marine à bandes vertes, ouverture bleu clair, serpentins et confettis.
function Popper() {
  return (
    <Svg width={92} height={76} viewBox="0 0 120 100">
      <Path d="M66 30 L70 13" stroke={SKY} strokeWidth={3} strokeLinecap="round" />
      <Path d="M80 37 L96 22" stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
      <Path d="M87 51 L106 49" stroke={SKY} strokeWidth={3} strokeLinecap="round" />
      <Path d="M57 28 C 50 20, 63 13, 55 4" stroke={GREEN} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path d="M93 66 C 101 59, 107 69, 115 61" stroke={NAVY} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Rect x={78} y={6} width={7} height={7} rx={1.5} fill={GREEN} transform="rotate(20, 81.5, 9.5)" />
      <Rect x={100} y={30} width={6} height={6} rx={1.2} fill={SKY} transform="rotate(-18, 103, 33)" />
      <Rect x={40} y={34} width={6} height={6} rx={1.2} fill={NAVY} transform="rotate(32, 43, 37)" />
      <Circle cx={45} cy={18} r={3} fill={SKY} />
      <Circle cx={108} cy={13} r={2.6} fill={GREEN_LIGHT} />
      <Circle cx={104} cy={80} r={3} fill={GREEN} />
      <Circle cx={88} cy={88} r={2.2} fill={SKY} />
      <Path d="M28 90 L50 42 L76 68 Z" fill={NAVY} />
      <Path d="M35.7 73.2 L39 66 L52 79 L44.8 82.3 Z" fill={GREEN} />
      <Path d="M42.3 58.8 L45.6 51.6 L66.4 72.4 L59.2 75.7 Z" fill={GREEN} />
      <Path d="M50 42 C 58 46, 72 60, 76 68 C 70 66, 54 52, 50 42 Z" fill={SKY} />
    </Svg>
  );
}

// Code-barres décoratif, dessiné à partir de la référence du relevé (il ne se scanne pas).
function Barcode({ text }) {
  const bars = [];
  let x = 0;
  for (const ch of `*${text}*`) {
    const code = ch.charCodeAt(0);
    for (let i = 0; i < 7; i++) {
      const w = (code >> i) & 1 ? 2.2 : 1;
      if (i % 2 === 0) bars.push({ x, w });
      x += w + 1.4;
    }
  }
  return (
    <Svg width={220} height={42} viewBox={`0 0 ${x} 42`} preserveAspectRatio="none">
      {bars.map((b, i) => <Rect key={i} x={b.x} y={0} width={b.w} height={42} fill={INK} />)}
    </Svg>
  );
}

// Encoches et pointillés entre deux parties du ticket.
const Cut = () => (
  <View style={st.cut}>
    <View style={st.cutLine} />
    <View style={[st.notch, { left: -NOTCH / 2 }]} />
    <View style={[st.notch, { right: -NOTCH / 2 }]} />
  </View>
);

function Line({ line }) {
  if (line.kind === "note") return <Text style={{ fontSize: 7.5, color: MUTED, paddingLeft: 10, marginTop: -1, marginBottom: 3 }}>{line.label}</Text>;
  const sub = line.kind === "sub";
  const strong = ["subtotal", "total", "net"].includes(line.kind);
  const rule = strong ? { borderTopWidth: line.kind === "net" ? 1.2 : 0.8, borderTopColor: line.kind === "net" ? INK : LINE,
    borderStyle: line.kind === "net" ? "solid" : "dashed", marginTop: 6, paddingTop: 7 } : {};
  return (
    <View style={[st.row, rule]} wrap={false}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: sub ? 10 : 0 }}>
        <Text style={[st.rowLabel, sub && { fontSize: 8.5, color: MUTED, flexGrow: 0, flexShrink: 1, flexBasis: "auto" }, strong && { fontWeight: 700 }, line.kind === "net" && { fontSize: 11 }]}>
          {line.label}
        </Text>
        {line.pill && <Text style={[st.pill, { backgroundColor: GREEN_SOFT, color: GREEN, marginLeft: 5, fontSize: 6.5 }]}>au palier</Text>}
      </View>
      <Text style={st.rowCount}>{line.count}</Text>
      <Text style={[st.rowAmount, sub && { fontSize: 8.5, color: MUTED }, line.struck && { textDecoration: "line-through", color: FAINT },
        strong && { fontWeight: 700 }, line.kind === "net" && { fontSize: 12, color: NAVY }]}>{line.amount}</Text>
    </View>
  );
}

function Sales({ title, rows }) {
  if (!rows.length) return null;
  return (
    <View>
      <Text style={st.section}>{title}</Text>
      {rows.map((r, i) => {
        const tone = TONES[r.tone] || TONES.unknown;
        return (
          <View key={i} style={st.sale} wrap={false}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: 600, color: r.struck ? FAINT : INK }}>{r.client}</Text>
              {r.meta ? <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 1.5 }}>{r.meta}</Text> : null}
            </View>
            {r.status ? <Text style={[st.pill, { backgroundColor: tone.bg, color: tone.fg, marginRight: 8 }]}>{r.status}</Text> : null}
            <Text style={[st.rowAmount, { width: 66, fontSize: 9 }, r.struck && { textDecoration: "line-through", color: FAINT }]}>{r.amount}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PayslipPdf({ data }) {
  const month = data.title.replace(/^Rémunération /, "");
  const scallops = Array.from({ length: 7 }, (_, i) => 26 + i * 52);
  return (
    <Document title={`${data.title} · ${data.person}`} author="Owner Technology" subject={data.reference}>
      <Page size={{ width: PAGE_W }} style={st.page}>
        <View style={st.ticket}>
          <View style={st.head}>
            <Popper />
            <Text style={st.title}>{data.title}</Text>
            <Text style={st.subtitle}>{data.person} · {data.role}</Text>
          </View>
          <Cut />
          <View style={st.body}>
            <View style={st.facts}>
              <View><Text style={st.label}>Montant du mois</Text><Text style={st.total}>{data.total}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text style={st.label}>Versement</Text><Text style={st.value}>{data.payDay}</Text></View>
            </View>
            <View style={st.facts}>
              <View><Text style={st.label}>Référence</Text><Text style={st.value}>{data.reference}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text style={st.label}>Ventes du mois</Text><Text style={st.value}>{data.monthSales}</Text></View>
            </View>
            <View style={st.person}>
              <View style={st.avatar}><Text style={st.avatarText}>{data.initials}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: 600 }}>{data.person}</Text>
                <Text style={{ fontSize: 8, color: MUTED, marginTop: 1.5 }}>{data.role} · Owner Technology</Text>
              </View>
              {data.tier && <Text style={[st.pill, { backgroundColor: GREEN_SOFT, color: GREEN }]}>{data.tier}</Text>}
            </View>
            <Text style={st.section}>Détail {month}</Text>
            {data.lines.map((line) => <Line key={line.key} line={line} />)}
            <Sales title={`Ventes ${month}`} rows={data.sales} />
            <Sales title="Ventes antérieures payées ce mois" rows={data.before} />
            <Sales title="Part d’équipe" rows={data.team} />
          </View>
          <Cut />
          <View style={{ alignItems: "center", paddingHorizontal: PAD }}>
            <Barcode text={data.reference} />
            <Text style={{ fontSize: 8, letterSpacing: 2.4, color: INK, marginTop: 5 }}>{data.reference}</Text>
            <Text style={[st.footer, { marginTop: 10 }]}>
              {[data.readingDay && `Données CRM lues le ${data.readingDay}`, data.generatedOn && `relevé établi le ${data.generatedOn}`].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {scallops.map((left) => (
            <View key={left} style={{ position: "absolute", bottom: -13, left: left - 13, width: 26, height: 26, borderRadius: 13, backgroundColor: BG }} />
          ))}
        </View>
      </Page>
    </Document>
  );
}

// Point d'entrée (import à la demande) : le relevé en Blob, prêt à télécharger.
export async function generatePayslip(data) {
  return pdf(<PayslipPdf data={data} />).toBlob();
}
