const number = new Intl.NumberFormat("es-MX");
const percent = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 0 });

export function count(value: number) {
  return number.format(value);
}

let accountCurrency = "MXN";

/** The CX account's currency, for every amount that does not name its own. */
export function setAccountCurrency(currency: string | null | undefined) {
  if (currency) accountCurrency = currency;
}

// Compact money is spelled out here rather than left to ICU's compact notation, whose output depends
// on the runtime's locale data: a small-icu build falls back to English ("$1.3M") and recent CLDR
// prints "$1.0 M" or "$1250.0 M", so the same amount would read differently per machine.
const MONEY_UNITS = [
  { size: 1e12, label: "B" }, // billón: a million millions in Spanish
  { size: 1e6, label: "M" },
];

/** Money in full up to a million ($25,554), compact past it ($1.3 M). CX does not say the currency of a
 *  deal, so it is the account's own. */
export function money(value: number, currency?: string | null) {
  const unit = MONEY_UNITS.find(({ size }) => Math.abs(value) >= size);
  const format = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || accountCurrency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: unit ? 1 : 0,
  });
  // A no-break space keeps the unit on the amount's line.
  return unit ? `${format.format(value / unit.size)}\u00a0${unit.label}` : format.format(value);
}

export function share(value: number | null) {
  return value === null ? "—" : percent.format(value);
}

/** "+29% vs 30 días anteriores", or nothing to compare with. */
export function change(value: number | null) {
  if (value === null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${percent.format(value)}`;
}

/** A wait, said the way people say it: 20 min, 5 h, 3 días, 6 meses. */
export function waited(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 31) return `${Math.round(days)} ${Math.round(days) === 1 ? "día" : "días"}`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "mes" : "meses"}`;
}

export function day(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** A CX user without the users scope: known only by id. */
export function person(id: string | null, name: string | null) {
  if (name) return name;
  if (!id) return "Sin asignar";
  return `Usuario ${id.slice(-4)}`;
}
