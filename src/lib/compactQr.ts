// Deep imports, same as react-qr-code itself (qr.js is its dependency): the
// package's top level only exposes byte-mode encoding.
import QRCodeImpl from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";
import QRMode from "qr.js/lib/mode";

/**
 * QR "alphanumeric" mode packs 2 characters into 11 bits (vs 16 bits for
 * byte mode), but only covers this character set: uppercase letters, digits
 * and a few symbols. An uppercase URL such as HTTPS://HARDYAPP.CO.UK/T/K7M2QX9
 * fits it, which is what keeps dog tag QR codes small enough to engrave.
 */
const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function isAlphanumeric(value: string): boolean {
  for (const ch of value) if (!ALPHANUMERIC_CHARSET.includes(ch)) return false;
  return value.length > 0;
}

/** A qr.js data segment (same shape as its internal QR8bitByte) for alphanumeric mode. */
class QRAlphanumeric {
  mode = QRMode.MODE_ALPHA_NUM;
  constructor(private data: string) {}
  getLength() {
    return this.data.length;
  }
  write(buffer: { put: (num: number, length: number) => void }) {
    const d = this.data;
    let i = 0;
    for (; i + 1 < d.length; i += 2) {
      buffer.put(ALPHANUMERIC_CHARSET.indexOf(d[i]) * 45 + ALPHANUMERIC_CHARSET.indexOf(d[i + 1]), 11);
    }
    if (i < d.length) buffer.put(ALPHANUMERIC_CHARSET.indexOf(d[i]), 6);
  }
}

function encode(value: string, level: "L" | "M"): boolean[][] {
  const qr = new QRCodeImpl(-1, ErrorCorrectLevel[level]);
  if (isAlphanumeric(value)) qr.dataList.push(new QRAlphanumeric(value));
  else qr.addData(value);
  qr.make();
  return qr.modules;
}

/**
 * Encodes `value` into the smallest QR grid it can, preferring error
 * correction level M (survives ~15% damage, e.g. a scratched engraved tag)
 * whenever that does not need a bigger grid than level L would.
 */
export function compactQrModules(value: string): boolean[][] {
  const low = encode(value || " ", "L");
  const medium = encode(value || " ", "M");
  return medium.length <= low.length ? medium : low;
}

/**
 * One SVG path for the dark modules, with each horizontal run merged into a
 * single rectangle. Far fewer shapes than one square per module, which keeps
 * the SVG/PNG clean to import into laser and engraving software.
 */
export function qrModulesToPath(modules: boolean[][]): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });
  return parts.join("");
}
