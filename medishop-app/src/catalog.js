// Starter catalog. Replace with your shop's real medicine list,
// or load this from a CSV/Excel bulk-import screen later.
//
// Stock accounting rule:
//  - If looseAllowed is true, `stock` is counted in PIECES (tablets/capsules),
//    and `price` is the price of one full `unit` (e.g. one strip) containing
//    `piecesPerUnit` pieces. This lets the same medicine be sold as a full
//    strip OR as a few loose tablets, with stock staying accurate either way.
//  - If looseAllowed is false, `stock` is counted in `unit`s directly
//    (bottles, tubes, packs, pieces) — these cannot be split.

export const GST_PERCENT = 12;

export const SYMPTOMS = [
  { key: "fever", label: "Fever" },
  { key: "cough", label: "Cough and cold" },
  { key: "loose", label: "Loose motions" },
  { key: "injury", label: "Minor injury" },
];

export const CATEGORY_LABELS = {
  fever: "Fever & Pain",
  cough: "Cough & Cold",
  headache: "Headache",
  acidity: "Acidity / Gas",
  allergy: "Allergy / Itching",
  loose: "Loose motions / Diarrhea",
  constipation: "Constipation",
  bodypain: "Body / Joint pain",
  injury: "Minor injury / Wound care",
  skin: "Skin infection / Rash",
  eye: "Eye care",
  mouth: "Mouth ulcer / Dental",
  vitamin: "Vitamins / Supplements",
  hydration: "Dehydration / Hydration",
  other: "Other",
};

