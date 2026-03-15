import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("projects.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    app_name TEXT,
    current_status TEXT,
    analysis_session_date TEXT,
    brd_submission_date TEXT,
    brd_review_date TEXT,
    dev_session_date TEXT,
    development_start TEXT,
    development_end TEXT,
    demo_start TEXT,
    demo_end TEXT,
    uat_start TEXT,
    uat_end TEXT,
    deployment_start TEXT,
    deployment_end TEXT,
    go_live_start TEXT,
    go_live_end TEXT
  );

  CREATE TABLE IF NOT EXISTS status_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    status_date TEXT,
    note TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS stage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    stage TEXT,
    changed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: Rename department to category if it exists
try {
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
  const hasDepartment = tableInfo.some(col => col.name === 'department');
  const hasCategory = tableInfo.some(col => col.name === 'category');
  
  if (hasDepartment && !hasCategory) {
    db.exec("ALTER TABLE projects RENAME COLUMN department TO category");
    console.log("Migrated projects table: renamed department to category");
  } else if (!hasDepartment && !hasCategory) {
    // This case should be handled by CREATE TABLE IF NOT EXISTS, 
    // but just in case it was created with neither
    db.exec("ALTER TABLE projects ADD COLUMN category TEXT");
  }
} catch (err) {
  console.error("Migration failed or already applied", err);
}

