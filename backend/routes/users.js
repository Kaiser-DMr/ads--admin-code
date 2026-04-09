const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireRole('admin'), (req, res) => {
  const rows = db.prepare('SELECT id, username, role, email, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { username, password, role = 'operator', email } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
  if (!['admin', 'operator', 'viewer'].includes(role)) return res.status(400).json({ message: '角色无效' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ message: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)').run(username, hash, role, email || null);
  const user = db.prepare('SELECT id, username, role, email, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { role, email, status, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  // Prevent demoting the only admin
  if (role && role !== 'admin' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get().cnt;
    if (adminCount <= 1) return res.status(400).json({ message: '至少保留一个管理员' });
  }
  const newPassword = password ? bcrypt.hashSync(password, 10) : user.password;
  db.prepare('UPDATE users SET role = ?, email = ?, status = ?, password = ? WHERE id = ?').run(
    role ?? user.role, email ?? user.email, status ?? user.status, newPassword, req.params.id
  );
  res.json(db.prepare('SELECT id, username, role, email, status, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ message: '不能删除自己' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

module.exports = router;
