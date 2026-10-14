'use strict';
const cfg = require('./config'), { open } = require('./db'), { createApp } = require('./app');
const db = open(cfg.dbPath);
const server = createApp({ db });
if (!db.get('SELECT 1 FROM admins')) console.log('\n  No admin account yet. Run:  npm run seed   (dev)  or set ADMIN_EMAIL/ADMIN_PASSWORD and run it (production)\n');
server.listen(cfg.port, () => {
  console.log(`ExamPro running on http://localhost:${cfg.port}`);
  console.log(`  Student login  http://localhost:${cfg.port}/student/login`);
  console.log(`  Admin login    http://localhost:${cfg.port}/admin/login  (also: footer > Admin Login)`);
});
const stop = () => { server.close(); try { db.close(); } catch (e) {} process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
