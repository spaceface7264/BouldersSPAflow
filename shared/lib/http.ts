import { API_BASE_URL } from '../constants';
import type { ApiResponse } from '../types';
import { getAccessToken } from './tokens';

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Step 6: Automatically add Authorization header if token exists
    const accessToken = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': 'da-DK', // Step 2: Language default - API3 relies on header, not query params
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token is available and not already provided
    if (accessToken && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const config: RequestInit = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new HttpError(response.status, response.statusText, errorData);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      
      // Network or other errors
      throw new HttpError(0, 'Network Error', { message: (error as Error).message });
    }
  }

  async get<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Default instance
export const http = new HttpClient();

// Helper functions for common operations
export const api = {
  get: <T = any>(endpoint: string) => http.get<T>(endpoint),
  post: <T = any>(endpoint: string, data?: any) => http.post<T>(endpoint, data),
  put: <T = any>(endpoint: string, data?: any) => http.put<T>(endpoint, data),
  delete: <T = any>(endpoint: string) => http.delete<T>(endpoint),
};
