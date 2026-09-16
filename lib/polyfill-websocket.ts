/**
 * Polyfill de WebSocket para scripts Node (< v22).
 *
 * @supabase/supabase-js v2.116+ lanza "Node.js detected but native WebSocket
 * not found" al construir el cliente si el runtime no tiene WebSocket global
 * (Node 20 y anteriores). En el navegador existe de forma nativa y en Node 22+
 * también, así que el polyfill solo se aplica si falta.
 *
 * Importar ESTE MÓDULO ANTES de crear cualquier cliente de Supabase:
 *   import "./polyfill-websocket";
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}
