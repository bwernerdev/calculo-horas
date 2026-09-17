(() => {
  const authenticated = localStorage.getItem("e2e-authenticated") === "true";
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "teste@example.com" };
  let session = authenticated ? { user } : null;
  let authListener;

  function query(table) {
    let selectedRow = {};
    const builder = {
      select() { return builder; },
      order() { return builder; },
      eq() { return builder; },
      upsert(value) { selectedRow = value; return builder; },
      then(resolve) { resolve({ error: table === "settings" && window.__failSettingsSave ? { message: "Falha simulada nas configurações." } : null }); },
      delete() { return builder; },
      insert: async () => ({ data: null, error: null }),
      single: async () => ({ data: selectedRow, error: null }),
      maybeSingle: async () => ({
        data: table === "settings" ? { target_minutes: 528, theme: "light", balance_adjustments: {} } : null,
        error: null,
      }),
      range: async () => ({ data: [], error: null }),
    };
    return builder;
  }

  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: (listener) => { authListener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
        signInWithPassword: async () => {
          session = { user };
          queueMicrotask(() => authListener?.("SIGNED_IN", session));
          return { data: { session }, error: null };
        },
        signOut: async () => { session = null; queueMicrotask(() => authListener?.("SIGNED_OUT", null)); return { error: null }; },
        signUp: async () => ({ data: { session: null }, error: null }),
        resend: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ error: null }),
        updateUser: async () => ({ data: { user }, error: null }),
      },
      from: query,
      rpc: async (name,parameters) => {
        if (name==="import_forponto_records") {
          if (window.__failForpontoImport) return { data:null, error:{ message:"Falha simulada na importação." } };
          return { data:parameters.p_records, error:null };
        }
        return { data:null, error:null };
      },
      storage: {
        from: () => ({
          download: async () => ({ data: new Blob(), error: null }),
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    }),
  };
})();