// Seed data if empty
const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
if (projectCount.count === 0) {
  const seedCategories = ['Treasury', 'PMO', 'IT', 'Compliance', 'Call Center', 'Card Operations', 'Laserfiche', 'Appian Environment'];
  const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
  seedCategories.forEach(c => insertCategory.run(c));

  const seedProjects = [
    { cat: 'Laserfiche', name: 'Integration between Appian and Laserfiche', status: 'Analysis Session' },
    { cat: 'Appian Environment', name: 'Upgrade Development Environment', status: 'UAT' },
    { cat: 'Treasury', name: 'الموافقة على الايداع في حساب وديعة مربوطة - الخزينة', status: 'Development' },
    { cat: 'PMO', name: 'Project Initiative Form Submission and approval process', status: 'Demo' },
    { cat: 'IT', name: 'ATM Process', status: 'Demo' },
    { cat: 'Compliance', name: 'Workflow to track Fraud cases inside the bank', status: 'Development' },
    { cat: 'Call Center', name: 'A workflow to Automate Call Center logs', status: 'BRD Review & Sign-Off' },
    { cat: 'Card Operations', name: 'أتمتة عملية ترحيل القيود المالية في دائرة المطالبات', status: 'BRD Review & Sign-Off' }
  ];

  const insertProject = db.prepare("INSERT INTO projects (category, app_name, current_status) VALUES (?, ?, ?)");
  const insertUpdate = db.prepare("INSERT INTO status_updates (project_id, status_date, note) VALUES (?, ?, ?)");

  seedProjects.forEach(p => {
    const info = insertProject.run(p.cat, p.name, p.status);
    const projectId = info.lastInsertRowid;
    
    // Add some dummy history
    insertUpdate.run(projectId, '2026-02-26', `Initial status for ${p.name}`);
    insertUpdate.run(projectId, '2026-03-03', `Progress update for ${p.name}`);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects").all();
    const updates = db.prepare("SELECT * FROM status_updates ORDER BY status_date DESC").all();
    const stageLogs = db.prepare("SELECT * FROM stage_logs ORDER BY changed_at DESC").all();
    
    const projectsWithUpdates = projects.map(p => ({
      ...p,
      updates: updates.filter(u => u.project_id === p.id),
      stageLogs: stageLogs.filter(l => l.project_id === p.id)
    }));
    
    res.json(projectsWithUpdates);
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name, is_active: 1 });
    } catch (err) {
      res.status(400).json({ error: "Category already exists" });
    }
  });

  app.patch("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    if (name !== undefined && is_active !== undefined) {
      db.prepare("UPDATE categories SET name = ?, is_active = ? WHERE id = ?").run(name, is_active, id);
    } else if (name !== undefined) {
      db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
    } else if (is_active !== undefined) {
      db.prepare("UPDATE categories SET is_active = ? WHERE id = ?").run(is_active, id);
    }
    
    res.json({ success: true });
  });

  app.post("/api/projects", (req, res) => {
    const { category, app_name, current_status } = req.body;
    const info = db.prepare("INSERT INTO projects (category, app_name, current_status) VALUES (?, ?, ?)").run(category, app_name, current_status);
    const projectId = info.lastInsertRowid;
    
    // Initial stage log
    db.prepare("INSERT INTO stage_logs (project_id, stage, changed_at) VALUES (?, ?, ?)").run(projectId, current_status, new Date().toISOString());
    
    res.json({ id: projectId });
  });

  app.post("/api/updates", (req, res) => {
    const { project_id, status_date, note } = req.body;
    db.prepare("INSERT INTO status_updates (project_id, status_date, note) VALUES (?, ?, ?)").run(project_id, status_date, note);
    res.json({ success: true });
  });

  app.patch("/api/updates/:id", (req, res) => {
    const { id } = req.params;
    const { status_date, note } = req.body;
    db.prepare("UPDATE status_updates SET status_date = ?, note = ? WHERE id = ?").run(status_date, note, id);
    res.json({ success: true });
  });

  app.patch("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const oldProject = db.prepare("SELECT current_status FROM projects WHERE id = ?").get(id) as { current_status: string };
    
    const bodyKeys = Object.keys(req.body);
    if (bodyKeys.length === 0) {
      return res.json({ success: true });
    }

    const fields = bodyKeys.map(key => `${key} = ?`).join(", ");
    const values = Object.values(req.body);
    db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, id);

    // Log stage change if current_status changed
    if (req.body.current_status && req.body.current_status !== oldProject.current_status) {
      db.prepare("INSERT INTO stage_logs (project_id, stage, changed_at) VALUES (?, ?, ?)").run(id, req.body.current_status, new Date().toISOString());
    }

    res.json({ success: true });
  });

  app.post("/api/import", (req, res) => {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    try {
      const transaction = db.transaction(() => {
        // Clear existing data
        db.prepare("DELETE FROM status_updates").run();
        db.prepare("DELETE FROM stage_logs").run();
        db.prepare("DELETE FROM projects").run();
        db.prepare("DELETE FROM categories").run();

        const categories = new Set<string>();
        data.forEach((row: any) => {
          if (row['Category']) categories.add(row['Category']);
        });

        const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
        categories.forEach(cat => insertCategory.run(cat));

        const insertProject = db.prepare(`
          INSERT INTO projects (
            category, app_name, current_status, 
            analysis_session_date, brd_submission_date, brd_review_date,
            dev_session_date, development_start, development_end,
            demo_start, demo_end, uat_start, uat_end,
            deployment_start, deployment_end, go_live_start, go_live_end
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertUpdate = db.prepare("INSERT INTO status_updates (project_id, status_date, note) VALUES (?, ?, ?)");
        const insertLog = db.prepare("INSERT INTO stage_logs (project_id, stage, changed_at) VALUES (?, ?, ?)");

        data.forEach((row: any) => {
          const info = insertProject.run(
            row['Category'] || '',
            row['App Name'] || 'Untitled Project',
            row['Current Stage'] || 'Analysis Session',
            row['Analysis Session Date'] && row['Analysis Session Date'] !== 'N/A' ? row['Analysis Session Date'] : null,
            row['BRD Submission Date'] && row['BRD Submission Date'] !== 'N/A' ? row['BRD Submission Date'] : null,
            row['BRD Review Date'] && row['BRD Review Date'] !== 'N/A' ? row['BRD Review Date'] : null,
            row['Dev Session Date'] && row['Dev Session Date'] !== 'N/A' ? row['Dev Session Date'] : null,
            row['Development Start'] && row['Development Start'] !== 'N/A' ? row['Development Start'] : null,
            row['Development End'] && row['Development End'] !== 'N/A' ? row['Development End'] : null,
            row['Demo Start'] && row['Demo Start'] !== 'N/A' ? row['Demo Start'] : null,
            row['Demo End'] && row['Demo End'] !== 'N/A' ? row['Demo End'] : null,
            row['UAT Start'] && row['UAT Start'] !== 'N/A' ? row['UAT Start'] : null,
            row['UAT End'] && row['UAT End'] !== 'N/A' ? row['UAT End'] : null,
            row['Deployment Start'] && row['Deployment Start'] !== 'N/A' ? row['Deployment Start'] : null,
            row['Deployment End'] && row['Deployment End'] !== 'N/A' ? row['Deployment End'] : null,
            row['Go Live Start'] && row['Go Live Start'] !== 'N/A' ? row['Go Live Start'] : null,
            row['Go Live End'] && row['Go Live End'] !== 'N/A' ? row['Go Live End'] : null
          );

          const projectId = info.lastInsertRowid;

          // Initial log
          insertLog.run(projectId, row['Current Stage'] || 'Analysis Session', new Date().toISOString());

          // Handle status updates (date columns)
          const fixedColumns = [
            'Category', 'App Name', 'Current Stage', 'Analysis Session Date', 'BRD Submission Date', 
            'BRD Review Date', 'Dev Session Date', 'Development Start', 'Development End', 
            'Demo Start', 'Demo End', 'UAT Start', 'UAT End', 'Deployment Start', 
            'Deployment End', 'Go Live Start', 'Go Live End'
          ];

          Object.keys(row).forEach(key => {
            if (!fixedColumns.includes(key) && row[key]) {
              // Try to normalize date to YYYY-MM-DD if possible
              let statusDate = key;
              const d = new Date(key);
              if (!isNaN(d.getTime())) {
                statusDate = d.toISOString().split('T')[0];
              }
              insertUpdate.run(projectId, statusDate, row[key]);
            }
          });
        });
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Import failed", err);
      res.status(500).json({ error: "Database transaction failed" });
    }
  });

  app.get("/api/settings/:key", (req, res) => {
    const { key } = req.params;
    const setting = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    res.json({ value: setting ? setting.value : "" });
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
