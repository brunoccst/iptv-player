import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Black-on-white QR code with the standard quiet zone, drawn as one SVG path (same drawing as the TV app). */
export function QrCode({ text, size }: { text: string; size: number }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const modules = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
    return { path: d, count: modules + 8 };
  }, [text]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      role="img"
      aria-label="QR code"
      data-testid="pairing-qr"
      data-text={text}
    >
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
