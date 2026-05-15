import { isAxiosError } from 'axios';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    // Restore prototype chain so instanceof checks work after transpilation
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static from(error: unknown): ApiError {
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;
      return new ApiError(
        data?.message ?? 'Terjadi kesalahan.',
        error.response.status,
        data?.errors,
      );
    }
    return new ApiError('Tidak dapat terhubung ke server.', 0);
  }
}

export function getErrorMessage(err: unknown, fallback = 'Terjadi kesalahan.'): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
