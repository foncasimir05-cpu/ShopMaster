/**
 * Tenant isolation middleware — must be used after authenticateToken.
 *
 * Rejects any request where a shopId value in the URL params, query string,
 * or request body differs from the authenticated user's shopId.  This provides
 * a belt-and-suspenders guard on top of per-query tenant_id filters.
 */
function tenantIsolation(req, res, next) {
  if (!req.shopId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const claimed =
    req.params.shopId ||
    req.query.shopId ||
    (req.body && req.body.shopId);

  if (claimed && claimed !== req.shopId) {
    return res.status(403).json({ error: 'Access denied: cross-tenant access is not permitted' });
  }

  next();
}

module.exports = { tenantIsolation };
