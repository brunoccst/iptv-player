import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

/** Black-on-white QR code with the standard quiet zone, drawn as one SVG path. */
export function QrCode({ text, size, testID }: { text: string; size: number; testID?: string }) {
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
    <View testID={testID} accessibilityLabel="QR code" accessibilityRole="image">
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect width={count} height={count} fill="#fff" />
        <Path d={path} fill="#000" />
      </Svg>
    </View>
  );
}
