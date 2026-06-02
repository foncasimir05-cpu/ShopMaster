/**
 * Shared type definitions (JSDoc-style) for use across backend and mobile.
 * These are runtime constants, not TypeScript — they serve as documentation
 * and allow runtime validation helpers.
 */

/** @enum {string} */
const UserRole = Object.freeze({
  ADMIN: 'admin',
  STAFF: 'staff',
});

/** @enum {string} */
const SaleStatus = Object.freeze({
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
});

/**
 * @typedef {object} Tenant
 * @property {string} id
 * @property {string} name
 * @property {string} created_at
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} email
 * @property {UserRole} role
 * @property {string} created_at
 */

/**
 * @typedef {object} Product
 * @property {string}  id
 * @property {string}  tenant_id
 * @property {string}  name
 * @property {string}  [sku]
 * @property {string}  [barcode]
 * @property {number}  price
 * @property {number}  cost
 * @property {number}  stock
 * @property {string}  [category]
 * @property {string}  created_at
 * @property {string}  updated_at
 */

/**
 * @typedef {object} CartItem
 * @property {Product} product
 * @property {number}  quantity
 */

/**
 * @typedef {object} Sale
 * @property {string}     id
 * @property {string}     tenant_id
 * @property {string}     user_id
 * @property {number}     total
 * @property {number}     discount
 * @property {number}     tax
 * @property {SaleStatus} status
 * @property {string}     created_at
 */

module.exports = { UserRole, SaleStatus };
