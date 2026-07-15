// Deliberately loud — demo/placeholder content has been mistaken for a live
// feed before (a canned example happened to match real news by coincidence).
// This must never be mistakable for "just a small label."
export default function DemoBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{
        borderColor: "#898781",
        color: "#52514e",
        backgroundColor: "#89878126",
      }}
      title="這是示範/佔位資料，不是即時擷取的真實內容"
    >
      <span aria-hidden>🧪</span>
      示範資料・非即時
    </span>
  );
}
