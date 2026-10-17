import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { t } from '@iptv/shared';
import { Spinner } from '../../components/Spinner';
import { connectWithScannedCode } from './pairing';

/** How often a camera frame is searched for a code. */
const SCAN_EVERY_MS = 250;

/**
 * Desktop app: reads another device's sync code with the computer's camera (issue #254), then pairs with it. The camera
 * stops as soon as a code is read or the scanner closes. Back returns to this computer's code; Done after pairing closes.
 */
export function WebcamScanner({ onBack, onClose }: { onBack(): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<'starting' | 'scanning' | 'connecting' | 'done'>('starting');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let active = true;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (camera) => {
        if (!active) return camera.getTracks().forEach((track) => track.stop());
        stream = camera;
        const element = video.current!;
        element.srcObject = camera;
        await element.play().catch(() => undefined);
        setPhase('scanning');
        timer = setInterval(() => {
          const { videoWidth: width, videoHeight: height } = element;
          if (!context || !width || !height) return;
          canvas.width = width;
          canvas.height = height;
          context.drawImage(element, 0, 0, width, height);
          const code = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'dontInvert' });
          if (!code?.data) return;
          stop();
          setPhase('connecting');
          connectWithScannedCode(code.data).then(
            (text) => {
              if (!active) return;
              setMessage(text);
              setPhase('done');
            },
            (e: unknown) => {
              if (!active) return;
              setError(e instanceof Error ? e.message : String(e));
              setPhase('done');
            },
          );
        }, SCAN_EVERY_MS);
      })
      .catch(() => {
        if (!active) return;
        setError(t('The camera could not be opened. Check that the computer has one and that no other app is using it.'));
        setPhase('done');
      });
    return () => {
      active = false;
      stop();
    };
  }, []);

  return (
    <div className="webcam-scan" data-testid="webcam-scan">
      {phase === 'starting' || phase === 'scanning' ? (
        <>
          <p className="muted">
            {t('Scan the QR code on the other device: on its sign-in page, or in its account menu → Sync with another device.')}
          </p>
          <video ref={video} className="webcam-scan__video" muted playsInline aria-label={t('Camera')} />
          {phase === 'starting' ? <Spinner label={t('Opening the camera')} /> : null}
        </>
      ) : phase === 'connecting' ? (
        <Spinner label={t('Connecting…')} />
      ) : message ? (
        <p>{message}</p>
      ) : (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <button type="button" className={message ? 'button button--accent' : 'button button--ghost'} onClick={message ? onClose : onBack}>
        {message ? t('Done') : t('Back')}
      </button>
    </div>
  );
}
