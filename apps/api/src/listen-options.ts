export interface ListenOptions {
  port: number;
  host: string;
}

/**
 * Dónde escucha la API. Por defecto solo en loopback (`127.0.0.1`): la API no tiene login, así que no se expone a la
 * red salvo que `API_HOST` lo pida de forma explícita. Vive aparte de `server.ts` porque este arranca el servidor al
 * importarse.
 */
export function listenOptions(env: Record<string, string | undefined>): ListenOptions {
  return {
    port: Number(env.API_PORT || 3001),
    host: env.API_HOST || '127.0.0.1',
  };
}
