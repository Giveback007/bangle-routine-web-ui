interface BluetoothFilter {
    namePrefix?: string;
    services?: string[];
}

interface BluetoothOptions {
    filters: BluetoothFilter[];
    optionalServices: string[];
}

interface Endpoint {
    name: string;
    description: string;
    svg: string;
    isSupported: () => boolean | string;
    connect: (connection: Connection, options?: Record<string, unknown>) => Promise<Connection>;
}

interface WriteOptions {
    waitNewline?: boolean;
    noWait?: boolean;
}

interface ConnectOptions {
    serialPort?: any; // Web Serial port object
}

interface EspruinoSendPacketOptions {
    noACK?: boolean;
    timeout?: number;
}

interface EspruinoSendFileOptions {
    fs?: boolean;
    noACK?: boolean;
    chunkSize?: number;
    progress?: (chunkNo: number, chunkCount: number) => void;
    timeout?: number;
}

interface EspruinoReceiveFileOptions {
    fs?: boolean;
    timeout?: number;
    progress?: (bytes: number) => void;
}

interface EspruinoEvalOptions {
    timeout?: number;
    stmFix?: boolean;
}

interface Connection {
    endpoint?: Endpoint;
    isOpen: boolean;
    isOpening: boolean;
    txInProgress: boolean;
    chunkSize: number;
    parsePackets: boolean;
    received: string;

    // Event handlers
    on: (evt: 'open' | 'close' | 'data' | 'line' | 'packet' | 'ack' | 'nak' | 'error', cb: (...args: unknown[]) => void) => void;
    emit: (evt: string, data1?: unknown, data2?: unknown) => void;
    removeListener: (evt: string, callback: (...args: unknown[]) => void) => void;
    removeAllListeners: (evt?: string) => void;

    // Core methods
    write: (data: string, callback?: () => void | Promise<void>) => Promise<void>;
    close: () => void;
    closeLowLevel: () => void;
    writeLowLevel: (data: string) => Promise<void>;
    rxDataHandler: (data: ArrayBuffer) => void;
    openHandler: () => void;
    closeHandler: () => void;
    updateProgress: (chars?: number, charsMax?: number) => void;

    // Espruino-specific methods
    espruinoSendPacket: (pkType: 'RESPONSE' | 'EVAL' | 'EVENT' | 'FILE_SEND' | 'DATA' | 'FILE_RECV', data: string, options?: EspruinoSendPacketOptions) => Promise<void>;
    espruinoSendFile: (filename: string, data: string, options?: EspruinoSendFileOptions) => Promise<void>;
    espruinoReceiveFile: (filename: string, options?: EspruinoReceiveFileOptions) => Promise<string>;
    espruinoEval: (expr: string, options?: EspruinoEvalOptions) => Promise<unknown>;
}

declare const UART: {
    version: string;
    debug: number;
    flowControl: boolean;
    ports: string[];
    baud: number;
    timeoutNormal: number;
    timeoutNewline: number;
    timeoutMax: number;
    increaseMTU: boolean;
    endpoints: Endpoint[];
    optionsSerial: Record<string, unknown>;
    optionsBluetooth: BluetoothOptions;

    // Methods
    connect: (callback: (connection: Connection | null, error?: unknown) => void, options?: ConnectOptions) => Connection | undefined;
    connectAsync: (options?: ConnectOptions) => Promise<Connection>;
    write: (data: string, callback?: ((result: string) => void) | WriteOptions, options?: WriteOptions | boolean) => Promise<string>;
    eval: (expr: string, cb?: (result: unknown, error?: string) => void) => Promise<unknown>;
    setTime: (cb?: () => void) => void;
    isConnected: () => boolean;
    getConnection: () => Connection | undefined;
    getConnectionAsync: () => Promise<Connection>;
    close: () => void;
    modal: (callback: () => void) => void;
    log: (level: number, s: string) => void;
    writeProgress: (charsSent?: number, charsTotal?: number) => void;
    parseRJSON: (str: string) => unknown;
}
