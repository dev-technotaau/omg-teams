import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import { authSlice } from "./slices/auth-slice";
import { notificationSlice } from "./slices/notification-slice";

// ──────────────────────────────────────────────
//  Root Reducer
// ──────────────────────────────────────────────

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  notifications: notificationSlice.reducer,
});

// ──────────────────────────────────────────────
//  Persist Config
// ──────────────────────────────────────────────

const persistConfig = {
  key: "omg-teams",
  version: 1,
  storage,
  whitelist: ["auth"], // only persist auth state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// ──────────────────────────────────────────────
//  Store
// ──────────────────────────────────────────────

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches non-serializable actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
