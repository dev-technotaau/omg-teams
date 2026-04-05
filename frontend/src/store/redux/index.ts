// ── Store ──
export { store, persistor } from "./store";
export type { RootState, AppDispatch } from "./store";

// ── Typed Hooks ──
export { useAppDispatch, useAppSelector } from "./hooks";

// ── Auth Slice ──
export { setUser, clearUser, updateUser } from "./slices/auth-slice";
export type { AuthUser } from "./slices/auth-slice";

// ── Notification Slice ──
export {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearNotifications,
} from "./slices/notification-slice";
export type { Notification } from "./slices/notification-slice";
