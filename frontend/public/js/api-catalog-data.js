// ============================================================
// Static catalog of openIMIS 26.04 GraphQL operations + FHIR R4
// resources. Derived from the release/26.04 module manifest and
// the schema.py / gql_queries.py / gql_mutations.py of each module.
//
// `status`:
//   'ui'      -> exercised by a page in this sandbox
//   'catalog' -> documented + runnable from the Playground only
// ============================================================
const ApiCatalog = (function () {
  const MODULES = [
    { key: 'core', label: 'Core (Auth, User, Role)', color: 'slate' },
    { key: 'insuree', label: 'Insuree & Family', color: 'blue' },
    { key: 'policy', label: 'Policy', color: 'amber' },
    { key: 'product', label: 'Product', color: 'orange' },
    { key: 'medical', label: 'Medical Catalog', color: 'teal' },
    { key: 'medical_pricelist', label: 'Medical Pricelist', color: 'teal' },
    { key: 'claim', label: 'Claim & Adjudication', color: 'emerald' },
    { key: 'claim_batch', label: 'Claim Batch', color: 'emerald' },
    { key: 'location', label: 'Location & Health Facility', color: 'cyan' },
    { key: 'contribution', label: 'Contribution / Premium', color: 'purple' },
    { key: 'payer', label: 'Payer & Funding', color: 'purple' },
    { key: 'contribution_plan', label: 'Contribution Plan', color: 'violet' },
    { key: 'payment', label: 'Payment', color: 'violet' },
    { key: 'invoice', label: 'Invoice & Bill', color: 'violet' },
    { key: 'contract', label: 'Contract', color: 'indigo' },
    { key: 'policyholder', label: 'Policy Holder', color: 'indigo' },
    { key: 'grievance_social_protection', label: 'Grievance / Ticket', color: 'rose' },
    { key: 'tasks_management', label: 'Tasks Management', color: 'rose' },
    { key: 'individual', label: 'Individual (social registry)', color: 'stone' },
    { key: 'social_protection', label: 'Social Protection', color: 'stone' },
    { key: 'payment_cycle', label: 'Payment Cycle', color: 'stone' },
    { key: 'payroll', label: 'Payroll', color: 'stone' },
    { key: 'deduplication', label: 'Deduplication', color: 'stone' },
    { key: 'controls', label: 'Controls', color: 'stone' },
    { key: 'fhir_r4', label: 'HL7 FHIR R4 (REST)', color: 'orange' }
  ];

  // ---------------------------------------------------------
  // GraphQL operations
  // ---------------------------------------------------------
  const OPERATIONS = [
    // ---------------- CORE ----------------
    {
      module: 'core', kind: 'mutation', name: 'tokenAuth', status: 'ui',
      signature: 'tokenAuth(username: String!, password: String!) -> TokenPayload',
      note: 'Satu-satunya cara mendapatkan JWT. Dipakai halaman login & auto-login.',
      example: `mutation Login($username: String!, $password: String!) {
  tokenAuth(username: $username, password: $password) {
    token
    refreshToken
    payload
    refreshExpiresIn
  }
}`,
      variables: { username: 'Admin', password: 'admin123' }
    },
    {
      module: 'core', kind: 'mutation', name: 'refreshToken', status: 'catalog',
      signature: 'refreshToken(refreshToken: String!) -> RefreshPayload',
      note: 'Memperpanjang sesi tanpa login ulang.',
      example: `mutation Refresh($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) { token refreshToken }
}`,
      variables: { refreshToken: '<refresh-token>' }
    },
    {
      module: 'core', kind: 'mutation', name: 'verifyToken', status: 'catalog',
      signature: 'verifyToken(token: String!) -> VerifyPayload',
      note: 'Mengecek apakah sebuah JWT masih valid.',
      example: `mutation Verify($token: String!) { verifyToken(token: $token) { payload } }`,
      variables: { token: '<jwt>' }
    },
    {
      module: 'core', kind: 'mutation', name: 'revokeToken', status: 'catalog',
      signature: 'revokeToken(refreshToken: String!) -> RevokePayload',
      note: 'Mencabut refresh token (logout server-side).',
      example: `mutation Revoke($refreshToken: String!) { revokeToken(refreshToken: $refreshToken) { revoked } }`,
      variables: { refreshToken: '<refresh-token>' }
    },
    {
      module: 'core', kind: 'query', name: 'user', status: 'ui',
      signature: 'user -> UserGQLType',
      note: 'Profil pengguna yang sedang login. Nama field-nya `user`, bukan `currentUser`.',
      example: `query Me {
  user { id username lastName otherNames email phone language { code name } }
}`,
      variables: {}
    },
    {
      module: 'core', kind: 'query', name: 'moduleConfigurations', status: 'ui',
      signature: 'moduleConfigurations(validity: String, layer: String) -> [ModuleConfigurationGQLType]',
      note: 'Konfigurasi & versi setiap modul yang aktif. Berguna untuk cek instalasi.',
      example: `query Modules {
  moduleConfigurations { module layer config version isExposed }
}`,
      variables: {}
    },
    {
      module: 'core', kind: 'query', name: 'languages', status: 'ui',
      signature: 'languages -> [LanguageGQLType]',
      note: 'Bahasa yang tersedia.',
      example: `query Languages { languages { code name sortOrder } }`,
      variables: {}
    },
    {
      module: 'core', kind: 'query', name: 'passwordPolicy', status: 'ui',
      signature: 'passwordPolicy -> JSONString',
      note: 'Aturan kekuatan password yang berlaku.',
      example: `query PasswordPolicy {
  passwordPolicy { minLength requireUpperCase requireLowerCase requireNumbers requireSpecialCharacters }
}`,
      variables: {}
    },
    {
      module: 'core', kind: 'query', name: 'users', status: 'ui',
      signature: 'users(first, str, orderBy, ...) -> UserConnection',
      note: 'Daftar pengguna sistem (butuh hak gql_query_users_perms).',
      example: `query Users($first: Int) {
  users(first: $first, orderBy: ["username"]) {
    totalCount
    edges { node { id username lastName otherNames email phone } }
  }
}`,
      variables: { first: 25 }
    },
    {
      module: 'core', kind: 'query', name: 'role', status: 'ui',
      signature: 'role(first, orderBy) -> RoleConnection',
      note: 'Daftar role & hak akses.',
      example: `query Roles($first: Int) {
  role(first: $first) { totalCount edges { node { id uuid name isSystem isBlocked } } }
}`,
      variables: { first: 50 }
    },
    {
      module: 'core', kind: 'query', name: 'roleRight', status: 'ui',
      signature: 'roleRight -> RoleRightConnection',
      note: 'Daftar hak akses granular.',
      example: `query RoleRights { roleRight { edges { node { id rightId } } } }`,
      variables: {}
    },
    {
      module: 'core', kind: 'query', name: 'claimAdmins', status: 'ui',
      signature: 'claimAdmins(first, districtUuid, regionUuid) -> ClaimAdminConnection',
      note: 'Petugas verifikator klaim.',
      example: `query ClaimAdmins($first: Int) {
  claimAdmins(first: $first) {
    edges { node { id code lastName otherNames healthFacility { code name } } }
  }
}`,
      variables: { first: 50 }
    },
    {
      module: 'core', kind: 'query', name: 'enrolmentOfficers', status: 'ui',
      signature: 'enrolmentOfficers(first, str) -> OfficerConnection',
      note: 'Petugas pendaftaran/polis.',
      example: `query Officers($first: Int) {
  enrolmentOfficers(first: $first) { edges { node { id code lastName otherNames phone } } }
}`,
      variables: { first: 50 }
    },
    {
      module: 'core', kind: 'query', name: 'mutationLogs', status: 'ui',
      signature: 'mutationLogs(first, orderBy) -> MutationLogConnection',
      note: 'Jejak audit semua mutation. openIMIS memproses mutation secara asinkron dan mencatatnya di sini.',
      example: `query MutationLogs($first: Int) {
  mutationLogs(first: $first) {
    totalCount edges { node { id clientMutationId clientMutationLabel status } }
  }
}`,
      variables: { first: 25 }
    },
    {
      module: 'core', kind: 'query', name: 'modulesPermissions', status: 'ui',
      signature: 'modulesPermissions -> ModulePermissionsListGQLType',
      note: 'Seluruh permission per modul (untuk membangun UI role).',
      example: `query ModulePerms {
  modulesPermissions { modulePermsList { moduleName permissions { permsName permsValue } } }
}`,
      variables: {}
    },
    {
      module: 'core', kind: 'mutation', name: 'changePassword', status: 'ui',
      signature: 'changePassword(oldPassword: String, newPassword: String!, username: String) -> { success error }',
      note: 'Ganti password sendiri, atau paksa ganti untuk user lain bila punya hak.',
      example: `mutation ChangePassword($old: String, $new: String!) {
  changePassword(oldPassword: $old, newPassword: $new) { success error }
}`,
      variables: { old: 'admin123', new: 'PasswordBaru123!' }
    },
    {
      module: 'core', kind: 'mutation', name: 'createUser', status: 'catalog',
      signature: 'createUser(input: CreateUserMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat user + sub-tipe (interactive/officer/claim admin) sekaligus.',
      example: `mutation CreateUser($input: CreateUserMutationInput!) {
  createUser(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'create-user-1',
          username: 'petugas01', otherNames: 'Petugas', lastName: 'Klaim',
          email: 'petugas01@example.org', language: 'en',
          userTypes: ['INTERACTIVE'], roles: [1], password: 'Password123!'
        }
      }
    },
    {
      module: 'core', kind: 'mutation', name: 'updateUser', status: 'catalog',
      signature: 'updateUser(input: UpdateUserMutationInput!) -> { clientMutationId internalId }',
      note: 'Memperbarui user.',
      example: `mutation UpdateUser($input: UpdateUserMutationInput!) {
  updateUser(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'upd-user-1', uuid: '<user-uuid>', userTypes: ['INTERACTIVE'] } }
    },
    {
      module: 'core', kind: 'mutation', name: 'deleteUser', status: 'catalog',
      signature: 'deleteUser(input: DeleteUserMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete user (menyimpan histori).',
      example: `mutation DeleteUser($input: DeleteUserMutationInput!) {
  deleteUser(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'del-user-1', uuids: ['<user-uuid>'] } }
    },
    {
      module: 'core', kind: 'mutation', name: 'createRole', status: 'catalog',
      signature: 'createRole(input: CreateRoleMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat role beserta daftar right-nya.',
      example: `mutation CreateRole($input: CreateRoleMutationInput!) {
  createRole(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'role-1', name: 'Verifikator Klaim', isSystem: false, isBlocked: false, rightsId: [1, 2] } }
    },

    // ---------------- INSUREE ----------------
    {
      module: 'insuree', kind: 'query', name: 'insurees', status: 'ui',
      signature: 'insurees(first, chfId, lastName, otherNames, gender_Code, status, orderBy, ...) -> InsureeConnection',
      note: 'Sumber data utama halaman Pasien. Filter memakai snake_case + suffix operator (chfId, lastName, gender_Code).',
      example: `query Insurees($first: Int) {
  insurees(first: $first, orderBy: ["lastName"]) {
    totalCount
    edges { node {
      id chfId lastName otherNames dob age head phone
      gender { code }
      family { id address }
      healthFacility { code name }
    } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'insuree', kind: 'query', name: 'families', status: 'ui',
      signature: 'families(first, confirmationNo, address, orderBy, ...) -> FamilyConnection',
      note: 'Kartu Keluarga. Satu keluarga menaungi banyak insuree.',
      example: `query Families($first: Int) {
  families(first: $first) {
    totalCount
    edges { node {
      id uuid address poverty
      headInsuree { chfId lastName otherNames }
      location { code name }
    } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'insuree', kind: 'query', name: 'familyMembers', status: 'ui',
      signature: 'familyMembers(first, familyUuid: String!) -> InsureeConnection',
      note: 'Anggota sebuah keluarga.',
      example: `query FamilyMembers($familyUuid: String!) {
  familyMembers(first: 50, familyUuid: $familyUuid) {
    edges { node { chfId lastName otherNames head gender { code } relationship { relationship } } }
  }
}`,
      variables: { familyUuid: '<family-uuid>' }
    },
    {
      module: 'insuree', kind: 'query', name: 'insureeNumberValidity', status: 'ui',
      signature: 'insureeNumberValidity(insureeNumber: String!) -> { isValid }',
      note: 'Validasi format & keunikan nomor kartu sebelum simpan.',
      example: `query ChfValidity($insureeNumber: String!) { insureeNumberValidity(insureeNumber: $insureeNumber) { isValid } }`,
      variables: { insureeNumber: '070707070' }
    },
    {
      module: 'insuree', kind: 'query', name: 'canAddInsuree', status: 'ui',
      signature: 'canAddInsuree(familyId: Int!) -> [String]',
      note: 'Cek apakah keluarga masih boleh menambah anggota (batas maxMembers produk).',
      example: `query CanAdd($familyId: Int!) { canAddInsuree(familyId: $familyId) }`,
      variables: { familyId: 1 }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'createInsuree', status: 'ui',
      signature: 'createInsuree(input: CreateInsureeMutationInput!) -> { clientMutationId internalId }',
      note: 'Field WAJIB: lastName, otherNames, genderId, dob. chfId opsional bila auto-generate.',
      example: `mutation CreateInsuree($input: CreateInsureeMutationInput!) {
  createInsuree(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'insuree-1',
          chfId: '900000001', lastName: 'Pratama', otherNames: 'Budi',
          genderId: 'M', dob: '1995-05-15', head: true, cardIssued: false
        }
      }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'updateInsuree', status: 'ui',
      signature: 'updateInsuree(input: UpdateInsureeMutationInput!) -> { clientMutationId internalId }',
      note: 'Perlu `uuid` + `id`. Field yang tidak dikirim akan dianggap null oleh Graphene.',
      example: `mutation UpdateInsuree($input: UpdateInsureeMutationInput!) {
  updateInsuree(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'upd-insuree-1', uuid: '<insuree-uuid>', lastName: 'Pratama', otherNames: 'Budi', genderId: 'M', dob: '1995-05-15', phone: '08123456789' } }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'deleteInsurees', status: 'ui',
      signature: 'deleteInsurees(input: DeleteInsureesMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete peserta.',
      example: `mutation DeleteInsurees($input: DeleteInsureesMutationInput!) {
  deleteInsurees(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'del-insuree-1', uuids: ['<insuree-uuid>'] } }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'removeInsurees', status: 'ui',
      signature: 'removeInsurees(input: RemoveInsureesMutationInput!) -> { clientMutationId }',
      note: 'Mengeluarkan peserta dari keluarga (bukan menghapus).',
      example: `mutation RemoveInsurees($input: RemoveInsureesMutationInput!) {
  removeInsurees(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'rm-insuree-1', uuids: ['<insuree-uuid>'] } }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'createFamily', status: 'ui',
      signature: 'createFamily(input: CreateFamilyMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat keluarga sekaligus kepala keluarga (headInsuree).',
      example: `mutation CreateFamily($input: CreateFamilyMutationInput!) {
  createFamily(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'family-1', locationId: 1, poverty: false, familyTypeId: 'H',
          address: 'Jl. Contoh No. 1',
          headInsuree: { chfId: '900000002', lastName: 'Santoso', otherNames: 'Ani', genderId: 'F', dob: '1988-02-02', head: true }
        }
      }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'updateFamily', status: 'ui',
      signature: 'updateFamily(input: UpdateFamilyMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui data keluarga.',
      example: `mutation UpdateFamily($input: UpdateFamilyMutationInput!) {
  updateFamily(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'upd-family-1', uuid: '<family-uuid>', address: 'Jl. Baru No. 2' } }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'setFamilyHead', status: 'ui',
      signature: 'setFamilyHead(input: SetFamilyHeadMutationInput!) -> { clientMutationId }',
      note: 'Memindahkan status kepala keluarga ke anggota lain.',
      example: `mutation SetHead($input: SetFamilyHeadMutationInput!) {
  setFamilyHead(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'head-1', uuid: '<family-uuid>', insureeUuid: '<insuree-uuid>' } }
    },
    {
      module: 'insuree', kind: 'mutation', name: 'changeInsureeFamily', status: 'ui',
      signature: 'changeInsureeFamily(input: ChangeInsureeFamilyMutationInput!) -> { clientMutationId }',
      note: 'Memindahkan peserta ke keluarga lain.',
      example: `mutation ChangeFamily($input: ChangeInsureeFamilyMutationInput!) {
  changeInsureeFamily(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'chg-fam-1', insureeUuid: '<insuree-uuid>', familyUuid: '<family-uuid>' } }
    },
    {
      module: 'insuree', kind: 'query', name: 'insureeGenders', status: 'ui',
      signature: 'insureeGenders -> [GenderGQLType]',
      note: 'Referensi gender (M/F).', example: `query Genders { insureeGenders { id code gender } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'relations', status: 'ui',
      signature: 'relations -> [RelationGQLType]',
      note: 'Referensi hubungan keluarga.', example: `query Relations { relations { id relationship } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'familyTypes', status: 'ui',
      signature: 'familyTypes -> [FamilyTypeGQLType]',
      note: 'Referensi tipe keluarga.', example: `query FamilyTypes { familyTypes { id code familyType } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'confirmationTypes', status: 'ui',
      signature: 'confirmationTypes -> [ConfirmationTypeGQLType]',
      note: 'Referensi tipe konfirmasi.', example: `query ConfTypes { confirmationTypes { id code confirmationType } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'professions', status: 'ui',
      signature: 'professions -> [ProfessionGQLType]',
      note: 'Referensi profesi.', example: `query Professions { professions { id code profession } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'educations', status: 'ui',
      signature: 'educations -> [EducationGQLType]',
      note: 'Referensi pendidikan.', example: `query Educations { educations { id code education } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'identificationTypes', status: 'ui',
      signature: 'identificationTypes -> [IdentificationTypeGQLType]',
      note: 'Referensi tipe identitas.', example: `query IdTypes { identificationTypes { id code name } }`, variables: {}
    },
    {
      module: 'insuree', kind: 'query', name: 'insureeStatusReasons', status: 'ui',
      signature: 'insureeStatusReasons(first, str) -> Connection',
      note: 'Alasan perubahan status peserta.',
      example: `query StatusReasons { insureeStatusReasons(first: 50) { edges { node { id code name } } } }`,
      variables: {}
    },

    // ---------------- POLICY ----------------
    {
      module: 'policy', kind: 'query', name: 'policies', status: 'ui',
      signature: 'policies(first, status, product_Code, orderBy, ...) -> PolicyConnection',
      note: 'Status: 1 Idle, 2 Active, 4 Suspended, 8 Expired, 16 Ready.',
      example: `query Policies($first: Int) {
  policies(first: $first, orderBy: ["-startDate"]) {
    totalCount
    edges { node {
      id uuid status startDate expiryDate value ceiling balance
      product { code name }
      family { headInsuree { chfId lastName } }
    } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'policy', kind: 'query', name: 'policiesByInsuree', status: 'ui',
      signature: 'policiesByInsuree(chfId: String!, activeOrLastExpiredOnly: Boolean) -> Connection',
      note: 'Polis milik seorang peserta. Bentuk node berbeda dari `policies` (flat, bukan nested).',
      example: `query PoliciesByInsuree($chfId: String!) {
  policiesByInsuree(chfId: $chfId) {
    edges { node { policyId productCode productName status startDate expiryDate balance ceiling } }
  }
}`,
      variables: { chfId: '070707070' }
    },
    {
      module: 'policy', kind: 'query', name: 'policiesByFamily', status: 'ui',
      signature: 'policiesByFamily(familyUuid: String!) -> Connection',
      note: 'Polis milik sebuah keluarga (pakai uuid, bukan id).',
      example: `query PoliciesByFamily($familyUuid: String!) {
  policiesByFamily(familyUuid: $familyUuid) { edges { node { policyId productName status expiryDate } } }
}`,
      variables: { familyUuid: '<family-uuid>' }
    },
    {
      module: 'policy', kind: 'query', name: 'policyEligibilityByInsuree', status: 'ui',
      signature: 'policyEligibilityByInsuree(chfId: String!) -> EligibilityGQLType',
      note: 'Inti "cek SEP" versi openIMIS: sisa kunjungan, sisa plafon, isServiceOk / isItemOk.',
      example: `query Eligibility($chfId: String!) {
  policyEligibilityByInsuree(chfId: $chfId) {
    prodId totalVisitsLeft totalConsultationsLeft
    serviceLeft itemLeft isServiceOk isItemOk
    minDateService minDateItem
  }
}`,
      variables: { chfId: '070707070' }
    },
    {
      module: 'policy', kind: 'query', name: 'policyItemEligibilityByInsuree', status: 'ui',
      signature: 'policyItemEligibilityByInsuree(chfId, itemCode, serviceDate, qty) -> EligibilityGQLType',
      note: 'Eligibilitas satu obat tertentu.',
      example: `query ItemElig($chfId: String!, $itemCode: String!) {
  policyItemEligibilityByInsuree(chfId: $chfId, itemCode: $itemCode) { prodId isItemOk itemLeft minDateItem }
}`,
      variables: { chfId: '070707070', itemCode: 'I001' }
    },
    {
      module: 'policy', kind: 'query', name: 'policyServiceEligibilityByInsuree', status: 'ui',
      signature: 'policyServiceEligibilityByInsuree(chfId, serviceCode, serviceDate, qty) -> EligibilityGQLType',
      note: 'Eligibilitas satu tindakan tertentu.',
      example: `query SvcElig($chfId: String!, $serviceCode: String!) {
  policyServiceEligibilityByInsuree(chfId: $chfId, serviceCode: $serviceCode) { prodId isServiceOk serviceLeft minDateService }
}`,
      variables: { chfId: '070707070', serviceCode: 'S001' }
    },
    {
      module: 'policy', kind: 'mutation', name: 'createPolicy', status: 'ui',
      signature: 'createPolicy(input: CreatePolicyMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: enrollDate, startDate, expiryDate, value, productId, familyId, officerId.',
      example: `mutation CreatePolicy($input: CreatePolicyMutationInput!) {
  createPolicy(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'policy-1', enrollDate: '2026-01-01', startDate: '2026-01-01',
          expiryDate: '2027-01-01', value: '150000', productId: 1, familyId: 1, officerId: 1, isPaid: false
        }
      }
    },
    {
      module: 'policy', kind: 'mutation', name: 'renewPolicy', status: 'ui',
      signature: 'renewPolicy(input: RenewPolicyMutationInput!) -> { clientMutationId internalId }',
      note: 'Memperpanjang polis (stage = R).',
      example: `mutation RenewPolicy($input: RenewPolicyMutationInput!) {
  renewPolicy(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'renew-1', enrollDate: '2027-01-01', startDate: '2027-01-01', expiryDate: '2028-01-01', value: '150000', productId: 1, familyId: 1, officerId: 1 } }
    },
    {
      module: 'policy', kind: 'mutation', name: 'updatePolicy', status: 'ui',
      signature: 'updatePolicy(input: UpdatePolicyMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui polis.', example: `mutation UpdatePolicy($input: UpdatePolicyMutationInput!) { updatePolicy(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-policy-1', uuid: '<policy-uuid>', enrollDate: '2026-01-01', startDate: '2026-01-01', expiryDate: '2027-06-30', value: '150000', productId: 1, familyId: 1, officerId: 1 } }
    },
    {
      module: 'policy', kind: 'mutation', name: 'suspendPolicies', status: 'ui',
      signature: 'suspendPolicies(input: SuspendPoliciesMutationInput!) -> { clientMutationId }',
      note: 'Menonaktifkan sementara polis.',
      example: `mutation Suspend($input: SuspendPoliciesMutationInput!) { suspendPolicies(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'susp-1', uuids: ['<policy-uuid>'] } }
    },
    {
      module: 'policy', kind: 'mutation', name: 'deletePolicies', status: 'ui',
      signature: 'deletePolicies(input: DeletePoliciesMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete polis.', example: `mutation DeletePolicies($input: DeletePoliciesMutationInput!) { deletePolicies(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-policy-1', uuids: ['<policy-uuid>'] } }
    },

    // ---------------- PRODUCT ----------------
    {
      module: 'product', kind: 'query', name: 'products', status: 'ui',
      signature: 'products(first, orderBy, ...) -> ProductConnection',
      note: 'Katalog paket jaminan.',
      example: `query Products($first: Int) {
  products(first: $first, orderBy: ["code"]) {
    totalCount
    edges { node { id code name lumpSum maxMembers maxInstallments threshold insurancePeriod premiumAdult premiumChild } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'product', kind: 'query', name: 'product', status: 'ui',
      signature: 'product(code: String, uuid: String, id: Int) -> ProductGQLType',
      note: 'Detail produk beserta daftar layanan/obat yang dijamin.',
      example: `query Product($code: String!) {
  product(code: $code) {
    id code name lumpSum maxInstallments threshold
    productServices { id service { code name price } }
    productItems { id item { code name price } }
  }
}`,
      variables: { code: '<product-code>' }
    },
    {
      module: 'product', kind: 'query', name: 'validateProductCode', status: 'ui',
      signature: 'validateProductCode(productCode: String!) -> Boolean',
      note: 'Cek keunikan kode produk.',
      example: `query ValidateProduct($code: String!) { validateProductCode(productCode: $code) }`,
      variables: { code: 'NEWPROD' }
    },
    {
      module: 'product', kind: 'mutation', name: 'createProduct', status: 'ui',
      signature: 'createProduct(input: CreateProductMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: code, name, dateFrom, dateTo, insurancePeriod, lumpSum, maxMembers.',
      example: `mutation CreateProduct($input: CreateProductMutationInput!) {
  createProduct(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'prod-1', code: 'JKN01', name: 'JKN Kelas III',
          dateFrom: '2026-01-01', dateTo: '2030-12-31',
          insurancePeriod: 12, lumpSum: '1200000', maxMembers: 10, maxInstallments: 12, threshold: 0
        }
      }
    },
    {
      module: 'product', kind: 'mutation', name: 'updateProduct', status: 'ui',
      signature: 'updateProduct(input: UpdateProductMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui produk.', example: `mutation UpdateProduct($input: UpdateProductMutationInput!) { updateProduct(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-prod-1', uuid: '<product-uuid>', code: 'JKN01', name: 'JKN Kelas III (rev)', dateFrom: '2026-01-01', dateTo: '2030-12-31', insurancePeriod: 12, lumpSum: '1200000', maxMembers: 10 } }
    },
    {
      module: 'product', kind: 'mutation', name: 'duplicateProduct', status: 'ui',
      signature: 'duplicateProduct(input: DuplicateProductMutationInput!) -> { clientMutationId internalId }',
      note: 'Duplikat produk sebagai basis produk baru.',
      example: `mutation DupProduct($input: DuplicateProductMutationInput!) { duplicateProduct(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'dup-prod-1', uuid: '<product-uuid>', code: 'JKN01B', name: 'Salinan JKN Kelas III', dateFrom: '2026-01-01', dateTo: '2030-12-31', insurancePeriod: 12, lumpSum: '1200000', maxMembers: 10 } }
    },
    {
      module: 'product', kind: 'mutation', name: 'deleteProduct', status: 'ui',
      signature: 'deleteProduct(input: DeleteProductMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete produk.', example: `mutation DeleteProduct($input: DeleteProductMutationInput!) { deleteProduct(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-prod-1', uuids: ['<product-uuid>'] } }
    },

    // ---------------- MEDICAL ----------------
    {
      module: 'medical', kind: 'query', name: 'diagnoses', status: 'ui',
      signature: 'diagnoses(first, code, name, orderBy) -> DiagnosisConnection',
      note: 'Kamus ICD-10.',
      example: `query Diagnoses($first: Int) {
  diagnoses(first: $first, orderBy: ["code"]) { totalCount edges { node { id code name } } }
}`,
      variables: { first: 20 }
    },
    {
      module: 'medical', kind: 'query', name: 'diagnosesStr', status: 'ui',
      signature: 'diagnosesStr(str: String) -> DiagnosisConnection',
      note: 'Pencarian bebas pada kode & nama diagnosis.',
      example: `query DiagnosesStr($str: String) {
  diagnosesStr(str: $str, first: 20) { edges { node { code name } } }
}`,
      variables: { str: 'demam' }
    },
    {
      module: 'medical', kind: 'query', name: 'medicalItems', status: 'ui',
      signature: 'medicalItems(first, pricelistUuid, orderBy) -> ItemConnection',
      note: 'Formularium obat & alkes.',
      example: `query Items($first: Int) {
  medicalItems(first: $first, orderBy: ["code"]) {
    totalCount edges { node { id code name type price package careType } }
  }
}`,
      variables: { first: 20 }
    },
    {
      module: 'medical', kind: 'query', name: 'medicalServices', status: 'ui',
      signature: 'medicalServices(first, pricelistUuid, orderBy) -> ServiceConnection',
      note: 'Katalog tindakan medis.',
      example: `query Services($first: Int) {
  medicalServices(first: $first, orderBy: ["code"]) {
    totalCount edges { node { id code name level price careType } }
  }
}`,
      variables: { first: 20 }
    },
    {
      module: 'medical', kind: 'query', name: 'medicalItemsStr', status: 'ui',
      signature: 'medicalItemsStr(str, date, pricelistUuid) -> ItemConnection',
      note: 'Pencarian obat.', example: `query ItemsStr($str: String) { medicalItemsStr(str: $str, first: 20) { edges { node { code name price } } } }`,
      variables: { str: 'paracetamol' }
    },
    {
      module: 'medical', kind: 'query', name: 'medicalServicesStr', status: 'ui',
      signature: 'medicalServicesStr(str, date, pricelistUuid) -> ServiceConnection',
      note: 'Pencarian tindakan.', example: `query ServicesStr($str: String) { medicalServicesStr(str: $str, first: 20) { edges { node { code name price } } } }`,
      variables: { str: 'konsultasi' }
    },
    {
      module: 'medical', kind: 'query', name: 'validateItemCode', status: 'ui',
      signature: 'validateItemCode(itemCode: String!) -> Boolean',
      note: 'Cek keunikan kode obat.', example: `query VItem($code: String!) { validateItemCode(itemCode: $code) }`, variables: { code: 'I999' }
    },
    {
      module: 'medical', kind: 'query', name: 'validateServiceCode', status: 'ui',
      signature: 'validateServiceCode(serviceCode: String!) -> Boolean',
      note: 'Cek keunikan kode tindakan.', example: `query VSvc($code: String!) { validateServiceCode(serviceCode: $code) }`, variables: { code: 'S999' }
    },
    {
      module: 'medical', kind: 'mutation', name: 'createItem', status: 'ui',
      signature: 'createItem(input: CreateItemMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: code, name, type, price, careType, patientCategory.',
      example: `mutation CreateItem($input: CreateItemMutationInput!) {
  createItem(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'item-1', code: 'I999', name: 'Obat Contoh', type: 'D', price: '5000', careType: 'B', patientCategory: 15 } }
    },
    {
      module: 'medical', kind: 'mutation', name: 'updateItem', status: 'ui',
      signature: 'updateItem(input: UpdateItemMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui obat.', example: `mutation UpdateItem($input: UpdateItemMutationInput!) { updateItem(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-item-1', uuid: '<item-uuid>', code: 'I999', name: 'Obat Contoh (rev)', type: 'D', price: '6000', careType: 'B', patientCategory: 15 } }
    },
    {
      module: 'medical', kind: 'mutation', name: 'deleteItem', status: 'ui',
      signature: 'deleteItem(input: DeleteItemMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete obat.', example: `mutation DeleteItem($input: DeleteItemMutationInput!) { deleteItem(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-item-1', uuids: ['<item-uuid>'] } }
    },
    {
      module: 'medical', kind: 'mutation', name: 'createService', status: 'ui',
      signature: 'createService(input: CreateServiceMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: code, name, type, level, price, careType, patientCategory.',
      example: `mutation CreateService($input: CreateServiceMutationInput!) {
  createService(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'svc-1', code: 'S999', name: 'Tindakan Contoh', type: 'D', level: 'H', price: '75000', careType: 'B', patientCategory: 15 } }
    },
    {
      module: 'medical', kind: 'mutation', name: 'updateService', status: 'ui',
      signature: 'updateService(input: UpdateServiceMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui tindakan.', example: `mutation UpdateService($input: UpdateServiceMutationInput!) { updateService(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-svc-1', uuid: '<service-uuid>', code: 'S999', name: 'Tindakan Contoh (rev)', type: 'D', level: 'H', price: '80000', careType: 'B', patientCategory: 15 } }
    },
    {
      module: 'medical', kind: 'mutation', name: 'deleteService', status: 'ui',
      signature: 'deleteService(input: DeleteServiceMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete tindakan.', example: `mutation DeleteService($input: DeleteServiceMutationInput!) { deleteService(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-svc-1', uuids: ['<service-uuid>'] } }
    },

    // ---------------- MEDICAL PRICELIST ----------------
    {
      module: 'medical_pricelist', kind: 'query', name: 'itemsPricelists', status: 'ui',
      signature: 'itemsPricelists(first, name, pricelistDate_Gte, ...) -> Connection',
      note: 'Daftar harga obat per wilayah/faskes.',
      example: `query ItemsPL($first: Int) {
  itemsPricelists(first: $first) {
    edges { node { id uuid name pricelistDate itemsPricelistDetails { price item { code name } } } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'medical_pricelist', kind: 'query', name: 'servicesPricelists', status: 'ui',
      signature: 'servicesPricelists(first, name, ...) -> Connection',
      note: 'Daftar tarif tindakan per wilayah/faskes.',
      example: `query ServicesPL($first: Int) {
  servicesPricelists(first: $first) {
    edges { node { id uuid name pricelistDate servicesPricelistDetails { price service { code name } } } }
  }
}`,
      variables: { first: 10 }
    },
    {
      module: 'medical_pricelist', kind: 'mutation', name: 'createItemsPricelist', status: 'ui',
      signature: 'createItemsPricelist(input: CreateItemsPricelistMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat daftar harga obat baru.',
      example: `mutation CreateItemsPL($input: CreateItemsPricelistMutationInput!) {
  createItemsPricelist(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'ipl-1', name: 'PL Obat 2026', pricelistDate: '2026-01-01', locationId: 1 } }
    },
    {
      module: 'medical_pricelist', kind: 'mutation', name: 'createServicesPricelist', status: 'ui',
      signature: 'createServicesPricelist(input: CreateServicesPricelistMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat daftar tarif tindakan baru.',
      example: `mutation CreateServicesPL($input: CreateServicesPricelistMutationInput!) {
  createServicesPricelist(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'spl-1', name: 'PL Tindakan 2026', pricelistDate: '2026-01-01', locationId: 1 } }
    },

    // ---------------- CLAIM ----------------
    {
      module: 'claim', kind: 'query', name: 'claims', status: 'ui',
      signature: 'claims(first, status, dateClaimed_Gte, insuree_ChfId, healthFacility_Code, code, orderBy, ...) -> ClaimConnection',
      note: 'Status klaim: 1 Rejected, 2 Entered, 4 Checked, 8 Processed, 16 Valuated.',
      example: `query Claims($first: Int, $status: Int) {
  claims(first: $first, status: $status, orderBy: ["-dateClaimed"]) {
    totalCount
    edges { node {
      id uuid code status dateClaimed claimed approved valuated
      healthFacility { code name }
      insuree { chfId lastName otherNames }
      icd { code name }
    } }
  }
}`,
      variables: { first: 10, status: null }
    },
    {
      module: 'claim', kind: 'query', name: 'claim', status: 'ui',
      signature: 'claim(id: Int, uuid: UUID) -> ClaimGQLType',
      note: 'Detail satu klaim (termasuk items & services).',
      example: `query Claim($id: Int!) {
  claim(id: $id) {
    id uuid code status claimed approved valuated
    items { id qtyProvided priceAsked item { code name } }
    services { id qtyProvided priceAsked service { code name } }
  }
}`,
      variables: { id: 1 }
    },
    {
      module: 'claim', kind: 'query', name: 'claimHistory', status: 'ui',
      signature: 'claimHistory(claimUuid: String!) -> ClaimConnection',
      note: 'Riwayat versi klaim (openIMIS menyimpan histori setiap perubahan).',
      example: `query ClaimHistory($claimUuid: String!) {
  claimHistory(claimUuid: $claimUuid, first: 50) {
    edges { node { id code status dateClaimed claimed approved } }
  }
}`,
      variables: { claimUuid: '<claim-uuid>' }
    },
    {
      module: 'claim', kind: 'query', name: 'claimAttachments', status: 'ui',
      signature: 'claimAttachments(first, claim_Id) -> Connection',
      note: 'Lampiran pendukung klaim.',
      example: `query ClaimAttachments($claimId: Int) {
  claimAttachments(first: 50, claim_Id: $claimId) { edges { node { id uuid url generalType } } }
}`,
      variables: { claimId: 1 }
    },
    {
      module: 'claim', kind: 'query', name: 'insureeNameByChfid', status: 'ui',
      signature: 'insureeNameByChfid(chfId: String!) -> String',
      note: 'Lookup nama peserta cepat (dipakai form klaim).',
      example: `query InsureeName($chfId: String!) { insureeNameByChfid(chfId: $chfId) }`,
      variables: { chfId: '070707070' }
    },
    {
      module: 'claim', kind: 'query', name: 'validateClaimCode', status: 'ui',
      signature: 'validateClaimCode(claimCode: String!) -> Boolean',
      note: 'Cek keunikan kode klaim.',
      example: `query ValidateClaim($code: String!) { validateClaimCode(claimCode: $code) }`,
      variables: { code: 'CLM-000001' }
    },
    {
      module: 'claim', kind: 'mutation', name: 'createClaim', status: 'ui',
      signature: 'createClaim(input: CreateClaimMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: code, insureeId, dateFrom, dateClaimed, icdId, healthFacilityId. Items/services opsional.',
      example: `mutation CreateClaim($input: CreateClaimMutationInput!) {
  createClaim(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'claim-1', code: 'CLM-000001',
          insureeId: 1, healthFacilityId: 1, icdId: 1,
          dateFrom: '2026-01-10', dateTo: '2026-01-10', dateClaimed: '2026-01-10',
          visitType: 'O', careType: 'O',
          services: [{ serviceId: 1, status: 1, qtyProvided: 1, priceAsked: '50000' }],
          items: [{ itemId: 1, status: 1, qtyProvided: 1, priceAsked: '10000' }]
        }
      }
    },
    {
      module: 'claim', kind: 'mutation', name: 'updateClaim', status: 'ui',
      signature: 'updateClaim(input: UpdateClaimMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui klaim (termasuk menambah/mengubah items & services).',
      example: `mutation UpdateClaim($input: UpdateClaimMutationInput!) {
  updateClaim(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'upd-claim-1', uuid: '<claim-uuid>', code: 'CLM-000001', insureeId: 1, healthFacilityId: 1, icdId: 1, dateFrom: '2026-01-10', dateClaimed: '2026-01-10' } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'submitClaims', status: 'ui',
      signature: 'submitClaims(input: { uuids }) -> { submitted checked rejected itemsPassed ... }',
      note: 'Transisi 2 Entered -> 4 Checked (atau 1 Rejected). Mengembalikan statistik per item/service.',
      example: `mutation SubmitClaims($input: SubmitClaimsMutationInput!) {
  submitClaims(input: $input) {
    clientMutationId submitted checked rejected
    itemsPassed itemsRejected servicesPassed servicesRejected
  }
}`,
      variables: { input: { clientMutationId: 'submit-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'selectClaimsForReview', status: 'ui',
      signature: 'selectClaimsForReview(input: { uuids }) -> { clientMutationId }',
      note: 'Menandai klaim untuk direview manual.',
      example: `mutation SelectReview($input: SelectClaimsForReviewMutationInput!) {
  selectClaimsForReview(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'sel-review-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'saveClaimReview', status: 'ui',
      signature: 'saveClaimReview(input: SaveClaimReviewMutationInput!) -> { clientMutationId }',
      note: 'Menyimpan keputusan reviewer per item/service.',
      example: `mutation SaveReview($input: SaveClaimReviewMutationInput!) {
  saveClaimReview(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'save-review-1', claimUuid: '<claim-uuid>' } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'deliverClaimsReview', status: 'catalog',
      signature: 'deliverClaimsReview(input: { uuids }) -> { clientMutationId }',
      note: 'Mengirim hasil review ke faskes.',
      example: `mutation DeliverReview($input: DeliverClaimsReviewMutationInput!) { deliverClaimsReview(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'dlv-review-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'bypassClaimsReview', status: 'catalog',
      signature: 'bypassClaimsReview(input: { uuids }) -> { clientMutationId }',
      note: 'Melewati proses review.',
      example: `mutation BypassReview($input: BypassClaimsReviewMutationInput!) { bypassClaimsReview(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'bypass-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'skipClaimsReview', status: 'catalog',
      signature: 'skipClaimsReview(input: { uuids }) -> { clientMutationId }',
      note: 'Menunda review.',
      example: `mutation SkipReview($input: SkipClaimsReviewMutationInput!) { skipClaimsReview(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'skip-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'processClaims', status: 'ui',
      signature: 'processClaims(input: { uuids }) -> { submitted processed valuated rejected }',
      note: 'Adjudikasi: 4 Checked -> 8 Processed -> 16 Valuated. Ini yang benar-benar menghitung penggantian.',
      example: `mutation ProcessClaims($input: ProcessClaimsMutationInput!) {
  processClaims(input: $input) {
    clientMutationId submitted processed valuated rejected
  }
}`,
      variables: { input: { clientMutationId: 'process-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'selectClaimsForFeedback', status: 'catalog',
      signature: 'selectClaimsForFeedback(input: { uuids }) -> { clientMutationId }',
      note: 'Memilih klaim untuk alur feedback.',
      example: `mutation SelFeedback($input: SelectClaimsForFeedbackMutationInput!) { selectClaimsForFeedback(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'sel-fb-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'deliverClaimFeedback', status: 'catalog',
      signature: 'deliverClaimFeedback(input: { uuids }) -> { clientMutationId }',
      note: 'Mengirim feedback ke faskes.',
      example: `mutation DeliverFeedback($input: DeliverClaimFeedbackMutationInput!) { deliverClaimFeedback(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'dlv-fb-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'deleteClaims', status: 'ui',
      signature: 'deleteClaims(input: { uuids }) -> { clientMutationId }',
      note: 'Soft-delete klaim.', example: `mutation DeleteClaims($input: DeleteClaimsMutationInput!) { deleteClaims(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-claim-1', uuids: ['<claim-uuid>'] } }
    },
    {
      module: 'claim', kind: 'mutation', name: 'createClaimAttachment', status: 'catalog',
      signature: 'createClaimAttachment(input: CreateClaimAttachmentMutationInput!) -> { clientMutationId internalId }',
      note: 'Mengunggah lampiran. Wajib: claimUuid, generalType (FILE|URL), predefinedType. FILE butuh `document` base64.',
      example: `mutation CreateAttachment($input: CreateClaimAttachmentMutationInput!) {
  createClaimAttachment(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'att-1', claimUuid: '<claim-uuid>', title: 'Kwitansi', generalType: 'FILE', predefinedType: 'default', filename: 'kwitansi.pdf', mime: 'application/pdf', document: '<base64>' } }
    },

    // ---------------- CLAIM BATCH ----------------
    {
      module: 'claim_batch', kind: 'query', name: 'batchRuns', status: 'catalog',
      signature: 'batchRuns(first, orderBy) -> BatchRunConnection',
      note: 'Riwayat proses batch adjudikasi.',
      example: `query BatchRuns($first: Int) { batchRuns(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 10 }
    },
    {
      module: 'claim_batch', kind: 'mutation', name: 'processBatch', status: 'catalog',
      signature: 'processBatch(input: ProcessBatchMutationInput!) -> { clientMutationId }',
      note: 'Menjalankan adjudikasi massal untuk satu periode.',
      example: `mutation ProcessBatch($input: ProcessBatchMutationInput!) { processBatch(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'batch-1', batchRunId: 1 } }
    },

    // ---------------- LOCATION ----------------
    {
      module: 'location', kind: 'query', name: 'healthFacilities', status: 'ui',
      signature: 'healthFacilities(first, level, name_Icontains, status, orderBy, ...) -> Connection',
      note: 'Level: H (Hospital), C (Health Centre/FKTP), D (Dispensary). Status: AC/IN/DE/ID.',
      example: `query HealthFacilities($first: Int, $level: String) {
  healthFacilities(first: $first, level: $level, orderBy: ["code"]) {
    totalCount
    edges { node {
      id uuid code name level careType status address phone
      legalForm { code legalForm }
      location { code name }
    } }
  }
}`,
      variables: { first: 20, level: null }
    },
    {
      module: 'location', kind: 'query', name: 'locations', status: 'ui',
      signature: 'locations(first, type, name_Icontains, orderBy, ...) -> Connection',
      note: 'Hirarki wilayah (Region/District/Ward/Village).',
      example: `query Locations($first: Int) {
  locations(first: $first, orderBy: ["code"]) {
    totalCount edges { node { id uuid code name type parent { code name } } }
  }
}`,
      variables: { first: 20 }
    },
    {
      module: 'location', kind: 'query', name: 'locationsAll', status: 'ui',
      signature: 'locationsAll(first) -> Connection',
      note: 'Semua wilayah tanpa filter row-security.',
      example: `query LocationsAll($first: Int) { locationsAll(first: $first) { edges { node { code name type } } } }`,
      variables: { first: 50 }
    },
    {
      module: 'location', kind: 'query', name: 'locationsStr', status: 'catalog',
      signature: 'locationsStr(str: String) -> Connection',
      note: 'Pencarian wilayah bebas.',
      example: `query LocationsStr($str: String) { locationsStr(str: $str, first: 20) { edges { node { code name type } } } }`,
      variables: { str: 'jakarta' }
    },
    {
      module: 'location', kind: 'query', name: 'userDistricts', status: 'ui',
      signature: 'userDistricts -> [UserDistrictGQLType]',
      note: 'Distrik yang menjadi wewenang user login.',
      example: `query UserDistricts { userDistricts { id location { code name } } }`,
      variables: {}
    },
    {
      module: 'location', kind: 'query', name: 'validateHealthFacilityCode', status: 'ui',
      signature: 'validateHealthFacilityCode(healthFacilityCode: String!) -> Boolean',
      note: 'Cek keunikan kode faskes.',
      example: `query VHF($code: String!) { validateHealthFacilityCode(healthFacilityCode: $code) }`,
      variables: { code: 'RS9999' }
    },
    {
      module: 'location', kind: 'query', name: 'validateLocationCode', status: 'ui',
      signature: 'validateLocationCode(locationCode: String!) -> Boolean',
      note: 'Cek keunikan kode wilayah.',
      example: `query VLoc($code: String!) { validateLocationCode(locationCode: $code) }`,
      variables: { code: 'LOC99' }
    },
    {
      module: 'location', kind: 'mutation', name: 'createHealthFacility', status: 'ui',
      signature: 'createHealthFacility(input: CreateHealthFacilityMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: code, name, legalFormId, level, locationId, careType.',
      example: `mutation CreateHF($input: CreateHealthFacilityMutationInput!) {
  createHealthFacility(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'hf-1', code: 'RS9999', name: 'RSUD Contoh',
          legalFormId: 'G', level: 'H', locationId: 1, careType: 'B'
        }
      }
    },
    {
      module: 'location', kind: 'mutation', name: 'updateHealthFacility', status: 'ui',
      signature: 'updateHealthFacility(input: UpdateHealthFacilityMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui faskes.', example: `mutation UpdateHF($input: UpdateHealthFacilityMutationInput!) { updateHealthFacility(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-hf-1', uuid: '<hf-uuid>', code: 'RS9999', name: 'RSUD Contoh (rev)', legalFormId: 'G', level: 'H', locationId: 1, careType: 'B' } }
    },
    {
      module: 'location', kind: 'mutation', name: 'deleteHealthFacility', status: 'ui',
      signature: 'deleteHealthFacility(input: DeleteHealthFacilityMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete faskes.', example: `mutation DeleteHF($input: DeleteHealthFacilityMutationInput!) { deleteHealthFacility(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-hf-1', uuid: '<hf-uuid>' } }
    },
    {
      module: 'location', kind: 'mutation', name: 'createLocation', status: 'ui',
      signature: 'createLocation(input: CreateLocationMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat wilayah baru.',
      example: `mutation CreateLocation($input: CreateLocationMutationInput!) {
  createLocation(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'loc-1', code: 'LOC99', name: 'Wilayah Contoh', type: 'D' } }
    },
    {
      module: 'location', kind: 'mutation', name: 'updateLocation', status: 'catalog',
      signature: 'updateLocation(input: UpdateLocationMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui wilayah.', example: `mutation UpdateLocation($input: UpdateLocationMutationInput!) { updateLocation(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-loc-1', uuid: '<loc-uuid>', code: 'LOC99', name: 'Wilayah Contoh (rev)', type: 'D' } }
    },
    {
      module: 'location', kind: 'mutation', name: 'moveLocation', status: 'catalog',
      signature: 'moveLocation(input: MoveLocationMutationInput!) -> { clientMutationId }',
      note: 'Memindahkan wilayah ke parent lain.',
      example: `mutation MoveLocation($input: MoveLocationMutationInput!) { moveLocation(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'mv-loc-1', uuid: '<loc-uuid>', newParentUuid: '<parent-loc-uuid>' } }
    },

    // ---------------- CONTRIBUTION ----------------
    {
      module: 'contribution', kind: 'query', name: 'premiums', status: 'ui',
      signature: 'premiums(first, payerId, orderBy, ...) -> PremiumConnection',
      note: 'Pembayaran iuran. payType: C tunai, B bank, M mobile, O online.',
      example: `query Premiums($first: Int) {
  premiums(first: $first, orderBy: ["-payDate"]) {
    totalCount
    edges { node {
      id uuid amount receipt payDate payType
      policy { uuid product { code name } family { headInsuree { chfId lastName } } }
    } }
  }
}`,
      variables: { first: 20 }
    },
    {
      module: 'contribution', kind: 'query', name: 'premiumsByPolicies', status: 'ui',
      signature: 'premiumsByPolicies(policyUuids: [String!]!) -> PremiumConnection',
      note: 'Premi untuk sekumpulan polis.',
      example: `query PremiumsByPolicies($uuids: [String!]!) {
  premiumsByPolicies(policyUuids: $uuids, first: 100) {
    edges { node { id amount receipt payDate payType } }
  }
}`,
      variables: { uuids: ['<policy-uuid>'] }
    },
    {
      module: 'contribution', kind: 'query', name: 'validatePremiumCode', status: 'ui',
      signature: 'validatePremiumCode(code: String!, policyUuid: String!) -> Boolean',
      note: 'Cek keunikan kode premi dalam satu polis.',
      example: `query VPremium($code: String!, $policyUuid: String!) {
  validatePremiumCode(code: $code, policyUuid: $policyUuid)
}`,
      variables: { code: 'RCPT-001', policyUuid: '<policy-uuid>' }
    },
    {
      module: 'contribution', kind: 'mutation', name: 'createPremium', status: 'ui',
      signature: 'createPremium(input: CreatePremiumMutationInput!) -> { clientMutationId internalId }',
      note: 'Field wajib: policyUuid, amount, receipt, payDate, payType.',
      example: `mutation CreatePremium($input: CreatePremiumMutationInput!) {
  createPremium(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'prem-1', policyUuid: '<policy-uuid>',
          amount: '150000', receipt: 'RCPT-001', payDate: '2026-01-05', payType: 'B'
        }
      }
    },
    {
      module: 'contribution', kind: 'mutation', name: 'updatePremium', status: 'ui',
      signature: 'updatePremium(input: UpdatePremiumMutationInput!) -> { clientMutationId internalId }',
      note: 'Perbarui catatan premi.', example: `mutation UpdatePremium($input: UpdatePremiumMutationInput!) { updatePremium(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'upd-prem-1', uuid: '<premium-uuid>', policyUuid: '<policy-uuid>', amount: '160000', receipt: 'RCPT-001', payDate: '2026-01-05', payType: 'B' } }
    },
    {
      module: 'contribution', kind: 'mutation', name: 'deletePremium', status: 'ui',
      signature: 'deletePremium(input: DeletePremiumsMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete premi.', example: `mutation DeletePremium($input: DeletePremiumsMutationInput!) { deletePremium(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-prem-1', uuids: ['<premium-uuid>'] } }
    },

    // ---------------- PAYER ----------------
    {
      module: 'payer', kind: 'query', name: 'payer', status: 'ui',
      signature: 'payer(first, orderBy) -> PayerConnection',
      note: 'Lembaga pembayar iuran (mis. pemerintah daerah).',
      example: `query Payers($first: Int) { payer(first: $first) { totalCount edges { node { id uuid name address phone } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'payer', kind: 'query', name: 'funding', status: 'catalog',
      signature: 'funding(first, orderBy) -> FundingConnection',
      note: 'Sumber dana payer.',
      example: `query Fundings($first: Int) { funding(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'payer', kind: 'mutation', name: 'createPayer', status: 'catalog',
      signature: 'createPayer(input: CreatePayerMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat payer.', example: `mutation CreatePayer($input: CreatePayerMutationInput!) { createPayer(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'payer-1', name: 'Pemda Contoh', address: 'Jl. Pemerintahan 1' } }
    },
    {
      module: 'payer', kind: 'mutation', name: 'addFunding', status: 'catalog',
      signature: 'addFunding(input: AddFundingMutationInput!) -> { clientMutationId }',
      note: 'Menambah sumber dana ke payer.',
      example: `mutation AddFunding($input: AddFundingMutationInput!) { addFunding(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'fund-1', payerUuid: '<payer-uuid>', amount: '10000000' } }
    },

    // ---------------- CONTRIBUTION PLAN ----------------
    {
      module: 'contribution_plan', kind: 'query', name: 'contributionPlan', status: 'catalog',
      signature: 'contributionPlan(first, orderBy) -> Connection',
      note: 'Rencana iuran (basis perhitungan premi).',
      example: `query ContributionPlans($first: Int) { contributionPlan(first: $first) { totalCount edges { node { id uuid code name } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'contribution_plan', kind: 'query', name: 'paymentPlan', status: 'catalog',
      signature: 'paymentPlan(first, orderBy) -> Connection',
      note: 'Rencana pembayaran.',
      example: `query PaymentPlans($first: Int) { paymentPlan(first: $first) { totalCount edges { node { id uuid code name } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'contribution_plan', kind: 'query', name: 'contributionPlanBundle', status: 'catalog',
      signature: 'contributionPlanBundle(first, orderBy) -> Connection',
      note: 'Paket rencana iuran.',
      example: `query CPBundles($first: Int) { contributionPlanBundle(first: $first) { totalCount edges { node { id uuid code name } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'contribution_plan', kind: 'mutation', name: 'createContributionPlan', status: 'catalog',
      signature: 'createContributionPlan(input: CreateContributionPlanMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat rencana iuran. Field wajib: code, name, calculation (UUID), benefitPlanId, periodicity.',
      example: `mutation CreateCP($input: CreateContributionPlanMutationInput!) { createContributionPlan(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'cp-1', code: 'CP01', name: 'Iuran Dasar', calculation: '<calculation-rule-uuid>', benefitPlanId: '1', periodicity: 12 } }
    },
    {
      module: 'contribution_plan', kind: 'mutation', name: 'createPaymentPlan', status: 'catalog',
      signature: 'createPaymentPlan(input: CreatePaymentPlanMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat rencana pembayaran (memakai input yang sama dengan contribution plan).',
      example: `mutation CreatePP($input: CreatePaymentPlanMutationInput!) { createPaymentPlan(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'pp-1', code: 'PP01', name: 'Bayar Tahunan', calculation: '<calculation-rule-uuid>', benefitPlanId: '1', periodicity: 12 } }
    },

    // ---------------- PAYMENT ----------------
    {
      module: 'payment', kind: 'query', name: 'payments', status: 'catalog',
      signature: 'payments(first, orderBy) -> PaymentConnection',
      note: 'Pembayaran ke faskes (capitation/non-capitation).',
      example: `query Payments($first: Int) { payments(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'payment', kind: 'query', name: 'paymentDetails', status: 'catalog',
      signature: 'paymentDetails(first, orderBy) -> Connection',
      note: 'Rincian pembayaran.', example: `query PaymentDetails($first: Int) { paymentDetails(first: $first) { totalCount edges { node { id uuid } } } }`, variables: { first: 20 }
    },
    {
      module: 'payment', kind: 'mutation', name: 'createPayment', status: 'catalog',
      signature: 'createPayment(input: CreatePaymentMutationInput!) -> { clientMutationId internalId }',
      note: 'Mencatat pembayaran ke faskes.',
      example: `mutation CreatePayment($input: CreatePaymentMutationInput!) { createPayment(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'pay-1' } }
    },

    // ---------------- INVOICE ----------------
    {
      module: 'invoice', kind: 'mutation', name: 'generateInvoicesForTimePeriod', status: 'catalog',
      signature: 'generateInvoicesForTimePeriod(input: ...) -> { clientMutationId }',
      note: 'Generate invoice massal untuk satu periode.',
      example: `mutation GenInvoices($input: GenerateInvoicesForTimePeriodMutationInput!) {
  generateInvoicesForTimePeriod(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'inv-gen-1' } }
    },
    {
      module: 'invoice', kind: 'mutation', name: 'createBill', status: 'catalog',
      signature: 'createBill(input: ...) -> { clientMutationId internalId }',
      note: 'Membuat tagihan.',
      example: `mutation CreateBill($input: CreateBillMutationInput!) { createBill(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'bill-1' } }
    },
    {
      module: 'invoice', kind: 'mutation', name: 'createPaymentInvoice', status: 'catalog',
      signature: 'createPaymentInvoice(input: ...) -> { clientMutationId internalId }',
      note: 'Membuat pembayaran atas invoice.',
      example: `mutation CreatePaymentInvoice($input: CreatePaymentInvoiceMutationInput!) { createPaymentInvoice(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'pinv-1' } }
    },

    // ---------------- CONTRACT ----------------
    {
      module: 'contract', kind: 'query', name: 'validateContractCode', status: 'catalog',
      signature: 'validateContractCode(contractCode: String!) -> Boolean',
      note: 'Cek keunikan kode kontrak.',
      example: `query VContract($code: String!) { validateContractCode(contractCode: $code) }`,
      variables: { code: 'CTR-001' }
    },
    {
      module: 'contract', kind: 'mutation', name: 'createContract', status: 'catalog',
      signature: 'createContract(input: CreateContractMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat kontrak dengan pemegang polis. Field wajib: code.',
      example: `mutation CreateContract($input: CreateContractMutationInput!) { createContract(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'ctr-1', code: 'CTR-001', policyHolderId: '<policyholder-uuid>', paymentReference: 'REF-001', dateValidFrom: '2026-01-01', dateValidTo: '2026-12-31' } }
    },
    {
      module: 'contract', kind: 'mutation', name: 'submitContract', status: 'catalog',
      signature: 'submitContract(input: { uuid }) -> { clientMutationId }',
      note: 'Mengajukan kontrak untuk approval.',
      example: `mutation SubmitContract($input: SubmitContractMutationInput!) { submitContract(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'sub-ctr-1', uuid: '<contract-uuid>' } }
    },
    {
      module: 'contract', kind: 'mutation', name: 'approveContract', status: 'catalog',
      signature: 'approveContract(input: { uuid }) -> { clientMutationId }',
      note: 'Menyetujui kontrak.',
      example: `mutation ApproveContract($input: ApproveContractMutationInput!) { approveContract(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'app-ctr-1', uuid: '<contract-uuid>' } }
    },

    // ---------------- POLICYHOLDER ----------------
    {
      module: 'policyholder', kind: 'query', name: 'validatePolicyHolderCode', status: 'catalog',
      signature: 'validatePolicyHolderCode(code: String!) -> Boolean',
      note: 'Cek keunikan kode pemegang polis.',
      example: `query VPH($code: String!) { validatePolicyHolderCode(code: $code) }`,
      variables: { code: 'PH001' }
    },
    {
      module: 'policyholder', kind: 'mutation', name: 'createPolicyHolder', status: 'catalog',
      signature: 'createPolicyHolder(input: CreatePolicyHolderMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat pemegang polis (badan usaha/instansi). Field wajib: code, tradeName.',
      example: `mutation CreatePH($input: CreatePolicyHolderMutationInput!) { createPolicyHolder(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'ph-1', code: 'PH001', tradeName: 'PT Contoh', legalForm: 1, dateValidFrom: '2026-01-01', dateValidTo: '2026-12-31' } }
    },
    {
      module: 'policyholder', kind: 'mutation', name: 'createPolicyHolderInsuree', status: 'catalog',
      signature: 'createPolicyHolderInsuree(input: ...) -> { clientMutationId internalId }',
      note: 'Menautkan peserta ke pemegang polis.',
      example: `mutation CreatePHInsuree($input: CreatePolicyHolderInsureeMutationInput!) { createPolicyHolderInsuree(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'phi-1', policyHolderId: '<policyholder-uuid>', insureeId: 1, dateValidFrom: '2026-01-01' } }
    },

    // ---------------- GRIEVANCE ----------------
    {
      module: 'grievance_social_protection', kind: 'query', name: 'tickets', status: 'ui',
      signature: 'tickets(first, status, category, orderBy, showHistory) -> TicketConnection',
      note: 'Status: RECEIVED, OPEN, IN_PROGRESS, RESOLVED, CLOSED.',
      example: `query Tickets($first: Int) {
  tickets(first: $first, orderBy: ["-dateCreated"]) {
    totalCount
    edges { node {
      id uuid code title description status priority category channel resolution
      dateOfIncident dueDate dateCreated
    } }
  }
}`,
      variables: { first: 20 }
    },
    {
      module: 'grievance_social_protection', kind: 'query', name: 'ticketDetails', status: 'ui',
      signature: 'ticketDetails(first, orderBy) -> Connection',
      note: 'Tiket beserta detail lengkap.',
      example: `query TicketDetails($first: Int) { ticketDetails(first: $first) { edges { node { id code title status description } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'grievance_social_protection', kind: 'query', name: 'comments', status: 'ui',
      signature: 'comments(first, ticket_Uuid, orderBy) -> CommentConnection',
      note: 'Komentar/percakapan pada tiket.',
      example: `query Comments($ticketUuid: String) {
  comments(first: 50, ticket_Uuid: $ticketUuid) { edges { node { id content isResolved dateCreated } } }
}`,
      variables: { ticketUuid: '<ticket-uuid>' }
    },
    {
      module: 'grievance_social_protection', kind: 'query', name: 'grievanceConfig', status: 'ui',
      signature: 'grievanceConfig -> GrievanceTypeConfigurationGQLType',
      note: 'Kategori, flag, dan kanal aduan yang tersedia.',
      example: `query GrievanceConfig {
  grievanceConfig { grievanceTypes { name code } grievanceFlags { name code } grievanceChannels { name code } }
}`,
      variables: {}
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'createTicket', status: 'ui',
      signature: 'createTicket(input: CreateTicketMutationInput!) -> { clientMutationId internalId }',
      note: 'Membuat aduan. `status` memakai enum TicketStatusEnum.',
      example: `mutation CreateTicket($input: CreateTicketMutationInput!) {
  createTicket(input: $input) { clientMutationId internalId }
}`,
      variables: {
        input: {
          clientMutationId: 'ticket-1', title: 'Antrean terlalu lama',
          description: 'Menunggu > 3 jam di poli', status: 'RECEIVED',
          priority: 'High', category: 'claim', channel: 'Mobile JKN'
        }
      }
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'updateTicket', status: 'ui',
      signature: 'updateTicket(input: UpdateTicketMutationInput!) -> { clientMutationId internalId }',
      note: 'Memperbarui status/tanggapan tiket.',
      example: `mutation UpdateTicket($input: UpdateTicketMutationInput!) {
  updateTicket(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'upd-ticket-1', id: '<ticket-uuid>', status: 'IN_PROGRESS' } }
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'createComment', status: 'ui',
      signature: 'createComment(input: CreateCommentMutationInput!) -> { clientMutationId internalId }',
      note: 'Menambahkan komentar ke tiket.',
      example: `mutation CreateComment($input: CreateCommentMutationInput!) {
  createComment(input: $input) { clientMutationId internalId }
}`,
      variables: { input: { clientMutationId: 'comment-1', ticketId: '<ticket-uuid>', comment: 'Sedang kami tindak lanjuti.' } }
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'resolveGrievanceByComment', status: 'ui',
      signature: 'resolveGrievanceByComment(input: ResolveGrievanceByCommentMutationInput!) -> { clientMutationId }',
      note: 'Menyelesaikan tiket dengan komentar resolusi.',
      example: `mutation ResolveGrievance($input: ResolveGrievanceByCommentMutationInput!) {
  resolveGrievanceByComment(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'resolve-1', id: '<comment-uuid>' } }
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'reopenTicket', status: 'ui',
      signature: 'reopenTicket(input: ReopenTicketMutationInput!) -> { clientMutationId }',
      note: 'Membuka kembali tiket yang sudah ditutup.',
      example: `mutation ReopenTicket($input: ReopenTicketMutationInput!) {
  reopenTicket(input: $input) { clientMutationId }
}`,
      variables: { input: { clientMutationId: 'reopen-1', id: '<ticket-uuid>' } }
    },
    {
      module: 'grievance_social_protection', kind: 'mutation', name: 'deleteTicket', status: 'ui',
      signature: 'deleteTicket(input: DeleteTicketMutationInput!) -> { clientMutationId }',
      note: 'Soft-delete tiket.', example: `mutation DeleteTicket($input: DeleteTicketMutationInput!) { deleteTicket(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'del-ticket-1', ids: ['<ticket-uuid>'] } }
    },

    // ---------------- TASKS ----------------
    {
      module: 'tasks_management', kind: 'mutation', name: 'createTaskGroup', status: 'catalog',
      signature: 'createTaskGroup(input: CreateTaskGroupInput!) -> { clientMutationId internalId }',
      note: 'Membuat grup tugas (workflow).',
      example: `mutation CreateTaskGroup($input: CreateTaskGroupInput!) { createTaskGroup(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'tg-1', source: 'claim', entityId: '1', type: 'review' } }
    },
    {
      module: 'tasks_management', kind: 'mutation', name: 'updateTask', status: 'catalog',
      signature: 'updateTask(input: UpdateTaskInput!) -> { clientMutationId internalId }',
      note: 'Memperbarui status tugas.',
      example: `mutation UpdateTask($input: UpdateTaskInput!) { updateTask(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'task-1', taskId: 1, status: 'ACCEPTED' } }
    },
    {
      module: 'tasks_management', kind: 'mutation', name: 'resolveTask', status: 'catalog',
      signature: 'resolveTask(input: ResolveTaskGroupInput!) -> { clientMutationId }',
      note: 'Menyelesaikan tugas.',
      example: `mutation ResolveTask($input: ResolveTaskGroupInput!) { resolveTask(input: $input) { clientMutationId } }`,
      variables: { input: { clientMutationId: 'res-task-1', taskGroupId: 1 } }
    },

    // ---------------- INDIVIDUAL / SOCIAL PROTECTION ----------------
    {
      module: 'individual', kind: 'query', name: 'individual', status: 'catalog',
      signature: 'individual(first, orderBy, ...) -> IndividualConnection',
      note: 'Registry individu (modul social registry, terpisah dari tblInsuree).',
      example: `query Individuals($first: Int) { individual(first: $first) { totalCount edges { node { id uuid firstName lastName } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'individual', kind: 'query', name: 'group', status: 'catalog',
      signature: 'group(first, orderBy, ...) -> GroupConnection',
      note: 'Grup/household pada modul individual.',
      example: `query Groups($first: Int) { group(first: $first) { totalCount edges { node { id uuid code } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'social_protection', kind: 'query', name: 'benefitPlan', status: 'catalog',
      signature: 'benefitPlan(first, orderBy, ...) -> BenefitPlanConnection',
      note: 'Rencana manfaat program bantuan sosial.',
      example: `query BenefitPlans($first: Int) { benefitPlan(first: $first) { totalCount edges { node { id uuid code name } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'social_protection', kind: 'query', name: 'beneficiary', status: 'catalog',
      signature: 'beneficiary(first, orderBy, ...) -> BeneficiaryConnection',
      note: 'Penerima manfaat.',
      example: `query Beneficiaries($first: Int) { beneficiary(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'social_protection', kind: 'mutation', name: 'createBenefitPlan', status: 'catalog',
      signature: 'createBenefitPlan(input: ...) -> { clientMutationId internalId }',
      note: 'Membuat rencana manfaat.',
      example: `mutation CreateBenefitPlan($input: CreateBenefitPlanMutationInput!) { createBenefitPlan(input: $input) { clientMutationId internalId } }`,
      variables: { input: { clientMutationId: 'bp-1', code: 'BP01', name: 'Bantuan Kesehatan' } }
    },

    // ---------------- OTHER ----------------
    {
      module: 'payment_cycle', kind: 'query', name: 'paymentCycle', status: 'catalog',
      signature: 'paymentCycle(first, orderBy) -> Connection',
      note: 'Siklus pembayaran.',
      example: `query PaymentCycles($first: Int) { paymentCycle(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'payroll', kind: 'query', name: 'payroll', status: 'catalog',
      signature: 'payroll(first, orderBy) -> Connection',
      note: 'Payroll (modul social protection).',
      example: `query Payrolls($first: Int) { payroll(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    },
    {
      module: 'payroll', kind: 'query', name: 'paymentPoint', status: 'catalog',
      signature: 'paymentPoint(first, orderBy) -> Connection',
      note: 'Titik pembayaran.',
      example: `query PaymentPoints($first: Int) { paymentPoint(first: $first) { totalCount edges { node { id uuid } } } }`,
      variables: { first: 20 }
    }
  ];

  // ---------------------------------------------------------
  // FHIR R4 resources (registered in api_fhir_r4/urls.py)
  // ---------------------------------------------------------
  const FHIR_RESOURCES = [
    { name: 'Patient', module: 'insuree', note: 'Peserta = FHIR Patient' },
    { name: 'Group', module: 'insuree', note: 'Keluarga = FHIR Group' },
    { name: 'CoverageEligibilityRequest', module: 'insuree', note: 'Permintaan cek eligibilitas' },
    { name: 'Coverage', module: 'policy', note: 'Polis = FHIR Coverage' },
    { name: 'Contract', module: 'policy', note: 'Kontrak polis' },
    { name: 'Claim', module: 'claim', note: 'Klaim = FHIR Claim' },
    { name: 'ClaimResponse', module: 'claim', note: 'Hasil adjudikasi = FHIR ClaimResponse' },
    { name: 'Practitioner', module: 'claim', note: 'Praktisi/dokter' },
    { name: 'PractitionerRole', module: 'claim', note: 'Peran praktisi di faskes' },
    { name: 'Communication', module: 'claim', note: 'Komunikasi dengan peserta' },
    { name: 'CommunicationRequest', module: 'claim', note: 'Permintaan komunikasi' },
    { name: 'Organization', module: 'policyholder', note: 'Faskes/pemegang polis = FHIR Organization' },
    { name: 'Location', module: 'location', note: 'Wilayah/faskes = FHIR Location' },
    { name: 'InsurancePlan', module: 'product', note: 'Produk = FHIR InsurancePlan' },
    { name: 'Medication', module: 'medical', note: 'Obat = FHIR Medication' },
    { name: 'ActivityDefinition', module: 'medical', note: 'Tindakan = FHIR ActivityDefinition' },
    { name: 'Invoice', module: 'invoice', note: 'Tagihan = FHIR Invoice' },
    { name: 'PaymentNotice', module: 'invoice', note: 'Notifikasi pembayaran' },
    { name: 'Subscription', module: 'core', note: 'Langganan notifikasi FHIR' },
    { name: 'CodeSystem/diagnosis', module: 'claim', note: 'CodeSystem ICD-10 openIMIS' },
    { name: 'CodeSystem/medical-item', module: 'medical', note: 'CodeSystem obat' },
    { name: 'CodeSystem/medical-service', module: 'medical', note: 'CodeSystem tindakan' },
    { name: 'CodeSystem/organization-hf-legal-form', module: 'location', note: 'Badan hukum faskes' },
    { name: 'CodeSystem/organization-hf-level', module: 'location', note: 'Level faskes' },
    { name: 'CodeSystem/patient-education-level', module: 'insuree', note: 'Pendidikan peserta' },
    { name: 'CodeSystem/patient-profession', module: 'insuree', note: 'Profesi peserta' },
    { name: 'CodeSystem/patient-identification-type', module: 'insuree', note: 'Tipe identitas' },
    { name: 'CodeSystem/patient-contact-relationship', module: 'insuree', note: 'Hubungan keluarga' },
    { name: 'CodeSystem/group-type', module: 'insuree', note: 'Tipe keluarga' },
    { name: 'CodeSystem/group-confirmation-type', module: 'insuree', note: 'Tipe konfirmasi' },
    { name: 'CodeSystem/organization-ph-legal-form', module: 'policyholder', note: 'Badan hukum PH' },
    { name: 'CodeSystem/organization-ph-activity', module: 'policyholder', note: 'Aktivitas PH' },
    { name: 'ValueSet/items-pricelist', module: 'medical', note: 'ValueSet harga obat' },
    { name: 'ValueSet/services-pricelist', module: 'medical', note: 'ValueSet tarif tindakan' }
  ];

  function moduleLabel(key) {
    const m = MODULES.find(x => x.key === key);
    return m ? m.label : key;
  }

  function stats() {
    const q = OPERATIONS.filter(o => o.kind === 'query').length;
    const m = OPERATIONS.filter(o => o.kind === 'mutation').length;
    const ui = OPERATIONS.filter(o => o.status === 'ui').length;
    return {
      queries: q,
      mutations: m,
      totalGraphQL: q + m,
      exercised: ui,
      catalogOnly: OPERATIONS.length - ui,
      modules: MODULES.length,
      fhir: FHIR_RESOURCES.length
    };
  }

  return {
    MODULES,
    OPERATIONS,
    FHIR_RESOURCES,
    moduleLabel,
    stats,
    get: name => OPERATIONS.find(o => o.name === name),
    byModule: key => OPERATIONS.filter(o => o.module === key)
  };
})();

window.ApiCatalog = ApiCatalog;
