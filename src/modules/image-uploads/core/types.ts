export interface UploadableFile {
  readonly size: number;
  readonly type: string;
  readonly name?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface UploadResult {
  readonly key: string;
  readonly url: string;
}

export interface DeleteResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface DeleteManyResult {
  readonly successful: number;
  readonly failed: number;
}

export interface UploadOptions {
  readonly folder?: string;

  readonly tags?: readonly string[];

  readonly publicId?: string;

  readonly overwrite?: boolean;

  readonly signal?: AbortSignal;
}

export interface ImageProvider {
  upload(file: UploadableFile, options?: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<DeleteResult>;
  deleteMany(keys: string[]): Promise<DeleteManyResult>;
}

export interface Actor {
  readonly id: string;
  readonly role?: string;
}

export interface Logger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export const silentLogger: Logger = {
  warn() {},
  error() {},
};
