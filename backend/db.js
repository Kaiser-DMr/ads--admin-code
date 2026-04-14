const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.AD_ADMIN_DB_PATH || path.join(__dirname, 'ad_admin.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((col) => col.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    budget REAL NOT NULL DEFAULT 0,
    total_budget REAL,
    daily_budget REAL,
    spent REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    platform TEXT DEFAULT 'all',
    targeting TEXT DEFAULT '{}',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    requires_review INTEGER DEFAULT 0,
    auto_activate INTEGER DEFAULT 1,
    submitted_at DATETIME,
    approved_by INTEGER,
    approved_at DATETIME,
    completed_at DATETIME,
    terminated_at DATETIME,
    status_reason TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS creatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    campaign_id INTEGER,
    type TEXT NOT NULL DEFAULT 'image',
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend REAL DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );
`);

[
  ['total_budget', 'REAL'],
  ['daily_budget', 'REAL'],
  ['requires_review', 'INTEGER DEFAULT 0'],
  ['auto_activate', 'INTEGER DEFAULT 1'],
  ['submitted_at', 'DATETIME'],
  ['approved_by', 'INTEGER'],
  ['approved_at', 'DATETIME'],
  ['completed_at', 'DATETIME'],
  ['terminated_at', 'DATETIME'],
  ['status_reason', 'TEXT']
].forEach(([column, definition]) => ensureColumn('campaigns', column, definition));

db.exec(`
  UPDATE campaigns
  SET
    total_budget = COALESCE(total_budget, budget),
    daily_budget = COALESCE(
      daily_budget,
      CASE
        WHEN COALESCE(total_budget, budget) IS NOT NULL THEN ROUND(COALESCE(total_budget, budget) / 30.0, 2)
        ELSE NULL
      END
    )
  WHERE total_budget IS NULL OR daily_budget IS NULL
`);

// Seed default admin
const shouldSeed = process.env.AD_ADMIN_SEED !== 'false' && process.env.NODE_ENV !== 'production';
if (shouldSeed) {
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (adminExists) {
    module.exports = db;
  } else {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (username, password, role, email) VALUES (?, ?, 'admin', ?)").run('admin', hash, 'admin@example.com');
  db.prepare("INSERT INTO users (username, password, role, email) VALUES (?, ?, 'operator', ?)").run('operator1', bcrypt.hashSync('op123', 10), 'op1@example.com');
  db.prepare("INSERT INTO users (username, password, role, email) VALUES (?, ?, 'viewer', ?)").run('viewer1', bcrypt.hashSync('view123', 10), 'viewer1@example.com');

  const platforms = ['iOS', 'Android', 'Web', 'all'];
  const statuses = ['active', 'pending_start', 'pending_review', 'paused', 'completed', 'draft'];
  const names = ['618大促推广', '品牌曝光计划', '新用户拉新', '暑期营销活动', '国庆节专项', '双十一预热'];
  const seedCampaign = db.prepare(`
    INSERT INTO campaigns (
      name,
      status,
      budget,
      total_budget,
      daily_budget,
      spent,
      start_date,
      end_date,
      platform,
      impressions,
      clicks,
      conversions,
      created_by,
      requires_review,
      auto_activate,
      submitted_at,
      approved_by,
      approved_at,
      completed_at,
      terminated_at,
      status_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const campaignIds = [];
  names.forEach((name, i) => {
    const budget = Math.round((Math.random() * 50000 + 5000) * 100) / 100;
    const totalBudget = budget;
    const dailyBudget = Math.round((budget / 30) * 100) / 100;
    const status = statuses[i];
    const isLive = ['active', 'paused', 'completed'].includes(status);
    const spent = isLive ? Math.round(budget * (Math.random() * 0.85 + 0.05) * 100) / 100 : 0;
    const impressions = isLive ? Math.floor(spent * (Math.random() * 200 + 100)) : 0;
    const clicks = isLive ? Math.floor(impressions * (Math.random() * 0.05 + 0.01)) : 0;
    const conversions = isLive ? Math.floor(clicks * (Math.random() * 0.1 + 0.02)) : 0;
    const requiresReview = status === 'pending_review' ? 1 : 0;
    const autoActivate = status === 'draft' ? 0 : 1;
    const submittedAt = status === 'draft' ? null : `2026-02-0${i + 1}T09:00:00Z`;
    const approvedBy = ['active', 'pending_start', 'paused', 'completed'].includes(status) ? 1 : null;
    const approvedAt = approvedBy ? `2026-02-1${i}T10:00:00Z` : null;
    const completedAt = status === 'completed' ? '2026-03-20T12:00:00Z' : null;
    const terminatedAt = null;
    const statusReasonMap = {
      active: 'Running normally',
      pending_start: 'Scheduled for launch',
      pending_review: 'Awaiting review',
      paused: 'Paused by operator',
      completed: 'Completed successfully',
      draft: 'Draft in progress'
    };
    const statusReason = statusReasonMap[status];
    const result = seedCampaign.run(
      name,
      status,
      budget,
      totalBudget,
      dailyBudget,
      spent,
      '2026-01-01',
      '2026-12-31',
      platforms[i % 4],
      impressions,
      clicks,
      conversions,
      requiresReview,
      autoActivate,
      submittedAt,
      approvedBy,
      approvedAt,
      completedAt,
      terminatedAt,
      statusReason
    );
    campaignIds.push(result.lastInsertRowid);
  });

  const seedStat = db.prepare('INSERT INTO daily_stats (campaign_id, date, impressions, clicks, spend, conversions) VALUES (?, ?, ?, ?, ?, ?)');
  const today = new Date('2026-04-06');
  campaignIds.forEach((cid, ci) => {
    if (!['active', 'paused', 'completed'].includes(statuses[ci])) return;
    for (let d = 29; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const impressions = Math.floor(Math.random() * 8000 + 1000);
      const clicks = Math.floor(impressions * (Math.random() * 0.04 + 0.01));
      const spend = Math.round(clicks * (Math.random() * 2 + 0.5) * 100) / 100;
      const conversions = Math.floor(clicks * (Math.random() * 0.08 + 0.01));
      seedStat.run(cid, dateStr, impressions, clicks, spend, conversions);
    }
  });

  const seedCreative = db.prepare('INSERT INTO creatives (name, campaign_id, type, status, created_by) VALUES (?, ?, ?, ?, 1)');
  const creativeTypes = ['image', 'video', 'text'];
  const creativeStatuses = ['approved', 'approved', 'pending', 'rejected'];
  campaignIds.forEach((cid, ci) => {
    for (let j = 0; j < 3; j++) {
      seedCreative.run(`素材_${names[ci]}_${j + 1}`, cid, creativeTypes[j % 3], creativeStatuses[(ci + j) % 4]);
    }
  });
  }
}

module.exports = db;
