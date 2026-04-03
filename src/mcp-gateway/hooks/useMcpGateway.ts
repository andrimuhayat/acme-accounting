/**
 * MCP Gateway Hook
 *
 * Custom React hook for MCP Gateway state management.
 * Placeholder - implement when frontend framework is added.
 *
 * @placeholder
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseMcpGatewayOptions {
  /** API base URL */
  baseUrl: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Refresh interval in ms */
  refreshInterval?: number;
}

export interface McpGatewayState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  metrics: {
    requestsPerSecond: number;
    averageResponseTime: number;
    activeConnections: number;
  } | null;
}

export interface McpGatewayActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshMetrics: () => Promise<void>;
  sendMessage: (message: unknown) => Promise<unknown>;
}

/**
 * Custom hook for MCP Gateway integration
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   metrics,
 *   connect,
 *   disconnect,
 *   refreshMetrics
 * } = useMcpGateway({ baseUrl: '/api/mcp-gateway' });
 * ```
 */
export function useMcpGateway(
  options: UseMcpGatewayOptions
): McpGatewayState & McpGatewayActions {
  const {
    baseUrl,
    autoConnect = true,
    refreshInterval = 5000,
  } = options;

  const [state, setState] = useState<McpGatewayState>({
    isConnected: false,
    isLoading: false,
    error: null,
    lastUpdate: null,
    metrics: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Placeholder for WebSocket/HTTP connection
      await new Promise(resolve => setTimeout(resolve, 100));

      setState(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({
      ...prev,
      isConnected: false,
      error: null,
    }));
  }, []);

  const refreshMetrics = useCallback(async () => {
    if (!state.isConnected) return;

    try {
      // Placeholder for metrics fetch
      const response = await fetch(`${baseUrl}/metrics`, {
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setState(prev => ({
        ...prev,
        metrics: data,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          error: error.message,
        }));
      }
    }
  }, [baseUrl, state.isConnected]);

  const sendMessage = useCallback(async (message: unknown): Promise<unknown> => {
    if (!state.isConnected) {
      throw new Error('Not connected to MCP Gateway');
    }

    const response = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }, [baseUrl, state.isConnected]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [autoConnect, connect]);

  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(refreshMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [state.isConnected, refreshInterval, refreshMetrics]);

  return {
    ...state,
    connect,
    disconnect,
    refreshMetrics,
    sendMessage,
  };
}

export default useMcpGateway;
