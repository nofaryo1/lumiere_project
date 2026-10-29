const slugify = (s) =>
  String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Words that don't make two perfumes different ("Sauvage EDP" == "Sauvage")
const NOISE = /\b(eau de parfum|eau de toilette|edp|edt|parfum|perfume|fragrance|spray|ml)\b/g;

function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/'/g, "")
    .replace(NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKey(brand, name) {
  const b = normalize(brand);
  let n = normalize(name);
  if (b && n.startsWith(b + " ")) n = n.slice(b.length + 1);
  return n;
}

const perfumeKey = (brand, name) => [normalize(brand), nameKey(brand, name)].filter(Boolean).join(" ");

module.exports = { slugify, normalize, nameKey, perfumeKey };
