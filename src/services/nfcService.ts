/**
 * NFC Service — Web NFC API integration with mock mode fallback.
 *
 * On Chrome/Edge for Android, the Web NFC API (navigator.nfc / NDEFReader)
 * is available for reading NFC tags. On all other platforms (iOS Safari,
 * desktop browsers, simulators), we fall back to mock/simulate mode.
 *
 * The service normalizes tag UIDs consistently before database lookup.
 */

export type NfcScanResult = {
  uid: string;
  isMock: boolean;
};

export type NfcAvailability = 'unavailable' | 'available' | 'mock-only';

/**
 * Check what NFC support is available on this platform.
 */
export function getNfcAvailability(): NfcAvailability {
  if (typeof window !== 'undefined' && 'NDEFReader' in window) {
    return 'available';
  }
  return 'mock-only';
}

/**
 * Normalize a raw NFC tag UID into a consistent string representation.
 * Converts byte arrays to uppercase hex, trims strings.
 */
export function normalizeUid(raw: string | number[]): string {
  if (Array.isArray(raw)) {
    return raw
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return raw.trim().toUpperCase();
}

/**
 * Generate a mock NFC UID for testing.
 * Uses a predictable format: MOCK-XXXXXX
 */
export function generateMockUid(): string {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
    .toUpperCase();
  return `MOCK-${hex}`;
}

// Track the active scan controller so we can abort it
let activeAbortController: AbortController | null = null;

/**
 * Start a real NFC scan using the Web NFC API.
 * Resolves with the first tag UID read, or rejects on error/cancel.
 * Only call this when getNfcAvailability() returns 'available'.
 */
export async function startRealNfcScan(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NDEFReader = (window as any).NDEFReader;
  if (!NDEFReader) {
    throw new Error('NFC is not supported on this device');
  }

  const reader = new NDEFReader();
  activeAbortController = new AbortController();

  return new Promise<string>((resolve, reject) => {
    let resolved = false;

    const onReading = (event: any) => {
      if (resolved) return;
      resolved = true;

      let rawUid = '';
      // Web NFC may provide serialNumber or tag info
      if (event.serialNumber) {
        rawUid = event.serialNumber;
      } else if (event.message && event.message.records) {
        // Try to extract from records
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const text = new TextDecoder().decode(record.data);
            rawUid = text;
            break;
          }
        }
      }

      const uid = normalizeUid(rawUid);
      cleanup();
      resolve(uid);
    };

    const onError = (evt: Event) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error('NFC scan error: could not read tag'));
    };

    const onAbort = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new NfcScanCancelledError('NFC scan cancelled'));
    };

    function cleanup() {
      reader.removeEventListener('reading', onReading);
      reader.removeEventListener('readingerror', onError);
      if (activeAbortController) {
        activeAbortController.signal.removeEventListener('abort', onAbort);
      }
      activeAbortController = null;
    }

    activeAbortController!.signal.addEventListener('abort', onAbort);

    reader.addEventListener('reading', onReading);
    reader.addEventListener('readingerror', onError);

    reader
      .scan({ signal: activeAbortController!.signal })
      .catch((err: Error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(err);
        }
      });
  });
}

/**
 * Cancel any active NFC scan.
 */
export function cancelNfcScan(): void {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

/**
 * Custom error for cancelled scans.
 */
export class NfcScanCancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NfcScanCancelledError';
  }
}

/**
 * Simulate an NFC scan with a given UID (for mock/testing mode).
 * Adds a small delay to simulate scanning behavior.
 */
export async function simulateNfcScan(uid?: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return normalizeUid(uid ?? generateMockUid());
}