export const DEFAULT_CATALOG = [
  { id: "p500", name: "Paracetamol 500mg", category: "fever", price: 12, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 400, discount: 10, barcode: "890000000001" },
  { id: "p650", name: "Paracetamol 650mg", category: "fever", price: 15, unit: "strip", piecesPerUnit: 15, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000008" },
  { id: "ibu400", name: "Ibuprofen 400mg", category: "fever", price: 18, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 340, discount: 0, barcode: "890000000015" },
  { id: "combi", name: "Combiflam", category: "fever", price: 22, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 200, discount: 0, barcode: "890000000022" },

  { id: "cofsyr", name: "Cough syrup 100ml", category: "cough", price: 65, unit: "bottle", looseAllowed: false, stock: 22, discount: 5, barcode: "890000000029" },
  { id: "ambrox", name: "Ambroxol 30mg", category: "cough", price: 18, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 250, discount: 0, barcode: "890000000036" },
  { id: "vicks", name: "Vicks Vaporub 50ml", category: "cough", price: 90, unit: "tube", looseAllowed: false, stock: 18, discount: 0, barcode: "890000000043" },
  { id: "strep", name: "Strepsils lozenges (pack of 10)", category: "cough", price: 30, unit: "pack", looseAllowed: false, stock: 40, discount: 0, barcode: "890000000050" },

  { id: "sarid", name: "Saridon", category: "headache", price: 20, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 200, discount: 0, barcode: "890000000057" },
  { id: "disp", name: "Disprin", category: "headache", price: 10, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000064" },

  { id: "digene", name: "Digene", category: "acidity", price: 25, unit: "strip", piecesPerUnit: 15, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000071" },
  { id: "eno", name: "Eno sachet (pack of 6)", category: "acidity", price: 40, unit: "pack", looseAllowed: false, stock: 25, discount: 0, barcode: "890000000078" },
  { id: "panto", name: "Pantoprazole 40mg", category: "acidity", price: 30, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 250, discount: 0, barcode: "890000000085" },
  { id: "gelusil", name: "Gelusil syrup 200ml", category: "acidity", price: 60, unit: "bottle", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000092" },

  { id: "cetz", name: "Cetirizine 10mg", category: "allergy", price: 15, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 450, discount: 0, barcode: "890000000099" },
  { id: "levocet", name: "Levocetirizine 5mg", category: "allergy", price: 20, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000106" },
  { id: "calamine", name: "Calamine lotion 100ml", category: "allergy", price: 55, unit: "bottle", looseAllowed: false, stock: 25, discount: 0, barcode: "890000000113" },
  { id: "hydrocort", name: "Hydrocortisone cream 1%", category: "allergy", price: 45, unit: "tube", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000120" },

  { id: "ors", name: "ORS sachet", category: "loose", price: 20, unit: "sachet", looseAllowed: false, stock: 60, discount: 0, barcode: "890000000127" },
  { id: "lopera", name: "Loperamide 2mg", category: "loose", price: 10, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 280, discount: 0, barcode: "890000000134" },
  { id: "zinc", name: "Zinc sulfate 20mg", category: "loose", price: 25, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 200, discount: 0, barcode: "890000000141" },

  { id: "isabgol", name: "Isabgol husk 100g", category: "constipation", price: 85, unit: "pack", looseAllowed: false, stock: 15, discount: 0, barcode: "890000000148" },
  { id: "cremaffin", name: "Cremaffin syrup 200ml", category: "constipation", price: 95, unit: "bottle", looseAllowed: false, stock: 12, discount: 0, barcode: "890000000155" },
  { id: "dulcolax", name: "Dulcolax 5mg", category: "constipation", price: 20, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 150, discount: 0, barcode: "890000000162" },

  { id: "diclogel", name: "Diclofenac gel 30g", category: "bodypain", price: 60, unit: "tube", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000169" },
  { id: "volini", name: "Volini spray 40ml", category: "bodypain", price: 110, unit: "bottle", looseAllowed: false, stock: 14, discount: 0, barcode: "890000000176" },
  { id: "acecpara", name: "Aceclofenac + Paracetamol", category: "bodypain", price: 28, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 200, discount: 0, barcode: "890000000183" },

  { id: "ointm", name: "Antiseptic ointment 20g", category: "injury", price: 45, unit: "tube", looseAllowed: false, stock: 15, discount: 8, barcode: "890000000190" },
  { id: "band", name: "Bandage roll", category: "injury", price: 25, unit: "piece", looseAllowed: false, stock: 40, discount: 0, barcode: "890000000197" },
  { id: "cotton", name: "Cotton roll 100g", category: "injury", price: 35, unit: "pack", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000204" },
  { id: "tape", name: "Adhesive tape", category: "injury", price: 20, unit: "piece", looseAllowed: false, stock: 25, discount: 0, barcode: "890000000211" },
  { id: "bandaid", name: "Band-Aid strips (pack of 10)", category: "injury", price: 30, unit: "pack", looseAllowed: false, stock: 30, discount: 0, barcode: "890000000218" },

  { id: "clotri", name: "Clotrimazole cream 20g", category: "skin", price: 55, unit: "tube", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000225" },
  { id: "candid", name: "Candid dusting powder", category: "skin", price: 70, unit: "bottle", looseAllowed: false, stock: 15, discount: 0, barcode: "890000000232" },
  { id: "boroline", name: "Boroline antiseptic cream 20g", category: "skin", price: 45, unit: "tube", looseAllowed: false, stock: 25, discount: 0, barcode: "890000000239" },

  { id: "eyedrop", name: "Lubricant eye drops 10ml", category: "eye", price: 65, unit: "bottle", looseAllowed: false, stock: 18, discount: 0, barcode: "890000000246" },
  { id: "rosewater", name: "Rose water eye wash 100ml", category: "eye", price: 40, unit: "bottle", looseAllowed: false, stock: 15, discount: 0, barcode: "890000000253" },

  { id: "zytee", name: "Mouth ulcer gel 10g", category: "mouth", price: 55, unit: "tube", looseAllowed: false, stock: 15, discount: 0, barcode: "890000000260" },
  { id: "cloveoil", name: "Clove oil 10ml", category: "mouth", price: 30, unit: "bottle", looseAllowed: false, stock: 15, discount: 0, barcode: "890000000267" },
  { id: "mouthwash", name: "Chlorhexidine mouthwash 100ml", category: "mouth", price: 85, unit: "bottle", looseAllowed: false, stock: 12, discount: 0, barcode: "890000000274" },

  { id: "multivit", name: "Multivitamin tablet", category: "vitamin", price: 45, unit: "strip", piecesPerUnit: 15, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000281" },
  { id: "vitc", name: "Vitamin C 500mg", category: "vitamin", price: 30, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 250, discount: 0, barcode: "890000000288" },
  { id: "calciumd3", name: "Calcium + D3", category: "vitamin", price: 40, unit: "strip", piecesPerUnit: 15, looseAllowed: true, stock: 300, discount: 0, barcode: "890000000295" },
  { id: "ironfolic", name: "Iron folic acid", category: "vitamin", price: 25, unit: "strip", piecesPerUnit: 10, looseAllowed: true, stock: 200, discount: 0, barcode: "890000000302" },

  { id: "electral", name: "Electral powder sachet", category: "hydration", price: 20, unit: "sachet", looseAllowed: false, stock: 40, discount: 0, barcode: "890000000309" },
  { id: "glucond", name: "Glucon-D pack 200g", category: "hydration", price: 85, unit: "pack", looseAllowed: false, stock: 20, discount: 0, barcode: "890000000316" },
];

export function netPrice(item) {
  return Math.round(item.price * (1 - item.discount / 100) * 100) / 100;
}

export function netPiecePrice(item) {
  if (!item.looseAllowed || !item.piecesPerUnit) return netPrice(item);
  const perPiece = netPrice(item) / item.piecesPerUnit;
  return Math.max(1, Math.round(perPiece));
}

export function formatStock(item) {
  if (item.looseAllowed && item.piecesPerUnit) {
    const fullUnits = Math.floor(item.stock / item.piecesPerUnit);
    const loosePieces = item.stock % item.piecesPerUnit;
    if (loosePieces === 0) return `${fullUnits} ${item.unit}${fullUnits === 1 ? "" : "s"}`;
    return `${fullUnits} ${item.unit}${fullUnits === 1 ? "" : "s"} + ${loosePieces} loose`;
  }
  return `${item.stock} ${item.unit}${item.stock === 1 ? "" : "s"}`;
}

export function randomBatch() {
  const letters = "ABCDEFGH";
  const l = letters[Math.floor(Math.random() * letters.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${l}${n}`;
}
