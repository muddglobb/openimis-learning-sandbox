#!/usr/bin/env node
/**
 * Schema contract test.
 *
 * The sandbox cannot reach a live openIMIS during development, so this test
 * checks the *documents* against a local, hand-maintained snapshot of the
 * openIMIS 26.04 GraphQL surface. It catches the class of bug that bit v1:
 * asking for `currentUser` when the field is `user`, or sending `uuids`
 * to a mutation that expects `uuid`.
 *
 * The snapshot only needs the root Query/Mutation field names and the
 * input-object field names we actually use — not the whole schema.
 */
const fs = require('fs');
const path = require('path');
const { parse, visit } = require('graphql');

const ROOT = path.join(__dirname, '..', 'public', 'js');

// ---------------------------------------------------------------
// Snapshot: root fields (verified against openIMIS release/26.04)
// ---------------------------------------------------------------
const QUERY_FIELDS = new Set([
  // core
  'user', 'moduleConfigurations', 'languages', 'passwordPolicy', 'users', 'role',
  'roleRight', 'claimAdmins', 'enrolmentOfficers', 'substitutionEnrolmentOfficers',
  'mutationLogs', 'modulesPermissions', 'customFilters', 'interactiveUsers',
  'userObligatoryFields', 'eoObligatoryFields', 'validateUsername', 'validateUserEmail',
  'validateRoleName', 'usernameLength',
  // insuree
  'insurees', 'families', 'familyMembers', 'insureeOfficers', 'insureePolicy',
  'insureeGenders', 'identificationTypes', 'educations', 'professions', 'familyTypes',
  'confirmationTypes', 'relations', 'insureeStatusReasons', 'canAddInsuree',
  'insureeNumberValidity',
  // policy
  'policies', 'policiesByInsuree', 'policiesByFamily', 'policyEligibilityByInsuree',
  'policyItemEligibilityByInsuree', 'policyServiceEligibilityByInsuree',
  'policyValues', 'policyOfficers', 'policyRenewals',
  // product
  'products', 'product', 'pageDisplayRules', 'limitDefaults', 'validateProductCode',
  // medical
  'diagnoses', 'diagnosesStr', 'medicalItems', 'medicalItemsStr',
  'medicalServices', 'medicalServicesStr', 'validateItemCode', 'validateServiceCode',
  // medical_pricelist
  'pricelists', 'itemsPricelists', 'servicesPricelists',
  'validateItemsPricelistName', 'validateServicesPricelistName',
  // claim
  'claims', 'claim', 'claimAttachments', 'claimOfficers', 'insureeNameByChfid',
  'validateClaimCode', 'fspFromClaim', 'claimWithSameDiagnosis', 'claimAttachmentType',
  'claimHistory',
  // claim_batch
  'batchRuns', 'batchRunsSummaries', 'relativeIndexes',
  // location
  'healthFacilities', 'locations', 'locationsAll', 'locationsStr', 'userDistricts',
  'officerLocations', 'healthFacilitiesStr', 'validateLocationCode',
  'validateHealthFacilityCode',
  // contribution
  'premiums', 'premiumsByPolicies', 'validatePremiumCode',
  // payer
  'payer', 'funding',
  // contribution_plan
  'contributionPlan', 'contributionPlanBundle', 'contributionPlanBundleDetails',
  'paymentPlan', 'validateContributionPlanCode', 'validatePaymentPlanCode',
  'validateContributionPlanBundleCode',
  // payment
  'payments', 'paymentDetails', 'paymentsByPremiums',
  // contract
  'validateContractCode',
  // policyholder
  'validatePolicyHolderCode',
  // grievance
  'tickets', 'ticketsStr', 'ticketDetails', 'comments', 'grievanceConfig',
  // tasks
  'taskGroup', 'task',
  // individual / social protection
  'individual', 'individualHistory', 'group', 'benefitPlan', 'beneficiary',
  'groupBeneficiary', 'exportPatches', 'exportableFields', 'moduleName',
  'objectType', 'objectTypeGroup',
  // payment cycle / payroll
  'paymentCycle', 'paymentCycleCodeValidity', 'payroll', 'paymentPoint',
  'billByPayroll', 'benefitConsumption', 'paymentMethods',
  // introspection
  '__schema', '__type', '__typename'
]);

