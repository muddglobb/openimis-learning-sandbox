// ============================================================
// OpenIMIS API Client
// ------------------------------------------------------------
// Covers the GraphQL surface of openIMIS 26.04 (release/26.04
// module manifest) plus the HL7 FHIR R4 endpoints.
//
// Every call returns plain data. Operations that a UI needs to
// show to the user (the "Lihat GraphQL" popup) additionally set
// `OpenIMISApi.lastOperation`.
// ============================================================
const OpenIMISApi = (function () {
  const TOKEN_KEY = 'openimis_token';
  const REFRESH_KEY = 'openimis_refresh';
  const USER_KEY = 'openimis_user';
  const CRED_KEY = 'openimis_credentials';

  let token = localStorage.getItem(TOKEN_KEY) || null;
  let refreshToken = localStorage.getItem(REFRESH_KEY) || null;
  let currentUser = safeParse(localStorage.getItem(USER_KEY));
  let lastOperation = null;

  // Demo credentials, kept only so the sandbox can silently re-login when the
  // short-lived JWT expires mid-session. Stored in localStorage purely because
  // this is a local teaching tool using a throwaway Admin/admin123 account.
  let credentials = safeParse(localStorage.getItem(CRED_KEY));

  let reauthInFlight = null;

  const apiHistory = [];
  const listeners = [];

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // ------------------------------------------------------------
  // JWT helpers
  // ------------------------------------------------------------

  /** Decode a JWT payload without verifying the signature. */
  function decodeJwtPayload(jwt) {
    if (!jwt || typeof jwt !== 'string') return null;
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch (e) {
      return null;
    }
  }

  /** Epoch seconds when the current token expires, or null if unknown. */
  function tokenExpiry() {
    const payload = decodeJwtPayload(token);
    return payload && payload.exp ? payload.exp : null;
  }

  /**
   * True when the token is missing or expires within `skewSeconds`.
   * openIMIS tokens are short-lived, so we refresh slightly ahead of time.
   */
  function isTokenStale(skewSeconds = 30) {
    if (!token) return true;
    const exp = tokenExpiry();
    if (!exp) return false; // can't tell — assume valid, server will say otherwise
    return (exp - skewSeconds) <= Math.floor(Date.now() / 1000);
  }

  /** Human-readable remaining lifetime, for the inspector drawer. */
  function tokenSecondsLeft() {
    const exp = tokenExpiry();
    if (!exp) return null;
    return exp - Math.floor(Date.now() / 1000);
  }

  const AUTH_ERROR = /signature has expired|token has expired|invalid signature|authentication credentials were not provided|not authenticated|unauthorized/i;

  function isAuthError(message) {
    return AUTH_ERROR.test(String(message || ''));
  }

  /**
   * Re-authenticate with the stored demo credentials.
   * De-duplicated: concurrent callers share one in-flight login.
   */
  async function reauthenticate() {
    if (reauthInFlight) return reauthInFlight;
    if (!credentials || !credentials.username) {
      throw new Error('Sesi berakhir dan tidak ada kredensial tersimpan. Silakan login ulang.');
    }

    reauthInFlight = (async () => {
      const data = await graphql(
        `mutation SandboxRelogin($username: String!, $password: String!) {
           tokenAuth(username: $username, password: $password) { token payload refreshExpiresIn }
         }`,
        { username: credentials.username, password: credentials.password },
        'Perpanjang Sesi (auto re-login)',
        { skipAuth: true, silent: true }
      );

      token = data.tokenAuth.token;
      localStorage.setItem(TOKEN_KEY, token);
      notify('auth_state_changed', { isAuthenticated: true, user: currentUser, refreshed: true });
      return token;
    })();

    try {
      return await reauthInFlight;
    } finally {
      reauthInFlight = null;
    }
  }

  /** Make sure we hold a usable token before issuing a request. */
  async function ensureFreshToken() {
    if (!isTokenStale()) return;
    if (!credentials || !credentials.username) return; // nothing we can do
    await reauthenticate();
  }

  function notify(event, data) {
    listeners.forEach(fn => {
      try { fn(event, data); } catch (e) { console.error('listener error', e); }
    });
  }

  function logRequest(type, title, payload, response, error = null) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      time: new Date().toLocaleTimeString('id-ID'),
      type,
      title,
      payload,
      response,
      error: error ? error.message : null,
      status: error ? 'error' : 'success'
    };
    apiHistory.unshift(entry);
    if (apiHistory.length > 80) apiHistory.pop();
    notify('history_updated', entry);
    return entry;
  }

  // ------------------------------------------------------------
  // Transport
  // ------------------------------------------------------------

  /**
   * Build request headers.
   *
   * Never attach a token that has already expired: openIMIS validates the
   * Authorization header before running the resolver, so a stale token makes
   * even `tokenAuth` fail with "Signature has expired" — which would make
   * logging back in impossible.
   */
  function authHeaders(extra = {}, skipAuth = false) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extra);
    if (!skipAuth && token && !isTokenStale(0)) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Run a GraphQL operation.
   * @param {string} query      GraphQL document
   * @param {object} variables  variables map
   * @param {string} title      human readable label for the inspector
   * @param {object} options    { silent:boolean }
   */
  async function graphql(query, variables = {}, title = 'GraphQL Operation', options = {}) {
    const payload = { query, variables };
    const operationName = detectOperationName(query);
    lastOperation = { kind: 'graphql', query, variables, operationName, title };

    // Proactively renew a token that is about to expire.
    if (!options.skipAuth) {
      try { await ensureFreshToken(); } catch (e) { /* fall through, server will decide */ }
    }

    const attempt = async () => {
      let res;
      try {
        res = await fetch('/api/graphql', {
          method: 'POST',
          headers: authHeaders({}, options.skipAuth),
          body: JSON.stringify(payload)
        });
      } catch (networkErr) {
        logRequest('GraphQL', title, payload, null, networkErr);
        const e = new Error(`Tidak dapat menghubungi server sandbox: ${networkErr.message}`);
        e.network = true;
        throw e;
      }

      const raw = await res.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const err = new Error(`Respons bukan JSON (HTTP ${res.status}). Periksa apakah OpenIMIS berjalan.`);
        logRequest('GraphQL', title, payload, raw.slice(0, 500), err);
        throw err;
      }

      return { res, json };
    };

    let { res, json } = await attempt();

    // Reactive renewal: openIMIS answers HTTP 200 with an errors payload when
    // the JWT signature has expired, so inspect the messages too.
    const firstMessages = (json.errors || []).map(e => e.message).join(' | ');
    const expired = json.errors && json.errors.length && isAuthError(firstMessages);

    if (expired && !options.skipAuth && credentials && credentials.username && !options._retried) {
      try {
        await reauthenticate();
        ({ res, json } = await attempt());
      } catch (reauthErr) {
        const err = new Error(
          'Sesi berakhir dan login ulang otomatis gagal. Silakan login kembali lewat tombol akun.'
        );
        err.authExpired = true;
        if (!options.silent) logRequest('GraphQL', title, payload, json, err);
        notify('auth_state_changed', { isAuthenticated: false, user: null, expired: true });
        throw err;
      }
    }

    // GraphQL always answers 200 on application-level errors, but auth
    // failures surface as 401/403 with an errors payload.
    const gqlErrors = Array.isArray(json.errors) ? json.errors : null;
    if (gqlErrors && gqlErrors.length) {
      const message = gqlErrors.map(e => e.message).join(' | ');
      const err = new Error(message);
      err.graphqlErrors = gqlErrors;
      if (isAuthError(message)) err.authExpired = true;
      if (!options.silent) logRequest('GraphQL', title, payload, json, err);
      throw err;
    }

    if (!options.silent) logRequest('GraphQL', title, payload, json);
    return json.data || {};
  }

  function detectOperationName(query) {
    const m = String(query).match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (m) return m[1];
    return 'AnonymousOperation';
  }

  /**
   * Call the FHIR R4 REST API through the sandbox proxy.
   * @param {string} path  e.g. "Patient/" or "Patient/123"
   */
  async function fhir(path, method = 'GET', data = null, title = 'FHIR Operation') {
    const cleanPath = String(path).replace(/^\/+/, '');

    lastOperation = { kind: 'fhir', method, path: cleanPath, data, title };

    try { await ensureFreshToken(); } catch (e) { /* server will decide */ }

    const attempt = async () => {
      const headers = { Accept: 'application/fhir+json, application/json' };
      if (data !== null) headers['Content-Type'] = 'application/fhir+json';
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const opts = { method, headers };
      if (data !== null && ['POST', 'PUT', 'PATCH'].includes(method)) {
        opts.body = JSON.stringify(data);
      }

      const res = await fetch(`/api/fhir/${cleanPath}`, opts);
      const raw = await res.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch (e) {
        json = { raw: raw.slice(0, 2000) };
      }
      return { res, json };
    };

    try {
      let { res, json } = await attempt();

      // 401/403 usually means the JWT expired — renew once and retry.
      if ((res.status === 401 || res.status === 403) && credentials && credentials.username) {
        try {
          await reauthenticate();
          ({ res, json } = await attempt());
        } catch (e) { /* report the original response */ }
      }

      logRequest('FHIR REST', title, { method, path: cleanPath, data }, json);
      return json;
    } catch (err) {
      logRequest('FHIR REST', title, { method, path: cleanPath, data }, null, err);
      throw err;
    }
  }

  // ------------------------------------------------------------
  // Relay connection helper
  // ------------------------------------------------------------

  /**
   * Build a paged query body:  <field>(first: n, <params>) { edges { node { <fields> } } totalCount }
   */
  function connection(field, params, nodeFields, extra = '') {
    const args = Object.entries(params || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    const argStr = args ? `(${args})` : '';
    return `${field}${argStr} { totalCount edges { node { ${nodeFields} } } ${extra} }`;
  }

  function varsDecl(map) {
    const entries = Object.entries(map || {});
    if (!entries.length) return '';
    return '(' + entries.map(([k, v]) => `$${k}: ${v}`).join(', ') + ')';
  }

  // ============================================================
  // AUTH & CORE
  // ============================================================

  async function login(username = 'Admin', password = 'admin123') {
    const query = `
      mutation SandboxLogin($username: String!, $password: String!) {
        tokenAuth(username: $username, password: $password) {
          token
          payload
          refreshExpiresIn
        }
      }
    `;
    const data = await graphql(query, { username, password }, 'Login (tokenAuth)', { skipAuth: true });
    token = data.tokenAuth.token;
    // openIMIS 26.04's tokenAuth does not return a refreshToken.
    refreshToken = data.tokenAuth.refreshToken || null;
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);

    // Remember the demo credentials so an expired token can be renewed silently.
    credentials = { username, password };
    localStorage.setItem(CRED_KEY, JSON.stringify(credentials));

    // openIMIS exposes the profile as `user`, not `currentUser`.
    try {
      const userQuery = `query SandboxCurrentUser {
        user { username lastName otherNames email phone }
      }`;
      const userData = await graphql(userQuery, {}, 'Profil Pengguna (user)');
      currentUser = userData.user || { username };
    } catch (e) {
      currentUser = { username };
    }
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

    notify('auth_state_changed', { isAuthenticated: true, user: currentUser });
    return { token, refreshToken, user: currentUser };
  }

  async function refreshSession() {
    if (!refreshToken) throw new Error('Tidak ada refresh token tersimpan.');
    const query = `
      mutation SandboxRefresh($refreshToken: String!) {
        refreshToken(refreshToken: $refreshToken) { token refreshToken }
      }
    `;
    const data = await graphql(query, { refreshToken }, 'Perpanjang Sesi (refreshToken)');
    token = data.refreshToken.token;
    localStorage.setItem(TOKEN_KEY, token);
    if (data.refreshToken.refreshToken) {
      refreshToken = data.refreshToken.refreshToken;
      localStorage.setItem(REFRESH_KEY, refreshToken);
    }
    notify('auth_state_changed', { isAuthenticated: true, user: currentUser });
    return token;
  }

  function logout() {
    token = null;
    refreshToken = null;
    currentUser = null;
    credentials = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CRED_KEY);
    notify('auth_state_changed', { isAuthenticated: false, user: null });
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (e) {
      return { status: 'down', openimis: 'disconnected', error: e.message };
    }
  }

  /** Fetch the live schema so the Playground can browse it. */
  async function introspectSchema() {
    const query = `
      query SandboxIntrospection {
        __schema {
          queryType { name }
          mutationType { name }
          types {
            name
            kind
            description
            fields {
              name
              description
              args { name type { name kind ofType { name kind } } }
              type { name kind ofType { name kind } }
            }
            inputFields { name type { name kind ofType { name kind } } }
            enumValues { name }
          }
        }
      }
    `;
    const data = await graphql(query, {}, 'Introspection Skema (__schema)');
    return data.__schema;
  }

  // ---------- core module ----------

  async function getCurrentUser() {
    const query = `query SandboxUser {
      user { id username lastName otherNames email phone
             iUser { language { code name } } }
    }`;
    const data = await graphql(query, {}, 'Profil Pengguna');
    return data.user;
  }

  async function getModuleConfigurations() {
    const query = `query SandboxModuleConfig {
      moduleConfigurations { module layer config version isExposed }
    }`;
    const data = await graphql(query, {}, 'Konfigurasi Modul');
    return data.moduleConfigurations || [];
  }

  async function getLanguages() {
    const query = `query SandboxLanguages { languages { code name sortOrder } }`;
    const data = await graphql(query, {}, 'Daftar Bahasa');
    return data.languages || [];
  }

  async function getPasswordPolicy() {
    // passwordPolicy returns JSONString — it has no sub-selection.
    const query = `query SandboxPasswordPolicy { passwordPolicy }`;
    const data = await graphql(query, {}, 'Kebijakan Password');
    return data.passwordPolicy;
  }

  async function getUsers(first = 25, search = null) {
    const query = `
      query SandboxUsers($first: Int, $str: String) {
        users(first: $first, str: $str, orderBy: ["username"]) {
          totalCount
          edges { node { id username lastName otherNames email phone
                         iUser { id } officer { id } claimAdmin { id } } }
        }
      }
    `;
    const data = await graphql(query, { first, str: search || undefined }, 'Daftar Pengguna');
    return data.users;
  }

  async function getRoles(first = 50) {
    const query = `
      query SandboxRoles($first: Int) {
        role(first: $first) { totalCount edges { node { id uuid name isSystem isBlocked altLanguage } } }
      }
    `;
    const data = await graphql(query, { first }, 'Daftar Role');
    return data.role;
  }

  async function getRoleRights() {
    const query = `query SandboxRoleRights {
      roleRight { edges { node { id rightId } } }
    }`;
    const data = await graphql(query, {}, 'Daftar Hak Akses');
    return data.roleRight;
  }

  async function getClaimAdmins(first = 50) {
    const query = `
      query SandboxClaimAdmins($first: Int) {
        claimAdmins(first: $first) {
          edges { node { id code lastName otherNames healthFacility { id code name } } }
        }
      }
    `;
    const data = await graphql(query, { first }, 'Daftar Claim Admin');
    return data.claimAdmins;
  }

  async function getEnrolmentOfficers(first = 50) {
    const query = `
      query SandboxOfficers($first: Int) {
        enrolmentOfficers(first: $first) {
          edges { node { id code lastName otherNames phone email } }
        }
      }
    `;
    const data = await graphql(query, { first }, 'Daftar Enrolment Officer');
    return data.enrolmentOfficers;
  }

  async function getMutationLogs(first = 25) {
    const query = `
      query SandboxMutationLogs($first: Int) {
        mutationLogs(first: $first) {
          totalCount
          edges { node { id clientMutationId clientMutationLabel status } }
        }
      }
    `;
    const data = await graphql(query, { first }, 'Mutation Log');
    return data.mutationLogs;
  }

  async function getModulesPermissions() {
    const query = `query SandboxModulePerms {
      modulesPermissions { modulePermsList { moduleName permissions { permsName permsValue } } }
    }`;
    const data = await graphql(query, {}, 'Hak Akses per Modul');
    return data.modulesPermissions;
  }

  async function changePassword(newPassword, oldPassword = null, username = null) {
    const query = `
      mutation SandboxChangePassword($oldPassword: String, $newPassword: String!, $username: String) {
        changePassword(oldPassword: $oldPassword, newPassword: $newPassword, username: $username) {
          success error
        }
      }
    `;
    return graphql(query, { oldPassword: oldPassword || undefined, newPassword, username: username || undefined }, 'Ubah Password');
  }

  async function createUser(input) {
    const query = `
      mutation SandboxCreateUser($input: CreateUserMutationInput!) {
        createUser(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Buat Pengguna');
  }

  async function updateUser(input) {
    const query = `
      mutation SandboxUpdateUser($input: UpdateUserMutationInput!) {
        updateUser(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Ubah Pengguna');
  }

  async function deleteUsers(uuids) {
    const query = `
      mutation SandboxDeleteUsers($input: DeleteUserMutationInput!) {
        deleteUser(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Hapus Pengguna');
  }

  // ============================================================
  // INSUREE & FAMILY
  // ============================================================

  const INSUREE_FIELDS = `
    id uuid chfId lastName otherNames dob age head marital phone email
    cardIssued status statusDate passport
    gender { code gender }
    currentVillage { id uuid code name }
    family { id uuid address poverty }
    healthFacility { id uuid code name level }
    typeOfId { code identificationType }
    profession { id profession }
    education { id education }
    relationship { id relation }
  `;

  async function getInsurees(first = 25, filters = {}) {
    const query = `
      query SandboxInsurees($first: Int, $chfId: String, $lastName: String, $otherNames: String,
                            $genderCode: String, $status: InsureeStatus) {
        insurees(first: $first, chfId: $chfId, lastName: $lastName, otherNames: $otherNames,
                 gender_Code: $genderCode, status: $status,
                 orderBy: ["lastName", "otherNames"]) {
          totalCount
          edges { node { ${INSUREE_FIELDS} } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      chfId: filters.chfId || undefined,
      lastName: filters.lastName || undefined,
      otherNames: filters.otherNames || undefined,
      genderCode: filters.genderCode || undefined,
      status: filters.status || undefined
    }, 'Daftar Peserta (insurees)');
    return data.insurees;
  }

  /** `insurees` has no `id` argument � look up by uuid instead. */
  async function getInsureeByUuid(uuid) {
    const query = `query SandboxInsuree($uuid: String) {
      insurees(first: 1, uuid: $uuid) { edges { node { ${INSUREE_FIELDS} } } }
    }`;
    const data = await graphql(query, { uuid }, 'Detail Peserta');
    return (data.insurees.edges[0] || {}).node || null;
  }

  async function checkInsureeNumber(chfId) {
    // insureeNumberValidity(insureeNumber: String!) -> ValidationMessageGQLType
    const query = `query SandboxChfCheck($insureeNumber: String!) {
      insureeNumberValidity(insureeNumber: $insureeNumber) { isValid }
    }`;
    const data = await graphql(query, { insureeNumber: chfId }, 'Validasi Nomor Kartu');
    return data.insureeNumberValidity;
  }

  /** Checks whether a family may accept another member (policy member limit). */
  async function canAddInsuree(familyId) {
    const query = `query SandboxCanAdd($familyId: Int!) { canAddInsuree(familyId: $familyId) }`;
    const data = await graphql(query, { familyId: SandboxUtil.relayToId(familyId) }, 'Cek Boleh Tambah Peserta');
    return data.canAddInsuree;
  }

  async function createInsuree(input) {
    const query = `
      mutation SandboxCreateInsuree($input: CreateInsureeMutationInput!) {
        createInsuree(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Daftarkan Peserta (createInsuree)');
  }

  async function updateInsuree(input) {
    const query = `
      mutation SandboxUpdateInsuree($input: UpdateInsureeMutationInput!) {
        updateInsuree(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perbarui Peserta (updateInsuree)');
  }

  async function deleteInsurees(uuids) {
    const query = `
      mutation SandboxDeleteInsurees($input: DeleteInsureesMutationInput!) {
        deleteInsurees(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Hapus Peserta (deleteInsurees)');
  }

  async function removeInsurees(uuids) {
    const query = `
      mutation SandboxRemoveInsurees($input: RemoveInsureesMutationInput!) {
        removeInsurees(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Keluarkan Peserta (removeInsurees)');
  }

  // ---- families ----

  async function getFamilies(first = 25, filters = {}) {
    const query = `
      query SandboxFamilies($first: Int, $confirmationNo: String, $address: String) {
        families(first: $first, confirmationNo: $confirmationNo, address: $address,
                 orderBy: ["id"]) {
          totalCount
          edges { node {
            id uuid address poverty ethnicity isOffline confirmationNo
            familyType { code type }
            location { id uuid code name }
            headInsuree { id chfId lastName otherNames gender { code } dob }
          } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      confirmationNo: filters.confirmationNo || undefined,
      address: filters.address || undefined
    }, 'Daftar Keluarga (families)');
    return data.families;
  }

  async function getFamilyMembers(first = 50, familyUuid = null) {
    // openIMIS 26.04 requires family_uuid (not an integer id) on familyMembers.
    const query = `
      query SandboxFamilyMembers($first: Int, $familyUuid: String!) {
        familyMembers(first: $first, familyUuid: $familyUuid) {
          totalCount
          edges { node {
            id uuid chfId lastName otherNames dob head
            gender { code }
            relationship { id relation }
          } }
        }
      }
    `;
    const data = await graphql(query, { first, familyUuid }, 'Anggota Keluarga');
    return data.familyMembers;
  }

  async function createFamily(input) {
    const query = `
      mutation SandboxCreateFamily($input: CreateFamilyMutationInput!) {
        createFamily(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Buat Keluarga (createFamily)');
  }

  async function updateFamily(input) {
    const query = `
      mutation SandboxUpdateFamily($input: UpdateFamilyMutationInput!) {
        updateFamily(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perbarui Keluarga (updateFamily)');
  }

  async function deleteFamilies(uuids) {
    const query = `
      mutation SandboxDeleteFamilies($input: DeleteFamiliesMutationInput!) {
        deleteFamilies(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Hapus Keluarga (deleteFamilies)');
  }

  async function setFamilyHead(familyUuid, insureeUuid) {
    // SetFamilyHeadMutation.Input: uuid (family), insuree_uuid
    const query = `
      mutation SandboxSetFamilyHead($input: SetFamilyHeadMutationInput!) {
        setFamilyHead(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuid: familyUuid, insureeUuid } }, 'Tetapkan Kepala Keluarga');
  }

  async function changeInsureeFamily(insureeUuid, familyUuid, cancelPolicies = false) {
    // ChangeInsureeFamilyMutation.Input: family_uuid, insuree_uuid, cancel_policies
    const query = `
      mutation SandboxChangeFamily($input: ChangeInsureeFamilyMutationInput!) {
        changeInsureeFamily(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, {
      input: { familyUuid, insureeUuid, cancelPolicies }
    }, 'Pindah Anggota Keluarga');
  }

  // ---- insuree reference data ----

  async function getInsureeGenders() {
    const query = `query SandboxGenders { insureeGenders { id code gender } }`;
    const data = await graphql(query, {}, 'Referensi Gender');
    return data.insureeGenders || [];
  }

  async function getRelations() {
    // RelationGQLType exposes `relation`, not `relationship`.
    const query = `query SandboxRelations { relations { id relation sortOrder } }`;
    const data = await graphql(query, {}, 'Referensi Hubungan Keluarga');
    return data.relations || [];
  }

  async function getFamilyTypes() {
    // FamilyTypeGQLType exposes `type`, not `familyType`.
    const query = `query SandboxFamilyTypes { familyTypes { code type sortOrder } }`;
    const data = await graphql(query, {}, 'Referensi Tipe Keluarga');
    return data.familyTypes || [];
  }

  async function getConfirmationTypes() {
    // The field really is `confirmationtype` (lowercase t) in openIMIS 26.04.
    const query = `query SandboxConfirmationTypes { confirmationTypes { code confirmationtype isConfirmationNumberRequired } }`;
    const data = await graphql(query, {}, 'Referensi Tipe Konfirmasi');
    return data.confirmationTypes || [];
  }

  async function getProfessions() {
    // ProfessionGQLType has `id` + `profession`; there is no `code`.
    const query = `query SandboxProfessions { professions { id profession sortOrder } }`;
    const data = await graphql(query, {}, 'Referensi Profesi');
    return data.professions || [];
  }

  async function getEducations() {
    // EducationGQLType has `id` + `education`; there is no `code`.
    const query = `query SandboxEducations { educations { id education sortOrder } }`;
    const data = await graphql(query, {}, 'Referensi Pendidikan');
    return data.educations || [];
  }

  async function getIdentificationTypes() {
    // IdentificationTypeGQLType exposes `identificationType`, not `name`.
    const query = `query SandboxIdTypes { identificationTypes { code identificationType } }`;
    const data = await graphql(query, {}, 'Referensi Tipe Identitas');
    return data.identificationTypes || [];
  }

  async function getInsureeStatusReasons(first = 50) {
    const query = `query SandboxStatusReasons($first: Int) {
      insureeStatusReasons(first: $first) { edges { node { id code name } } }
    }`;
    const data = await graphql(query, { first }, 'Referensi Alasan Status');
    return data.insureeStatusReasons;
  }

  // ============================================================
  // POLICY
  // ============================================================

  async function getPolicies(first = 25, filters = {}) {
    const query = `
      query SandboxPolicies($first: Int, $status: Int, $productCode: String) {
        policies(first: $first, status: $status, product_Code: $productCode,
                 orderBy: ["-startDate"]) {
          totalCount
          edges { node {
            id uuid status stage startDate enrollDate expiryDate
            value balance
            product { id uuid code name lumpSum maxInstallments threshold ceiling deductible ceilingType }
            family { id uuid address headInsuree { id chfId lastName otherNames } }
            officer { id code lastName otherNames }
            payer { id uuid name }
          } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      status: filters.status !== undefined && filters.status !== '' ? Number(filters.status) : undefined,
      productCode: filters.productCode || undefined
    }, 'Daftar Polis (policies)');
    return data.policies;
  }

  async function getPoliciesByInsuree(chfId, activeOrLastExpiredOnly = false) {
    const query = `
      query SandboxPoliciesByInsuree($chfId: String!, $activeOnly: Boolean) {
        policiesByInsuree(chfId: $chfId, activeOrLastExpiredOnly: $activeOnly) {
          edges { node {
            policyId policyUuid productCode productName
            startDate enrollDate effectiveDate expiryDate
            officerCode officerName status
            ded ceiling balance
            maxInstallments contributionPlanCode contributionPlanName
            policyValue
          } }
        }
      }
    `;
    const data = await graphql(query, { chfId, activeOnly: activeOrLastExpiredOnly }, `Polis Peserta ${chfId}`);
    return (data.policiesByInsuree.edges || []).map(e => e.node);
  }

  async function getPoliciesByFamily(familyUuid) {
    const query = `
      query SandboxPoliciesByFamily($familyUuid: String!) {
        policiesByFamily(familyUuid: $familyUuid) {
          edges { node { policyId policyUuid productCode productName status expiryDate balance ceiling } }
        }
      }
    `;
    const data = await graphql(query, { familyUuid }, 'Polis per Keluarga');
    return (data.policiesByFamily.edges || []).map(e => e.node);
  }

  async function checkEligibility(chfId) {
    const query = `
      query SandboxEligibility($chfId: String!) {
        policyEligibilityByInsuree(chfId: $chfId) {
          prodId totalAdmissionsLeft totalVisitsLeft totalConsultationsLeft
          totalSurgeriesLeft totalDeliveriesLeft totalAntenatalLeft
          consultationAmountLeft surgeryAmountLeft deliveryAmountLeft
          hospitalizationAmountLeft antenatalAmountLeft
          minDateService minDateItem serviceLeft itemLeft
          isItemOk isServiceOk
        }
        policiesByInsuree(chfId: $chfId, activeOrLastExpiredOnly: true) {
          edges { node {
            policyId policyUuid productCode productName status
            startDate expiryDate balance ceiling ded policyValue
          } }
        }
      }
    `;
    const data = await graphql(query, { chfId }, `Cek Eligibilitas ${chfId}`);
    return {
      eligibility: data.policyEligibilityByInsuree,
      policies: (data.policiesByInsuree?.edges || []).map(e => e.node)
    };
  }

  async function checkItemEligibility(chfId, itemCode, serviceDate = null, qty = 1) {
    const query = `
      query SandboxItemEligibility($chfId: String!, $itemCode: String!, $serviceDate: Date, $qty: Int) {
        policyItemEligibilityByInsuree(chfId: $chfId, itemCode: $itemCode, serviceDate: $serviceDate, qty: $qty) {
          prodId isItemOk itemLeft minDateItem
        }
      }
    `;
    const data = await graphql(query, {
      chfId, itemCode, serviceDate: serviceDate || undefined, qty
    }, `Eligibilitas Obat ${itemCode}`);
    return data.policyItemEligibilityByInsuree;
  }

  async function checkServiceEligibility(chfId, serviceCode, serviceDate = null, qty = 1) {
    const query = `
      query SandboxServiceEligibility($chfId: String!, $serviceCode: String!, $serviceDate: Date, $qty: Int) {
        policyServiceEligibilityByInsuree(chfId: $chfId, serviceCode: $serviceCode, serviceDate: $serviceDate, qty: $qty) {
          prodId isServiceOk serviceLeft minDateService
        }
      }
    `;
    const data = await graphql(query, {
      chfId, serviceCode, serviceDate: serviceDate || undefined, qty
    }, `Eligibilitas Tindakan ${serviceCode}`);
    return data.policyServiceEligibilityByInsuree;
  }

  /**
   * policyValues requires stage + enrollDate + familyId and returns
   * PolicyAndWarningsGQLType, which wraps a single `policy`.
   */
  /**
   * policyValues requires stage + enrollDate + familyId + (productId or
   * contributionPlanUuid), and returns PolicyAndWarningsGQLType wrapping a
   * single `policy`.
   *
   * KNOWN UPSTREAM ISSUE (openIMIS 26.04): on the demo dataset this resolver
   * answers `policy: null` for every family/product pair, which then trips the
   * non-null constraint on PolicyGQLType.uuid. We surface that as a plain
   * `null` result plus a console note instead of throwing, so the Playground
   * and the smoke test can still report it as a known limitation.
   */
  async function getPolicyValues(familyId, enrollDate, stage = 'N', productId = null, contributionPlanUuid = null) {
    const query = `query SandboxPolicyValues(
      $familyId: Int!, $enrollDate: DateTime!, $stage: String!,
      $productId: Int, $contributionPlanUuid: UUID
    ) {
      policyValues(
        familyId: $familyId, enrollDate: $enrollDate, stage: $stage,
        productId: $productId, contributionPlanUuid: $contributionPlanUuid
      ) {
        policy { uuid product { code name } value startDate expiryDate }
      }
    }`;
    try {
      const data = await graphql(query, {
        familyId: SandboxUtil.relayToId(familyId),
        enrollDate: enrollDate || new Date().toISOString(),
        stage,
        productId: productId ? SandboxUtil.relayToId(productId) : undefined,
        contributionPlanUuid: contributionPlanUuid || undefined
      }, 'Nilai Polis');
      return data.policyValues;
    } catch (e) {
      if (/Cannot return null for non-nullable field PolicyGQLType/i.test(e.message)) {
        console.warn('[openIMIS] policyValues returned an empty policy for this family/product pair.');
        return { policy: null, knownIssue: 'policyValues returns null on this dataset' };
      }
      throw e;
    }
  }

  async function createPolicy(input) {
    const query = `
      mutation SandboxCreatePolicy($input: CreatePolicyMutationInput!) {
        createPolicy(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Terbitkan Polis (createPolicy)');
  }

  async function updatePolicy(input) {
    const query = `
      mutation SandboxUpdatePolicy($input: UpdatePolicyMutationInput!) {
        updatePolicy(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perbarui Polis (updatePolicy)');
  }

  async function renewPolicy(input) {
    const query = `
      mutation SandboxRenewPolicy($input: RenewPolicyMutationInput!) {
        renewPolicy(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perpanjang Polis (renewPolicy)');
  }

  async function suspendPolicies(uuids) {
    const query = `
      mutation SandboxSuspendPolicies($input: SuspendPoliciesMutationInput!) {
        suspendPolicies(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Suspend Polis');
  }

  async function deletePolicies(uuids) {
    const query = `
      mutation SandboxDeletePolicies($input: DeletePoliciesMutationInput!) {
        deletePolicies(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Hapus Polis');
  }

  // ============================================================
  // PRODUCT
  // ============================================================

  async function getProducts(first = 25) {
    const query = `
      query SandboxProducts($first: Int) {
        products(first: $first) {
          totalCount
          edges { node {
            id uuid code name
            lumpSum maxMembers maxInstallments threshold
            insurancePeriod administrationPeriod recurrence
            premiumAdult premiumChild
            deductible deductibleIp deductibleOp
            ceilingType ceilingInterpretation
            maxInsuree
            dateFrom dateTo
          } }
        }
      }
    `;
    const data = await graphql(query, { first }, 'Daftar Produk (products)');
    return data.products;
  }

  async function getProductByCode(code) {
    const query = `query SandboxProduct($code: String!) {
      product(code: $code) {
        id uuid code name lumpSum maxMembers maxInstallments threshold
        insurancePeriod premiumAdult premiumChild
        deductible deductibleIp deductibleOp
        ceilingType ceilingInterpretation
        dateFrom dateTo
        productServices { id service { id code name price } }
        productItems { id item { id code name price } }
      }
    }`;
    const data = await graphql(query, { code }, 'Detail Produk');
    return data.product;
  }

  async function validateProductCode(code) {
    const query = `query SandboxValidateProduct($code: String!) { validateProductCode(productCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Produk');
    return data.validateProductCode;
  }

  async function createProduct(input) {
    const query = `
      mutation SandboxCreateProduct($input: CreateProductMutationInput!) {
        createProduct(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Buat Produk (createProduct)');
  }

  async function updateProduct(input) {
    const query = `
      mutation SandboxUpdateProduct($input: UpdateProductMutationInput!) {
        updateProduct(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perbarui Produk (updateProduct)');
  }

  async function duplicateProduct(input) {
    const query = `
      mutation SandboxDuplicateProduct($input: DuplicateProductMutationInput!) {
        duplicateProduct(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Duplikat Produk');
  }

  async function deleteProduct(uuid) {
    const query = `
      mutation SandboxDeleteProduct($input: DeleteProductMutationInput!) {
        deleteProduct(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuid } }, 'Hapus Produk');
  }

  // ============================================================
  // MEDICAL CATALOG
  // ============================================================

  async function getDiagnoses(first = 40, search = null) {
    if (search) {
      const query = `query SandboxDiagnosesStr($str: String, $first: Int) {
        diagnosesStr(str: $str, first: $first) {
          totalCount edges { node { id code name } }
        }
      }`;
      const data = await graphql(query, { str: search, first }, `Cari Diagnosis "${search}"`);
      return data.diagnosesStr;
    }
    // DiagnosisGQLType has neither `uuid` nor an `orderBy` argument.
    const query = `query SandboxDiagnoses($first: Int) {
      diagnoses(first: $first) {
        totalCount edges { node { id code name } }
      }
    }`;
    const data = await graphql(query, { first }, 'Daftar Diagnosis ICD-10');
    return data.diagnoses;
  }

  async function getMedicalItems(first = 40, search = null) {
    const query = search
      ? `query SandboxItemsStr($str: String, $first: Int) {
          medicalItemsStr(str: $str, first: $first) {
            totalCount edges { node { id uuid code name type price package quantity careType patientCategory } }
          }
        }`
      : `query SandboxItems($first: Int) {
          medicalItems(first: $first, orderBy: ["code"]) {
            totalCount edges { node { id uuid code name type price package quantity careType patientCategory } }
          }
        }`;
    const vars = search ? { str: search, first } : { first };
    const data = await graphql(query, vars, search ? `Cari Obat "${search}"` : 'Daftar Obat & Alkes');
    return search ? data.medicalItemsStr : data.medicalItems;
  }

  async function getMedicalServices(first = 40, search = null) {
    const query = search
      ? `query SandboxServicesStr($str: String, $first: Int) {
          medicalServicesStr(str: $str, first: $first) {
            totalCount edges { node { id uuid code name type level price careType category packagetype } }
          }
        }`
      : `query SandboxServices($first: Int) {
          medicalServices(first: $first, orderBy: ["code"]) {
            totalCount edges { node { id uuid code name type level price careType category packagetype } }
          }
        }`;
    const vars = search ? { str: search, first } : { first };
    const data = await graphql(query, vars, search ? `Cari Tindakan "${search}"` : 'Daftar Tindakan Medis');
    return search ? data.medicalServicesStr : data.medicalServices;
  }

  async function validateItemCode(code) {
    const query = `query SandboxValidateItem($code: String!) { validateItemCode(itemCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Obat');
    return data.validateItemCode;
  }

  async function validateServiceCode(code) {
    const query = `query SandboxValidateService($code: String!) { validateServiceCode(serviceCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Tindakan');
    return data.validateServiceCode;
  }

  async function createItem(input) {
    const query = `mutation SandboxCreateItem($input: CreateItemMutationInput!) {
      createItem(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Obat/Alkes (createItem)');
  }

  async function updateItem(input) {
    const query = `mutation SandboxUpdateItem($input: UpdateItemMutationInput!) {
      updateItem(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Perbarui Obat/Alkes');
  }

  async function deleteItem(uuid) {
    const query = `mutation SandboxDeleteItem($input: DeleteItemMutationInput!) {
      deleteItem(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { uuids: [uuid] } }, 'Hapus Obat/Alkes');
  }

  async function createService(input) {
    const query = `mutation SandboxCreateService($input: CreateServiceMutationInput!) {
      createService(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Tindakan (createService)');
  }

  async function updateService(input) {
    const query = `mutation SandboxUpdateService($input: UpdateServiceMutationInput!) {
      updateService(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Perbarui Tindakan');
  }

  async function deleteService(uuid) {
    const query = `mutation SandboxDeleteService($input: DeleteServiceMutationInput!) {
      deleteService(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { uuids: [uuid] } }, 'Hapus Tindakan');
  }

  // ---- pricelists ----

  async function getItemsPricelists(first = 25) {
    const query = `query SandboxItemsPricelists($first: Int) {
      itemsPricelists(first: $first) {
        totalCount
        edges { node { id uuid name pricelistDate
                       location { id uuid code name }
                       details { edges { node { id priceOverrule item { id code name } } } } } }
      }
    }`;
    const data = await graphql(query, { first }, 'Daftar Pricelist Obat');
    return data.itemsPricelists;
  }

  async function getServicesPricelists(first = 25) {
    const query = `query SandboxServicesPricelists($first: Int) {
      servicesPricelists(first: $first) {
        totalCount
        edges { node { id uuid name pricelistDate
                       location { id uuid code name }
                       details { edges { node { id priceOverrule service { id code name } } } } } }
      }
    }`;
    const data = await graphql(query, { first }, 'Daftar Pricelist Tindakan');
    return data.servicesPricelists;
  }

  async function createItemsPricelist(input) {
    const query = `mutation SandboxCreateItemsPL($input: CreateItemsPricelistMutationInput!) {
      createItemsPricelist(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Pricelist Obat');
  }

  async function createServicesPricelist(input) {
    const query = `mutation SandboxCreateServicesPL($input: CreateServicesPricelistMutationInput!) {
      createServicesPricelist(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Pricelist Tindakan');
  }

  // ============================================================
  // CLAIM
  // ============================================================

  const CLAIM_FIELDS = `
    id uuid code status
    dateClaimed dateFrom dateTo dateProcessed
    claimed approved valuated reinsured
    visitType careType category
    explanation adjustment rejectionReason
    reviewStatus feedbackStatus
    referralCode patientCondition preAuthorization
    healthFacility { id uuid code name level }
    insuree { id chfId lastName otherNames }
    icd { id code name }
    admin { id code lastName otherNames }
    items { id qtyProvided priceAsked priceApproved status
            item { id code name price } }
    services { id qtyProvided priceAsked priceApproved status
               service { id code name price } }
    attachmentsCount
  `;

  async function getClaims(first = 50, filters = {}) {
    const query = `
      query SandboxClaims($first: Int, $status: Int, $dateClaimed_Gte: Date,
                          $insuree_ChfId: String, $healthFacility_Code: String, $code: String) {
        claims(first: $first, status: $status,
               dateClaimed_Gte: $dateClaimed_Gte,
               insuree_ChfId: $insuree_ChfId,
               healthFacility_Code: $healthFacility_Code,
               code: $code,
               orderBy: ["-dateClaimed", "-code"]) {
          totalCount
          edges { node { ${CLAIM_FIELDS} } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      status: filters.status !== undefined && filters.status !== '' ? Number(filters.status) : undefined,
      dateClaimed_Gte: filters.dateFrom || undefined,
      insuree_ChfId: filters.chfId || undefined,
      healthFacility_Code: filters.hfCode || undefined,
      code: filters.code || undefined
    }, 'Daftar Klaim (claims)');
    return data.claims;
  }

  async function getClaim(id) {
    const query = `query SandboxClaim($id: Int!) { claim(id: $id) { ${CLAIM_FIELDS} } }`;
    const data = await graphql(query, { id: SandboxUtil.relayToId(id) }, 'Detail Klaim');
    return data.claim;
  }

  async function getClaimHistory(claimUuid) {
    const query = `query SandboxClaimHistory($claimUuid: String!) {
      claimHistory(claimUuid: $claimUuid, first: 50) {
        totalCount edges { node { id uuid code status dateClaimed dateProcessed claimed approved } }
      }
    }`;
    const data = await graphql(query, { claimUuid }, 'Riwayat Klaim');
    return data.claimHistory;
  }

  async function getClaimAttachments(claimUuid) {
    // Filtering goes through the related claim: claim__uuid.
    const query = `query SandboxClaimAttachments($claimUuid: String) {
      claimAttachments(first: 50, claim_Uuid: $claimUuid) {
        totalCount edges { node { id uuid url generalType title filename mime date } }
      }
    }`;
    const data = await graphql(query, { claimUuid: claimUuid || undefined }, 'Lampiran Klaim');
    return data.claimAttachments;
  }

  async function getInsureeNameByChfid(chfId) {
    const query = `query SandboxInsureeName($chfId: String!) { insureeNameByChfid(chfId: $chfId) }`;
    const data = await graphql(query, { chfId }, 'Cari Nama Peserta');
    return data.insureeNameByChfid;
  }

  async function validateClaimCode(code) {
    const query = `query SandboxValidateClaim($code: String!) { validateClaimCode(claimCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Klaim');
    return data.validateClaimCode;
  }

  /**
   * openIMIS 26.04 (Django 4.2 on Python 3.11) crashes whenever a claim is
   * created or updated WITH line items, because claim/service.py formats dates
   * through django.utils.datetime_safe.strftime(), which still uses the Python-2
   * idiom `super(type(dt), dt)`. The server answers:
   *     super(type, obj): obj must be an instance or subtype of type
   *
   * A claim without lines works, so we detect the condition and surface an
   * actionable message instead of a cryptic stack-trace string.
   */
  const CLAIM_LINES_BUG = /super\(type, obj\): obj must be an instance or subtype of type/;

  function claimLinesError(err) {
    if (CLAIM_LINES_BUG.test(err.message)) {
      const e = new Error(
        'openIMIS 26.04 tidak dapat menyimpan klaim yang memiliki rincian tindakan/obat ' +
        '(bug Python 3.11 pada django.utils.datetime_safe). ' +
        'Klaim tanpa rincian tetap bisa dibuat — coba tanpa centang tindakan/obat, ' +
        'lalu tambahkan rincian lewat modul lain setelah bug upstream diperbaiki.'
      );
      e.upstreamBug = 'claim-lines-datetime-safe';
      return e;
    }
    return err;
  }

  async function createClaim(input) {
    const query = `
      mutation SandboxCreateClaim($input: CreateClaimMutationInput!) {
        createClaim(input: $input) { clientMutationId internalId }
      }
    `;
    try {
      return await graphql(query, { input }, 'Ajukan Klaim (createClaim)');
    } catch (err) {
      throw claimLinesError(err);
    }
  }

  async function updateClaim(input) {
    const query = `
      mutation SandboxUpdateClaim($input: UpdateClaimMutationInput!) {
        updateClaim(input: $input) { clientMutationId internalId }
      }
    `;
    try {
      return await graphql(query, { input }, 'Perbarui Klaim (updateClaim)');
    } catch (err) {
      throw claimLinesError(err);
    }
  }

  /** 2:Entered -> 4:Checked (or 1:Rejected) */
  async function submitClaims(uuids) {
    const query = `
      mutation SandboxSubmitClaims($input: SubmitClaimsMutationInput!) {
        submitClaims(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Kirim Klaim (submitClaims)');
  }

  async function selectClaimsForReview(uuids) {
    const query = `
      mutation SandboxSelectReview($input: SelectClaimsForReviewMutationInput!) {
        selectClaimsForReview(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Pilih Klaim untuk Review');
  }

  async function saveClaimReview(claimUuid, reviewData = {}) {
    const query = `
      mutation SandboxSaveReview($input: SaveClaimReviewMutationInput!) {
        saveClaimReview(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: Object.assign({ claimUuid }, reviewData) }, 'Simpan Review Klaim');
  }

  async function deliverClaimsReview(uuids) {
    const query = `
      mutation SandboxDeliverReview($input: DeliverClaimsReviewMutationInput!) {
        deliverClaimsReview(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Kirim Hasil Review');
  }

  async function bypassClaimsReview(uuids) {
    const query = `
      mutation SandboxBypassReview($input: BypassClaimsReviewMutationInput!) {
        bypassClaimsReview(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Lewati Review Klaim');
  }

  async function skipClaimsReview(uuids) {
    const query = `
      mutation SandboxSkipReview($input: SkipClaimsReviewMutationInput!) {
        skipClaimsReview(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Tunda Review Klaim');
  }

  /** 4:Checked -> 8:Processed / 16:Valuated */
  async function processClaims(uuids) {
    const query = `
      mutation SandboxProcessClaims($input: ProcessClaimsMutationInput!) {
        processClaims(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Proses & Adjudikasi (processClaims)');
  }

  async function selectClaimsForFeedback(uuids) {
    const query = `
      mutation SandboxSelectFeedback($input: SelectClaimsForFeedbackMutationInput!) {
        selectClaimsForFeedback(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Pilih Klaim untuk Feedback');
  }

  async function deliverClaimFeedback(uuids) {
    const query = `
      mutation SandboxDeliverFeedback($input: DeliverClaimFeedbackMutationInput!) {
        deliverClaimFeedback(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Kirim Feedback Klaim');
  }

  async function deleteClaims(uuids) {
    const query = `
      mutation SandboxDeleteClaims($input: DeleteClaimsMutationInput!) {
        deleteClaims(input: $input) { clientMutationId }
      }
    `;
    return graphql(query, { input: { uuids } }, 'Hapus Klaim');
  }

  async function createClaimAttachment(input) {
    const query = `
      mutation SandboxCreateClaimAttachment($input: CreateClaimAttachmentMutationInput!) {
        createClaimAttachment(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Unggah Lampiran Klaim');
  }

  // ============================================================
  // LOCATION / HEALTH FACILITY
  // ============================================================

  async function getHealthFacilities(first = 40, filters = {}) {
    const query = `
      query SandboxHealthFacilities($first: Int, $level: String, $name: String, $status: HealthFacilityStatus) {
        healthFacilities(first: $first, level: $level, name_Icontains: $name, status: $status,
                         orderBy: ["code"]) {
          totalCount
          edges { node {
            id uuid code name level careType accCode status
            address phone fax email
            legalForm { code legalForm }
            location { id uuid code name type }
            servicesPricelist { id uuid name }
            itemsPricelist { id uuid name }
            contractStartDate contractEndDate
          } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      level: filters.level || undefined,
      name: filters.name || undefined,
      status: filters.status || undefined
    }, 'Daftar Faskes (healthFacilities)');
    return data.healthFacilities;
  }

  async function getLocations(first = 40, filters = {}) {
    // LocationGQLTypeConnection exposes only pageInfo + edges (no totalCount).
    const query = `
      query SandboxLocations($first: Int, $type: String, $name: String) {
        locations(first: $first, type: $type, name_Icontains: $name, orderBy: ["code"]) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            id uuid code name type
            parent { id uuid code name type }
          } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      type: filters.type || undefined,
      name: filters.name || undefined
    }, 'Daftar Wilayah (locations)');
    return data.locations;
  }

  async function getLocationsAll(first = 100) {
    const query = `query SandboxLocationsAll($first: Int) {
      locationsAll(first: $first) {
        edges { node { id uuid code name type parent { code name } } }
      }
    }`;
    const data = await graphql(query, { first }, 'Semua Wilayah');
    return data.locationsAll;
  }

  async function getUserDistricts() {
    const query = `query SandboxUserDistricts { userDistricts { id location { id uuid code name type } } }`;
    const data = await graphql(query, {}, 'Distrik Pengguna');
    return data.userDistricts || [];
  }

  async function validateHealthFacilityCode(code) {
    const query = `query SandboxValidateHF($code: String!) { validateHealthFacilityCode(healthFacilityCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Faskes');
    return data.validateHealthFacilityCode;
  }

  async function validateLocationCode(code) {
    const query = `query SandboxValidateLoc($code: String!) { validateLocationCode(locationCode: $code) }`;
    const data = await graphql(query, { code }, 'Validasi Kode Wilayah');
    return data.validateLocationCode;
  }

  async function createHealthFacility(input) {
    const query = `mutation SandboxCreateHF($input: CreateHealthFacilityMutationInput!) {
      createHealthFacility(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Daftarkan Faskes (createHealthFacility)');
  }

  async function updateHealthFacility(input) {
    const query = `mutation SandboxUpdateHF($input: UpdateHealthFacilityMutationInput!) {
      updateHealthFacility(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Perbarui Faskes');
  }

  async function deleteHealthFacility(uuid) {
    // DeleteHealthFacilityMutation.Input takes a single `uuid` (not `uuids`).
    const query = `mutation SandboxDeleteHF($input: DeleteHealthFacilityMutationInput!) {
      deleteHealthFacility(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { uuid } }, 'Hapus Faskes');
  }

  async function createLocation(input) {
    // LocationInputType: code, name, type (required); parent_uuid optional.
    const query = `mutation SandboxCreateLocation($input: CreateLocationMutationInput!) {
      createLocation(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Wilayah (createLocation)');
  }

  async function updateLocation(input) {
    const query = `mutation SandboxUpdateLocation($input: UpdateLocationMutationInput!) {
      updateLocation(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Perbarui Wilayah');
  }

  async function deleteLocation(uuid) {
    // DeleteLocationMutation.Input takes a single `uuid` (plus optional code/newParentUuid).
    const query = `mutation SandboxDeleteLocation($input: DeleteLocationMutationInput!) {
      deleteLocation(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { uuid } }, 'Hapus Wilayah');
  }

  // ============================================================
  // CONTRIBUTION / PREMIUM
  // ============================================================

  async function getPremiums(first = 30, filters = {}) {
    const query = `
      query SandboxPremiums($first: Int, $payerId: ID) {
        premiums(first: $first, payerId: $payerId, orderBy: ["-payDate"]) {
          totalCount
          edges { node {
            id uuid amount receipt payDate payType isPhotoFee isOffline
            policy { id uuid product { code name } family { headInsuree { chfId lastName } } }
            payer { id uuid name }
          } }
        }
      }
    `;
    const data = await graphql(query, { first, payerId: filters.payerId || undefined }, 'Daftar Premi (premiums)');
    return data.premiums;
  }

  async function getPremiumsByPolicies(policyUuids) {
    const query = `query SandboxPremiumsByPolicy($uuids: [String!]!) {
      premiumsByPolicies(policyUuids: $uuids, first: 100) {
        totalCount edges { node { id uuid amount receipt payDate payType } }
      }
    }`;
    const data = await graphql(query, { uuids: policyUuids }, 'Premi per Polis');
    return data.premiumsByPolicies;
  }

  async function validatePremiumCode(code, policyUuid) {
    const query = `query SandboxValidatePremium($code: String!, $policyUuid: String!) {
      validatePremiumCode(code: $code, policyUuid: $policyUuid)
    }`;
    const data = await graphql(query, { code, policyUuid }, 'Validasi Kode Premi');
    return data.validatePremiumCode;
  }

  async function createPremium(input) {
    const query = `mutation SandboxCreatePremium($input: CreatePremiumMutationInput!) {
      createPremium(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Catat Premi (createPremium)');
  }

  async function updatePremium(input) {
    const query = `mutation SandboxUpdatePremium($input: UpdatePremiumMutationInput!) {
      updatePremium(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Perbarui Premi');
  }

  async function deletePremiums(uuids) {
    const query = `mutation SandboxDeletePremiums($input: DeletePremiumsMutationInput!) {
      deletePremiums(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { uuids } }, 'Hapus Premi');
  }

  // ---- payer ----

  /**
   * `payer(uuid:)` and `funding(uuid:)` are single-object lookups in openIMIS
   * 26.04 � there is no payer/funding connection to page through.
   */
  async function getPayer(uuid) {
    const query = `query SandboxPayer($uuid: UUID) {
      payer(uuid: $uuid) { id uuid name type address phone email fundings { id uuid amount payDate status receipt } }
    }`;
    const data = await graphql(query, { uuid: uuid || undefined }, 'Detail Payer');
    return data.payer;
  }

  async function getFunding(uuid) {
    const query = `query SandboxFunding($uuid: UUID) {
      funding(uuid: $uuid) { id uuid amount payDate status receipt }
    }`;
    const data = await graphql(query, { uuid: uuid || undefined }, 'Detail Funding');
    return data.funding;
  }

  async function createPayer(input) {
    const query = `mutation SandboxCreatePayer($input: CreatePayerMutationInput!) {
      createPayer(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Buat Payer');
  }

  // ============================================================
  // GRIEVANCE / TICKET
  // ============================================================

  async function getTickets(first = 30, filters = {}) {
    const query = `
      query SandboxTickets($first: Int, $status: TicketStatus, $category: String) {
        tickets(first: $first, status: $status, category: $category, orderBy: ["-dateCreated"]) {
          totalCount
          edges { node {
            id code key title description
            status priority category flags channel resolution
            dateOfIncident dueDate dateCreated dateUpdated
            reporterFirstName reporterLastName
            accessLevel
          } }
        }
      }
    `;
    const data = await graphql(query, {
      first,
      status: filters.status || undefined,
      category: filters.category || undefined
    }, 'Daftar Tiket (tickets)');
    return data.tickets;
  }

  async function getTicketDetails(first = 30) {
    const query = `query SandboxTicketDetails($first: Int) {
      ticketDetails(first: $first) {
        totalCount edges { node { id code title status priority category description resolution } }
      }
    }`;
    const data = await graphql(query, { first }, 'Detail Tiket');
    return data.ticketDetails;
  }

  async function getComments(ticketUuid = null, first = 50) {
    // CommentGQLType exposes the FK as ticket__*, so the filter is ticket_Uuid.
    const query = `query SandboxComments($first: Int, $ticketUuid: String) {
      comments(first: $first, ticket_Uuid: $ticketUuid, orderBy: ["dateCreated"]) {
        totalCount edges { node { id comment isResolution dateCreated } }
      }
    }`;
    const data = await graphql(query, { first, ticketUuid: ticketUuid || undefined }, 'Komentar Tiket');
    return data.comments;
  }

  async function getGrievanceConfig() {
    // grievanceTypes / grievanceFlags / grievanceChannels are [String].
    // The *Detailed variants expose objects when richer data is needed.
    const query = `query SandboxGrievanceConfig {
      grievanceConfig {
        grievanceTypes
        grievanceFlags
        grievanceChannels
        grievanceCategoriesHierarchical { name fullName priority }
        grievanceFlagsDetailed { name priority }
      }
    }`;
    const data = await graphql(query, {}, 'Konfigurasi Grievance');
    return data.grievanceConfig;
  }

  async function createTicket(input) {
    const query = `
      mutation SandboxCreateTicket($input: CreateTicketMutationInput!) {
        createTicket(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Buat Tiket (createTicket)');
  }

  async function updateTicket(input) {
    // UpdateTicketInputType extends CreateTicketInputType and adds `id` (UUID, required).
    const query = `
      mutation SandboxUpdateTicket($input: UpdateTicketMutationInput!) {
        updateTicket(input: $input) { clientMutationId internalId }
      }
    `;
    return graphql(query, { input }, 'Perbarui Tiket');
  }

  async function deleteTicket(uuid) {
    // DeleteTicketMutation.Input uses `ids` (list of UUID), not `uuids`.
    const query = `mutation SandboxDeleteTicket($input: DeleteTicketMutationInput!) {
      deleteTicket(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { ids: [uuid] } }, 'Hapus Tiket');
  }

  async function createComment(input) {
    // CreateCommentInputType: ticket_id (UUID!), comment (String!), commenter_type, commenter_id
    const query = `mutation SandboxCreateComment($input: CreateCommentMutationInput!) {
      createComment(input: $input) { clientMutationId internalId }
    }`;
    return graphql(query, { input }, 'Tambah Komentar Tiket');
  }

  /**
   * ResolveGrievanceByComment takes the uuid of the Comment it creates/marks
   * as the resolution, not the ticket uuid.
   */
  async function resolveGrievanceByComment(commentId) {
    const query = `mutation SandboxResolveGrievance($input: ResolveGrievanceByCommentMutationInput!) {
      resolveGrievanceByComment(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { id: commentId } }, 'Selesaikan Tiket');
  }

  async function reopenTicket(ticketId) {
    // ReopenTicketMutation.Input requires `id` (the Ticket UUID).
    const query = `mutation SandboxReopenTicket($input: ReopenTicketMutationInput!) {
      reopenTicket(input: $input) { clientMutationId }
    }`;
    return graphql(query, { input: { id: ticketId } }, 'Buka Ulang Tiket');
  }

  // ============================================================
  // CATALOG-ONLY MODULES
  // (implemented so the API Catalog + Playground can exercise them)
  // ============================================================

  async function getContributionPlans(first = 25) {
    const query = `query SandboxContributionPlans($first: Int) {
      contributionPlan(first: $first) {
        totalCount edges { node { id uuid code name isDeleted
          calculationRule { uuid code name } benefitPlan { uuid code name } } }
      }
    }`;
    const data = await graphql(query, { first }, 'Contribution Plan');
    return data.contributionPlan;
  }

  async function getPaymentPlans(first = 25) {
    const query = `query SandboxPaymentPlans($first: Int) {
      paymentPlan(first: $first) { totalCount edges { node { id uuid code name } } }
    }`;
    const data = await graphql(query, { first }, 'Payment Plan');
    return data.paymentPlan;
  }

  async function getContributionPlanBundles(first = 25) {
    const query = `query SandboxCPBundles($first: Int) {
      contributionPlanBundle(first: $first) {
        totalCount edges { node { id uuid code name } }
      }
    }`;
    const data = await graphql(query, { first }, 'Contribution Plan Bundle');
    return data.contributionPlanBundle;
  }

  async function getPayments(first = 25) {
    const query = `query SandboxPayments($first: Int) {
      payments(first: $first) { totalCount edges { node { id uuid } } }
    }`;
    const data = await graphql(query, { first }, 'Daftar Payment');
    return data.payments;
  }

  async function getBatchRuns(first = 25) {
    const query = `query SandboxBatchRuns($first: Int) {
      batchRuns(first: $first) { totalCount edges { node { id uuid } } }
    }`;
    const data = await graphql(query, { first }, 'Batch Run Klaim');
    return data.batchRuns;
  }


  async function getIndividuals(first = 25) {
    const query = `query SandboxIndividuals($first: Int) {
      individual(first: $first) { totalCount edges { node { id uuid firstName lastName } } }
    }`;
    const data = await graphql(query, { first }, 'Individual (modul individual)');
    return data.individual;
  }

  async function getBenefitPlans(first = 25) {
    const query = `query SandboxBenefitPlans($first: Int) {
      benefitPlan(first: $first) { totalCount edges { node { id uuid code name } } }
    }`;
    const data = await graphql(query, { first }, 'Benefit Plan');
    return data.benefitPlan;
  }

  // ============================================================
  // Public surface
  // ============================================================

  return {
    // transport
    graphql,
    fhir,
    connection,
    varsDecl,
    introspectSchema,
    getLastOperation: () => lastOperation,

    // auth / session
    getToken: () => token,
    getRefreshToken: () => refreshToken,
    getCurrentUser: () => currentUser,
    // A stored token that has already expired is not a usable session.
    isAuthenticated: () => !!token && !isTokenStale(0),
    isTokenStale,
    tokenSecondsLeft,
    reauthenticate,
    getCredentials: () => (credentials ? { username: credentials.username } : null),
    getHistory: () => apiHistory,
    on: fn => listeners.push(fn),
    login,
    refreshSession,
    logout,
    checkHealth,

    // core
    getCurrentUserProfile: getCurrentUser,
    getModuleConfigurations,
    getLanguages,
    getPasswordPolicy,
    getUsers,
    getRoles,
    getRoleRights,
    getClaimAdmins,
    getEnrolmentOfficers,
    getMutationLogs,
    getModulesPermissions,
    changePassword,
    createUser,
    updateUser,
    deleteUsers,

    // insuree
    getInsurees,
    getInsureeByUuid,
    checkInsureeNumber,
    canAddInsuree,
    createInsuree,
    updateInsuree,
    deleteInsurees,
    removeInsurees,
    getFamilies,
    getFamilyMembers,
    createFamily,
    updateFamily,
    deleteFamilies,
    setFamilyHead,
    changeInsureeFamily,
    getInsureeGenders,
    getRelations,
    getFamilyTypes,
    getConfirmationTypes,
    getProfessions,
    getEducations,
    getIdentificationTypes,
    getInsureeStatusReasons,

    // policy
    getPolicies,
    getPoliciesByInsuree,
    getPoliciesByFamily,
    checkEligibility,
    checkItemEligibility,
    checkServiceEligibility,
    getPolicyValues,
    createPolicy,
    updatePolicy,
    renewPolicy,
    suspendPolicies,
    deletePolicies,

    // product
    getProducts,
    getProductByCode,
    validateProductCode,
    createProduct,
    updateProduct,
    duplicateProduct,
    deleteProduct,

    // medical
    getDiagnoses,
    getMedicalItems,
    getMedicalServices,
    validateItemCode,
    validateServiceCode,
    createItem,
    updateItem,
    deleteItem,
    createService,
    updateService,
    deleteService,
    getItemsPricelists,
    getServicesPricelists,
    createItemsPricelist,
    createServicesPricelist,

    // claim
    getClaims,
    getClaim,
    getClaimHistory,
    getClaimAttachments,
    getInsureeNameByChfid,
    validateClaimCode,
    createClaim,
    updateClaim,
    submitClaims,
    selectClaimsForReview,
    saveClaimReview,
    deliverClaimsReview,
    bypassClaimsReview,
    skipClaimsReview,
    processClaims,
    selectClaimsForFeedback,
    deliverClaimFeedback,
    deleteClaims,
    createClaimAttachment,

    // location
    getHealthFacilities,
    getLocations,
    getLocationsAll,
    getUserDistricts,
    validateHealthFacilityCode,
    validateLocationCode,
    createHealthFacility,
    updateHealthFacility,
    deleteHealthFacility,
    createLocation,
    updateLocation,
    deleteLocation,

    // contribution
    getPremiums,
    getPremiumsByPolicies,
    validatePremiumCode,
    createPremium,
    updatePremium,
    deletePremiums,
    getPayer,
    createPayer,

    // grievance
    getTickets,
    getTicketDetails,
    getComments,
    getGrievanceConfig,
    createTicket,
    updateTicket,
    deleteTicket,
    createComment,
    resolveGrievanceByComment,
    reopenTicket,

    // catalog-only
    getContributionPlans,
    getPaymentPlans,
    getContributionPlanBundles,
    getPayments,
    getBatchRuns,
    getFunding,
    getIndividuals,
    getBenefitPlans
  };
})();

window.OpenIMISApi = OpenIMISApi;
