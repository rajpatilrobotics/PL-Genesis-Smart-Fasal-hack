type MockSession = {
  access_token: string;
  user: {
    id: string;
    email: string | null;
    is_anonymous: boolean;
    created_at: string;
    user_metadata: Record<string, unknown>;
  };
};

type AuthChangeCallback = (event: string, session: MockSession | null) => void;

let _session: MockSession | null = null;
const _listeners: AuthChangeCallback[] = [];

function notify(event: string, session: MockSession | null) {
  _listeners.forEach((cb) => cb(event, session));
}

function makeSession(overrides: Partial<MockSession["user"]> = {}): MockSession {
  return {
    access_token: "mock-token",
    user: {
      id: "guest-" + Math.random().toString(36).slice(2),
      email: null,
      is_anonymous: true,
      created_at: new Date().toISOString(),
      user_metadata: {},
      ...overrides,
    },
  };
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: _session }, error: null }),

    signInWithPassword: async ({ email }: { email: string; password: string }) => {
      _session = makeSession({ email, is_anonymous: false });
      notify("SIGNED_IN", _session);
      return { data: { session: _session }, error: null };
    },

    signUp: async ({ email, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      _session = makeSession({ email, is_anonymous: false, user_metadata: options?.data ?? {} });
      notify("SIGNED_IN", _session);
      return { data: { session: _session }, error: null };
    },

    signInAnonymously: async () => {
      _session = makeSession();
      notify("SIGNED_IN", _session);
      return { data: { session: _session }, error: null };
    },

    signOut: async () => {
      _session = null;
      notify("SIGNED_OUT", null);
      return { error: null };
    },

    onAuthStateChange: (callback: AuthChangeCallback) => {
      _listeners.push(callback);
      if (_session) callback("INITIAL_SESSION", _session);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = _listeners.indexOf(callback);
              if (idx !== -1) _listeners.splice(idx, 1);
            },
          },
        },
      };
    },
  },
};
