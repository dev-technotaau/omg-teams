import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// ──────────────────────────────────────────────
//  Auth Slice
//
//  Persisted to localStorage via redux-persist.
//  Stores minimal user info for offline access.
// ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  profilePhotoUrl: string | null;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) {
        Object.assign(state.user, action.payload);
      }
    },
  },
});

export const { setUser, clearUser, updateUser } = authSlice.actions;
