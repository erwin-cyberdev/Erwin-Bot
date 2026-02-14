// Configuration pour le mode admin-only
let adminOnlyMode = false;

function isAdminOnly() {
  return adminOnlyMode;
}

function setAdminOnly(enabled) {
  adminOnlyMode = enabled;
  return adminOnlyMode;
}

export { isAdminOnly, setAdminOnly };