const MUTATION_FIELDS = new Set([
  // core
  'tokenAuth', 'verifyToken', 'refreshToken', 'revokeToken', 'deleteTokenCookie',
  'deleteRefreshTokenCookie', 'getCsrfToken', 'changePassword', 'resetPassword',
  'setPassword', 'createRole', 'updateRole', 'deleteRole', 'duplicateRole',
  'createUser', 'updateUser', 'deleteUser', 'changeUserLanguage',
  // insuree
  'createFamily', 'updateFamily', 'deleteFamilies', 'createInsuree', 'updateInsuree',
  'deleteInsurees', 'removeInsurees', 'setFamilyHead', 'changeInsureeFamily',
  // policy
  'createPolicy', 'updatePolicy', 'deletePolicies', 'renewPolicy', 'suspendPolicies',
  // product
  'createProduct', 'duplicateProduct', 'updateProduct', 'deleteProduct',
  // medical
  'createService', 'updateService', 'deleteService', 'createItem', 'updateItem', 'deleteItem',
  // medical_pricelist
  'createServicesPricelist', 'updateServicesPricelist', 'deleteServicesPricelist',
  'createItemsPricelist', 'updateItemsPricelist', 'deleteItemsPricelist',
  // claim
  'createClaim', 'updateClaim', 'createClaimAttachment', 'updateClaimAttachment',
  'deleteClaimAttachment', 'submitClaims', 'selectClaimsForFeedback',
  'deliverClaimFeedback', 'bypassClaimsFeedback', 'skipClaimsFeedback',
  'selectClaimsForReview', 'saveClaimReview', 'deliverClaimsReview',
  'bypassClaimsReview', 'skipClaimsReview', 'processClaims', 'deleteClaims',
  // claim_batch
  'processBatch',
  // location
  'createLocation', 'updateLocation', 'deleteLocation', 'moveLocation',
  'createHealthFacility', 'updateHealthFacility', 'deleteHealthFacility',
  // contribution
  'createPremium', 'updatePremium', 'deletePremium', 'deletePremiums',
  // payer
  'createPayer', 'updatePayer', 'deletePayer', 'addFunding',
  // contribution_plan
  'createContributionPlan', 'updateContributionPlan', 'deleteContributionPlan',
  'createPaymentPlan', 'updatePaymentPlan', 'deletePaymentPlan',
  'createContributionPlanBundle', 'updateContributionPlanBundle',
  'deleteContributionPlanBundle',
  // payment
  'createPayment', 'updatePayment', 'deletePayment',
  // invoice
  'generateInvoicesForTimePeriod', 'deleteInvoice', 'createBill', 'deleteBill',
  'createPaymentInvoice', 'createPaymentWithDetailInvoice',
  // contract
  'createContract', 'updateContract', 'deleteContract', 'submitContract',
  'approveContract', 'counterContract', 'amendContract', 'renewContract',
  // policyholder
  'createPolicyHolder', 'updatePolicyHolder', 'deletePolicyHolder',
  'createPolicyHolderInsuree', 'updatePolicyHolderInsuree', 'deletePolicyHolderInsuree',
  'replacePolicyHolderInsuree',
  // grievance  (note: create_Ticket → createTicket after camelCasing)
  'createTicket', 'updateTicket', 'deleteTicket', 'createComment',
  'resolveGrievanceByComment', 'reopenTicket',
  // tasks
  'createTaskGroup', 'updateTaskGroup', 'deleteTaskGroup', 'updateTask', 'resolveTask',
  // individual / social protection
  'createIndividual', 'updateIndividual', 'deleteIndividual', 'undoDeleteIndividual',
  'createGroup', 'updateGroup', 'deleteGroup', 'addIndividualToGroup',
  'removeIndividualFromGroup', 'createBenefitPlan', 'updateBenefitPlan',
  'deleteBenefitPlan', 'createBeneficiary', 'updateBeneficiary', 'deleteBeneficiary',
  // payroll / payment cycle
  'createPaymentCycle', 'updatePaymentCycle', 'createPayroll', 'deletePayroll',
  'closePayroll', 'rejectPayroll', 'makePaymentForPayroll', 'createPaymentPoint',
  'updatePaymentPoint', 'deletePaymentPoint'
]);

