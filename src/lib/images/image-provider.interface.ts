export interface ImageProvider {
  upload(file: File): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<{ success: boolean; error?: string }>;
  deleteMany(keys: string[]): Promise<{ successful: number; failed: number }>;
}
