const router = require('express').Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  PLATFORM_CONNECTION_DEFINITIONS,
  parseConfig,
  listAvailableAuthTypes,
  validateConnectionPayload,
  serializeConnectionDetail,
  serializeConnectionSummary
} = require('../lib/platformConnections');

router.use(authenticate);
router.use(requireRole('admin'));

function getConnection(platform) {
  return db.prepare('SELECT * FROM platform_connections WHERE platform = ?').get(platform);
}

router.get('/', (_req, res) => {
  const rows = Object.keys(PLATFORM_CONNECTION_DEFINITIONS).map((platform) => {
    const row = getConnection(platform);
    return (
      row || {
        platform,
        auth_type: PLATFORM_CONNECTION_DEFINITIONS[platform].supportedAuthTypes[0],
        status: 'unconfigured',
        updated_at: null,
        updated_by: null
      }
    );
  });

  res.json(rows.map(serializeConnectionSummary));
});

router.get('/:platform', (req, res) => {
  const { platform } = req.params;
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  if (!definition) return res.status(404).json({ message: '平台不存在' });

  const row =
    getConnection(platform) || {
      platform,
      auth_type: definition.supportedAuthTypes[0],
      config_json: '{}',
      status: 'unconfigured',
      updated_at: null,
      updated_by: null
    };

  res.json({
    ...serializeConnectionDetail(row),
    availableAuthTypes: listAvailableAuthTypes(platform)
  });
});

router.put('/:platform', (req, res) => {
  const { platform } = req.params;
  const existing = getConnection(platform);
  const previousConfig = existing ? parseConfig(existing.config_json) : {};

  try {
    const { merged, missing } = validateConnectionPayload(
      platform,
      req.body.auth_type,
      req.body.config || {},
      previousConfig
    );
    if (missing.length) {
      return res.status(400).json({ message: '缺少必填字段', missing_fields: missing });
    }

    if (existing) {
      db.prepare(
        `
        UPDATE platform_connections
        SET auth_type = ?, config_json = ?, status = 'configured', last_error = NULL, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE platform = ?
      `
      ).run(req.body.auth_type, JSON.stringify(merged), req.user.id, platform);
    } else {
      db.prepare(
        `
        INSERT INTO platform_connections (platform, auth_type, config_json, status, updated_by)
        VALUES (?, ?, ?, 'configured', ?)
      `
      ).run(platform, req.body.auth_type, JSON.stringify(merged), req.user.id);
    }

    res.json(serializeConnectionSummary(getConnection(platform)));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:platform/test', (req, res) => {
  const { platform } = req.params;
  const row = getConnection(platform);
  if (!row) return res.status(404).json({ message: '平台尚未配置' });

  const { missing } = validateConnectionPayload(
    platform,
    row.auth_type,
    {},
    parseConfig(row.config_json)
  );
  res.json({
    ok: missing.length === 0,
    missing_fields: missing,
    message: missing.length ? '仍有必填字段缺失' : '本地校验通过'
  });
});

module.exports = router;