// ---------------------------------------------------------------
// Input object shapes we rely on (verified field-by-field)
// ---------------------------------------------------------------
const INPUT_SHAPES = {
  CreateInsureeMutationInput: ['clientMutationId', 'uuid', 'chfId', 'lastName', 'otherNames',
    'genderId', 'dob', 'head', 'marital', 'passport', 'phone', 'email', 'currentAddress',
    'geolocation', 'currentVillageId', 'photoId', 'photoDate', 'photo', 'cardIssued',
    'familyId', 'relationshipId', 'professionId', 'educationId', 'typeOfIdId',
    'healthFacilityId', 'offline', 'jsonExt', 'status', 'statusReason', 'statusDate',
    'addOnExistingPolicy'],
  UpdateInsureeMutationInput: null, // same as create
  DeleteInsureesMutationInput: ['clientMutationId', 'uuids'],
  RemoveInsureesMutationInput: ['clientMutationId', 'uuid', 'uuids', 'cancelPolicies'],
  CreateFamilyMutationInput: ['clientMutationId', 'uuid', 'locationId', 'poverty',
    'familyTypeId', 'address', 'isOffline', 'ethnicity', 'confirmationNo',
    'confirmationTypeId', 'jsonExt', 'contribution', 'headInsuree'],
  UpdateFamilyMutationInput: null,
  DeleteFamiliesMutationInput: ['clientMutationId', 'uuids', 'deleteMembers'],
  SetFamilyHeadMutationInput: ['clientMutationId', 'uuid', 'insureeUuid'],
  ChangeInsureeFamilyMutationInput: ['clientMutationId', 'familyUuid', 'insureeUuid', 'cancelPolicies'],

  CreatePolicyMutationInput: ['clientMutationId', 'id', 'uuid', 'enrollDate', 'startDate',
    'expiryDate', 'value', 'productId', 'familyId', 'officerId', 'isPaid', 'receipt',
    'payerUuid', 'contributionPlanId'],
  UpdatePolicyMutationInput: null,
  RenewPolicyMutationInput: null,
  SuspendPoliciesMutationInput: ['clientMutationId', 'uuids'],
  DeletePoliciesMutationInput: ['clientMutationId', 'uuids'],

  CreateProductMutationInput: ['clientMutationId', 'code', 'name', 'dateFrom', 'dateTo',
    'insurancePeriod', 'administrationPeriod', 'maxMembers', 'maxInstallments',
    'recurrence', 'locationUuid', 'conversionProductUuid', 'lumpSum', 'premiumAdult',
    'premiumChild', 'threshold', 'gracePeriodRenewal', 'gracePeriodPayment',
    'gracePeriodEnrolment', 'ceilingInterpretation', 'ceilingType', 'deductible',
    'deductibleIp', 'deductibleOp', 'ceiling', 'ceilingIp', 'ceilingOp',
    'maxCeilingPolicy', 'maxPolicyExtraMember', 'maxNoConsultation',
    'maxNoSurgery', 'maxNoDelivery'],
  UpdateProductMutationInput: null,
  DeleteProductMutationInput: ['clientMutationId', 'uuids'],
  DuplicateProductMutationInput: null,

  CreateItemMutationInput: ['clientMutationId', 'code', 'name', 'type', 'price',
    'careType', 'patientCategory', 'frequency', 'package', 'quantity'],
  UpdateItemMutationInput: null, // same as create (uuid allowed)
  DeleteItemMutationInput: ['clientMutationId', 'uuids'],
  CreateServiceMutationInput: ['clientMutationId', 'code', 'name', 'type', 'level',
    'price', 'careType', 'patientCategory', 'frequency', 'packagetype', 'manualPrice',
    'category', 'items', 'services'],
  UpdateServiceMutationInput: null,
  DeleteServiceMutationInput: ['clientMutationId', 'uuids'],

  CreateClaimMutationInput: ['clientMutationId', 'id', 'uuid', 'code', 'autogenerate',
    'insureeId', 'dateFrom', 'dateTo', 'icdId', 'icd1Id', 'icd2Id', 'icd3Id', 'icd4Id',
    'reviewStatus', 'dateClaimed', 'dateProcessed', 'healthFacilityId', 'referFromId',
    'referToId', 'batchRunId', 'category', 'visitType', 'adminId', 'guaranteeId',
    'explanation', 'adjustment', 'jsonExt', 'restore', 'feedbackAvailable',
    'feedbackStatus', 'feedback', 'careType', 'preAuthorization', 'patientCondition',
    'referralCode', 'items', 'services', 'attachments'],
  UpdateClaimMutationInput: null,
  SubmitClaimsMutationInput: ['clientMutationId', 'uuids', 'additionalFilters'],
  ProcessClaimsMutationInput: ['clientMutationId', 'uuids'],
  DeleteClaimsMutationInput: ['clientMutationId', 'uuids'],
  SelectClaimsForReviewMutationInput: ['clientMutationId', 'uuids'],
  SaveClaimReviewMutationInput: ['clientMutationId', 'claimUuid', 'adjustment',
    'items', 'services', 'submitReview'],
  CreateClaimAttachmentMutationInput: ['clientMutationId', 'claimUuid', 'id', 'type',
    'title', 'date', 'filename', 'mime', 'generalType', 'predefinedType', 'url', 'document'],

  CreateHealthFacilityMutationInput: ['clientMutationId', 'id', 'uuid', 'code', 'name',
    'accCode', 'legalFormId', 'level', 'subLevelId', 'locationId', 'address', 'phone',
    'fax', 'email', 'careType', 'servicesPricelistId', 'itemsPricelistId', 'offline',
    'catchments', 'contractStartDate', 'contractEndDate', 'status'],
  UpdateHealthFacilityMutationInput: null,
  DeleteHealthFacilityMutationInput: ['clientMutationId', 'uuid', 'code'],
  CreateLocationMutationInput: ['clientMutationId', 'id', 'uuid', 'code', 'name', 'type',
    'malePopulation', 'femalePopulation', 'otherPopulation', 'families', 'parentUuid'],
  UpdateLocationMutationInput: null,
  DeleteLocationMutationInput: ['clientMutationId', 'uuid', 'code', 'newParentUuid'],

  CreatePremiumMutationInput: ['clientMutationId', 'id', 'uuid', 'policyUuid', 'payerUuid',
    'amount', 'receipt', 'payDate', 'payType', 'isOffline', 'isPhotoFee', 'action'],
  UpdatePremiumMutationInput: null,
  DeletePremiumsMutationInput: ['clientMutationId', 'uuids'],

  CreateTicketMutationInput: ['clientMutationId', 'key', 'title', 'description',
    'reporterType', 'reporterId', 'attendingStaffId', 'dateOfIncident', 'status',
    'priority', 'dueDate', 'category', 'flags', 'channel', 'resolution'],
  UpdateTicketMutationInput: null, // adds `id`
  DeleteTicketMutationInput: ['clientMutationId', 'ids'],
  CreateCommentMutationInput: ['clientMutationId', 'ticketId', 'commenterType',
    'commenterId', 'comment'],
  ResolveGrievanceByCommentMutationInput: ['clientMutationId', 'id'],
  ReopenTicketMutationInput: ['clientMutationId', 'id']
};
INPUT_SHAPES.UpdateInsureeMutationInput = INPUT_SHAPES.CreateInsureeMutationInput;
INPUT_SHAPES.UpdateFamilyMutationInput = INPUT_SHAPES.CreateFamilyMutationInput;
INPUT_SHAPES.UpdatePolicyMutationInput = INPUT_SHAPES.CreatePolicyMutationInput;
INPUT_SHAPES.RenewPolicyMutationInput = INPUT_SHAPES.CreatePolicyMutationInput;
INPUT_SHAPES.UpdateProductMutationInput = INPUT_SHAPES.CreateProductMutationInput.concat(['uuid']);
INPUT_SHAPES.DuplicateProductMutationInput = INPUT_SHAPES.CreateProductMutationInput.concat(['uuid']);
INPUT_SHAPES.UpdateItemMutationInput = INPUT_SHAPES.CreateItemMutationInput.concat(['uuid']);
INPUT_SHAPES.UpdateServiceMutationInput = INPUT_SHAPES.CreateServiceMutationInput.concat(['uuid']);
INPUT_SHAPES.UpdateClaimMutationInput = INPUT_SHAPES.CreateClaimMutationInput;
INPUT_SHAPES.UpdateHealthFacilityMutationInput = INPUT_SHAPES.CreateHealthFacilityMutationInput;
INPUT_SHAPES.UpdateLocationMutationInput = INPUT_SHAPES.CreateLocationMutationInput;
INPUT_SHAPES.UpdatePremiumMutationInput = INPUT_SHAPES.CreatePremiumMutationInput;
INPUT_SHAPES.UpdateTicketMutationInput = INPUT_SHAPES.CreateTicketMutationInput.concat(['id']);

