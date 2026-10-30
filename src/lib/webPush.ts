import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/push-sw.js";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer;
};

const callPrefs = async <T,>(payload: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("notification-prefs", { body: payload });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
};

export interface NotificationState {
  email_enabled: boolean;
  push_enabled: boolean;
  devices: number;
  updated_at: string | null;
}

export const getVapidPublicKey = async () => {
  const data = await callPrefs<{ vapid_public_key: string | null }>({ action: "config" });
  return data.vapid_public_key;
};

export const getPreferences = (email: string, orderCode: string) =>
  callPrefs<NotificationState>({ action: "get", email, order_code: orderCode });

export const savePreferences = (
  email: string,
  orderCode: string,
  values: { email_enabled: boolean; push_enabled: boolean },
) => callPrefs<NotificationState>({ action: "save", email, order_code: orderCode, ...values });

/** Registra o service worker de push e cria a inscrição no navegador. */
export const enablePush = async (email: string, orderCode: string): Promise<NotificationState> => {
  if (!pushSupported()) throw new Error("push_unsupported");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  const vapid = await getVapidPublicKey();
  if (!vapid) throw new Error("vapid_missing");

  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    }));

  return callPrefs<NotificationState>({
    action: "subscribe",
    email,
    order_code: orderCode,
    subscription: subscription.toJSON(),
  });
};

export const disablePush = async (email: string, orderCode: string): Promise<NotificationState> => {
  let endpoint: string | undefined;
  if (pushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => undefined);
    }
  }
  return callPrefs<NotificationState>({ action: "unsubscribe", email, order_code: orderCode, endpoint });
};
