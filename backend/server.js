const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/creatives', require('./routes/creatives'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/baidu', require('./routes/baidu'));
app.use('/api/kuaishou', require('./routes/kuaishou'));
app.use('/api/jliang', require('./routes/jliang'));
app.use('/api/google', require('./routes/google'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
