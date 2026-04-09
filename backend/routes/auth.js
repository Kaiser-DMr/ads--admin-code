const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ message: '用户名或密码错误' });
  if (user.status !== 'active') return res.status(403).json({ message: '账号已禁用' });

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, role, email, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