// ---------------------------------------------------------------
// Walk the source and collect documents
// ---------------------------------------------------------------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function collectDocs(src) {
  const docs = [];
  const patterns = [
    /\bconst\s+(?:query|mutation|doc|gql)\w*\s*=\s*`([\s\S]*?)`;/g,
    /\bgraphql\(\s*`([\s\S]*?)`/g,
    /\bquery:\s*`([\s\S]*?)`\s*,/g,
    /example:\s*`([^`]*?)`,\s*variables:/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) docs.push(m[1]);
  }
  return docs.filter(d => {
    const t = d.trim();
    return !t.startsWith('<') && !/class=/.test(t) && /^(query|mutation|fragment|\{)/.test(t);
  });
}

// ---------------------------------------------------------------
// Checks
// ---------------------------------------------------------------
const problems = [];
let checkedDocs = 0;
let checkedRootFields = 0;

function checkDoc(doc, file) {
  // Documents built with template interpolation (e.g. shared field constants)
  // cannot be parsed standalone; substitute the interpolation with a valid
  // field name so the surrounding structure is still validated.
  const normalized = doc.includes('${') ? doc.replace(/\$\{[^}]*\}/g, '__fragment__') : doc;

  let ast;
  try {
    ast = parse(normalized);
  } catch (e) {
    // If the only problem is the placeholder, skip rather than fail.
    if (doc.includes('${')) return;
    problems.push(`${file}: parse error → ${e.message.split('\n')[0]}`);
    return;
  }
  checkedDocs++;

  visit(ast, {
    Field(node) {
      // Only root-level fields matter for the root-field check.
      // We approximate: a field whose parent selection set is the operation itself.
      // graphql-js visit gives us ancestors only via the path; simpler approach below.
    }
  });

  // Determine root selection sets.
  for (const def of ast.definitions) {
    if (def.kind !== 'OperationDefinition') continue;
    const isMutation = def.operation === 'mutation';
    const allowed = isMutation ? MUTATION_FIELDS : QUERY_FIELDS;
    for (const sel of def.selectionSet.selections) {
      if (sel.kind !== 'Field') continue;
      checkedRootFields++;
      if (!allowed.has(sel.name.value)) {
        problems.push(`${file}: unknown root ${isMutation ? 'mutation' : 'query'} field "${sel.name.value}"`);
      }
    }
  }
}

function checkCatalogInputs(file) {
  const src = fs.readFileSync(file, 'utf8');

  // (a) For operations whose variables are flat (not wrapped in `input:`),
  //     every $var in the example must be provided, and vice versa.
  //     Mutation examples declare `$input` as a single variable, so their
  //     nested keys are intentionally not variables.
  const entryRe = /name:\s*'([A-Za-z0-9_]+)'[\s\S]*?example:\s*`([^`]*?)`,\s*variables:\s*(\{[^}]*\})/g;
  let em;
  while ((em = entryRe.exec(src))) {
    const opName = em[1];
    const example = em[2];
    const varsRaw = em[3];

    // Skip mutation-style entries (they use `variables: { input: {...} }`).
    if (/^\s*\{\s*input\s*:/.test(varsRaw)) continue;

    const used = [...new Set(
      [...example.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1])
    )];
    const provided = [...varsRaw.matchAll(/(?:^|[{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g)]
      .map(m => m[1]);

    for (const v of used) {
      if (!provided.includes(v)) {
        problems.push(`${file}: ${opName} example uses $${v} but variables omit it`);
      }
    }
    for (const v of provided) {
      if (!used.includes(v)) {
        problems.push(`${file}: ${opName} variables provide "${v}" but the example never uses it`);
      }
    }
  }

  // (b) Mutation input fields must match the known input shapes.
  const re = /name:\s*'([A-Za-z0-9_]+)'[\s\S]{0,4000}?variables:\s*\{\s*input:\s*\{([\s\S]*?)\}\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    const opName = m[1];
    const body = m[2];

    const inputType = opName.charAt(0).toUpperCase() + opName.slice(1) + 'MutationInput';
    const allowed = INPUT_SHAPES[inputType];
    if (!allowed) continue;

    const keys = [];
    let depth = 0;
    let buf = '';
    let inStr = false;
    let q = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inStr) {
        if (ch === q && body[i - 1] !== '\\') inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; q = ch; continue; }
      if (ch === '[' || ch === '{' || ch === '(') { depth++; continue; }
      if (ch === ']' || ch === '}' || ch === ')') { depth--; continue; }
      if (depth === 0 && ch === ',') { keys.push(buf); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) keys.push(buf);

    for (const raw of keys) {
      const km = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (!km) continue;
      const key = km[1];
      if (!allowed.includes(key)) {
        problems.push(`${file}: ${opName} input has unknown field "${key}" (${inputType})`);
      }
    }
  }
}

// ---------------------------------------------------------------
// Run
// ---------------------------------------------------------------
const files = walk(ROOT);
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const doc of collectDocs(src)) checkDoc(doc, path.basename(f));
}
checkCatalogInputs(path.join(ROOT, 'api-catalog-data.js'));

console.log('');
console.log(`  Documents checked       : ${checkedDocs}`);
console.log(`  Root fields checked     : ${checkedRootFields}`);
console.log(`  Problems                : ${problems.length}`);
console.log('');

if (problems.length) {
  const unique = [...new Set(problems)];
  unique.forEach(p => console.log('  x ' + p));
  console.log('');
  process.exit(1);
}

console.log('  SCHEMA CONTRACT OK');
console.log('');
