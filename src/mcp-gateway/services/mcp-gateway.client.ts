/**
 * MCP Gateway Client Service
 *
 * HTTP client for MCP Gateway API communication.
 * Framework-agnostic service - can be used with any frontend framework.
 *
 * @placeholder
 */

export interface McpGatewayClientConfig {
  /** Base URL of the MCP Gateway API */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
}

export interface GatewayMetricsResponse {
  requestsPerSecond: number;
  averageResponseTime: number;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
}

export interface GatewayStatusResponse {
  status: 'online' | 'offline' | 'degraded';
  version: string;
  uptime: number;
  lastHealthCheck: string;
}

export interface GatewayMessageRequest {
  type: string;
  payload: unknown;
  correlationId?: string;
}

export interface GatewayMessageResponse {
  success: boolean;
  payload?: unknown;
  error?: string;
  correlationId?: string;
}

/**
 * MCP Gateway Client
 *
 * Provides methods for communicating with the MCP Gateway API.
 * This is a framework-agnostic service that can be used by React hooks,
 * Vue composables, Angular services, or plain JavaScript.
 *
 * @example
 * ```typescript
 * const client = new McpGatewayClient({ baseUrl: '/api/mcp-gateway' });
 *
 * // Get gateway status
 * const status = await client.getStatus();
 *
 * // Get metrics
 * const metrics = await client.getMetrics();
 *
 * // Send a message
 * const response = await client.sendMessage({
 *   type: 'ticket:create',
 *   payload: { companyId: 1, type: 'managementReport' }
 * });
 * ```
 */
export class McpGatewayClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: McpGatewayClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout ?? 10000;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Get the current status of the MCP Gateway
   */
  async getStatus(): Promise<GatewayStatusResponse> {
    const response = await this.request<GatewayStatusResponse>('/status');
    return response;
  }

  /**
   * Get performance metrics from the MCP Gateway
   */
  async getMetrics(): Promise<GatewayMetricsResponse> {
    const response = await request<GatewayMetricsResponse>('/metrics');
    return response;
  }

  /**
   * Send a message to the MCP Gateway and receive a response
   */
  async sendMessage(
    message: GatewayMessageRequest
  ): Promise<GatewayMessageResponse> {
    const response = await this.request<GatewayMessageResponse>('/message', {
      method: 'POST',
      body: JSON.stringify(message),
    });
    return response;
  }

  /**
   * Get the health check status
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    await this.request('/health');
    const latency = Date.now() - start;
    return { healthy: true, latency };
  }

  /**
   * Internal request helper
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MCP Gateway error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`MCP Gateway request timeout after ${this.timeout}ms`);
        }
        throw error;
      }
      throw new Error('Unknown MCP Gateway error');
    }
  }
}

/**
 * Factory function to create a pre-configured MCP Gateway client
 */
export function createMcpGatewayClient(
  baseUrl: string,
  options?: Partial<Omit<McpGatewayClientConfig, 'baseUrl'>>
): McpGatewayClient {
  return new McpGatewayClient({ baseUrl, ...options });
}

export default McpGatewayClient;
