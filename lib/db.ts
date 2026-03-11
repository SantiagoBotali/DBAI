import Database from "better-sqlite3";
import { getDbFilePath, ensureDataDir } from "./sessions";

// Cache one connection per session
const dbCache = new Map<string, Database.Database>();

export function getDb(sessionId = "default"): Database.Database {
  if (dbCache.has(sessionId)) return dbCache.get(sessionId)!;

  ensureDataDir();
  const dbPath = getDbFilePath(sessionId);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  dbCache.set(sessionId, db);

  // Only seed the default practice database
  if (sessionId === "default") {
    initializeSchema(db);
  }

  return db;
}

export function closeDb(sessionId: string) {
  const db = dbCache.get(sessionId);
  if (db) {
    db.close();
    dbCache.delete(sessionId);
  }
}

function initializeSchema(db: Database.Database) {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'")
    .get();
  if (exists) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      budget REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      role TEXT NOT NULL,
      salary REAL NOT NULL,
      hire_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      city TEXT,
      country TEXT NOT NULL DEFAULT 'US'
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      employee_id INTEGER REFERENCES employees(id),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
      total REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_email TEXT,
      country TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_suppliers (
      product_id INTEGER NOT NULL REFERENCES products(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      unit_cost REAL NOT NULL,
      PRIMARY KEY (product_id, supplier_id)
    );
  `);

  seedData(db);
}

function seedData(db: Database.Database) {
  const insertMany = db.transaction(() => {
    const depts = [
      ["Engineering", 850000], ["Sales", 620000], ["Marketing", 430000],
      ["Human Resources", 280000], ["Finance", 390000],
    ];
    const insertDept = db.prepare("INSERT INTO departments (name, budget) VALUES (?, ?)");
    for (const d of depts) insertDept.run(...(d as [string, number]));

    const employees = [
      ["Alice", "Johnson", "alice.j@company.com", 1, "Senior Engineer", 115000, "2020-03-15"],
      ["Bob", "Smith", "bob.s@company.com", 1, "Software Engineer", 92000, "2021-07-01"],
      ["Carol", "Williams", "carol.w@company.com", 2, "Sales Manager", 98000, "2019-11-20"],
      ["David", "Brown", "david.b@company.com", 2, "Sales Representative", 72000, "2022-01-10"],
      ["Emma", "Davis", "emma.d@company.com", 3, "Marketing Director", 108000, "2018-06-05"],
      ["Frank", "Miller", "frank.m@company.com", 3, "Content Specialist", 68000, "2023-02-14"],
      ["Grace", "Wilson", "grace.w@company.com", 4, "HR Manager", 87000, "2020-09-01"],
      ["Henry", "Moore", "henry.m@company.com", 5, "CFO", 145000, "2017-04-12"],
      ["Iris", "Taylor", "iris.t@company.com", 1, "DevOps Engineer", 105000, "2021-03-22"],
      ["Jack", "Anderson", "jack.a@company.com", 2, "Sales Representative", 71000, "2022-08-30"],
    ];
    const insertEmp = db.prepare("INSERT INTO employees (first_name, last_name, email, department_id, role, salary, hire_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const e of employees) insertEmp.run(...(e as Parameters<typeof insertEmp.run>));

    const categories = [
      [1,"Electronics",null],[2,"Computers",1],[3,"Laptops",2],[4,"Desktops",2],
      [5,"Peripherals",1],[6,"Clothing",null],[7,"Men's Clothing",6],
      [8,"Women's Clothing",6],[9,"Books",null],[10,"Technical Books",9],
    ];
    const insertCat = db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)");
    for (const c of categories) insertCat.run(...(c as Parameters<typeof insertCat.run>));

    const products = [
      ["MacBook Pro 14\"","Apple M3 Pro chip, 18GB RAM, 512GB SSD",1999.99,45,3],
      ["Dell XPS 15","Intel Core i9, 32GB RAM, 1TB SSD",1749.99,32,3],
      ["ThinkPad X1 Carbon","Intel Core i7, 16GB RAM, 512GB SSD",1499.99,28,3],
      ["iMac 24\"","Apple M3, 8GB RAM, 256GB SSD, 4.5K display",1299.99,18,4],
      ["Logitech MX Master 3","Advanced wireless mouse, ergonomic design",99.99,120,5],
      ["Keychron K2 Pro","Mechanical keyboard, QMK/VIA support",119.99,85,5],
      ["Sony WH-1000XM5","Industry-leading noise cancelling headphones",349.99,67,5],
      ["Men's Slim Fit Chinos","Stretch cotton, multiple colors",59.99,200,7],
      ["Women's Blazer","Professional cut, fully lined",149.99,95,8],
      ["Clean Code","A Handbook of Agile Software Craftsmanship",34.99,150,10],
      ["Designing Data-Intensive Applications","The Big Ideas Behind Reliable Scalable Systems",49.99,110,10],
      ["27\" 4K Monitor","IPS panel, USB-C connectivity, 144Hz",599.99,40,5],
    ];
    const insertProd = db.prepare("INSERT INTO products (name, description, price, stock, category_id) VALUES (?, ?, ?, ?, ?)");
    for (const p of products) insertProd.run(...(p as Parameters<typeof insertProd.run>));

    const customers = [
      ["Michael","Chen","michael.c@email.com","+1-555-0101","San Francisco","US"],
      ["Sarah","Johnson","sarah.j@email.com","+1-555-0102","New York","US"],
      ["James","Martinez","james.m@email.com","+44-20-5555-0103","London","UK"],
      ["Lisa","Thompson","lisa.t@email.com","+1-555-0104","Chicago","US"],
      ["Kevin","Park","kevin.p@email.com","+82-2-5555-0105","Seoul","KR"],
      ["Anna","Mueller","anna.m@email.com","+49-30-5555-0106","Berlin","DE"],
      ["Carlos","Rodriguez","carlos.r@email.com","+52-55-5555-0107","Mexico City","MX"],
      ["Emily","Watson","emily.w@email.com","+1-555-0108","Austin","US"],
      ["Raj","Patel","raj.p@email.com","+91-22-5555-0109","Mumbai","IN"],
      ["Sophie","Dubois","sophie.d@email.com","+33-1-5555-0110","Paris","FR"],
      ["Tom","Harris","tom.h@email.com","+1-555-0111","Seattle","US"],
      ["Maria","Garcia","maria.g@email.com","+34-91-5555-0112","Madrid","ES"],
    ];
    const insertCust = db.prepare("INSERT INTO customers (first_name, last_name, email, phone, city, country) VALUES (?, ?, ?, ?, ?, ?)");
    for (const c of customers) insertCust.run(...(c as Parameters<typeof insertCust.run>));

    const suppliers = [
      ["Apple Inc.","supply@apple.com","US"],["Dell Technologies","supply@dell.com","US"],
      ["Lenovo Group","supply@lenovo.com","CN"],["Logitech International","supply@logitech.com","CH"],
      ["Sony Corporation","supply@sony.com","JP"],
    ];
    const insertSupp = db.prepare("INSERT INTO suppliers (name, contact_email, country) VALUES (?, ?, ?)");
    for (const s of suppliers) insertSupp.run(...(s as Parameters<typeof insertSupp.run>));

    const ps = [[1,1,1450],[2,2,1200],[3,3,950],[4,1,850],[5,4,45],[7,5,180],[12,2,320]];
    const insertPS = db.prepare("INSERT INTO product_suppliers (product_id, supplier_id, unit_cost) VALUES (?, ?, ?)");
    for (const p of ps) insertPS.run(...(p as [number, number, number]));

    const orders = [
      [1,3,"2024-01-15","delivered",2099.98],[2,3,"2024-01-22","delivered",1749.99],
      [3,4,"2024-02-03","shipped",469.98],[4,4,"2024-02-14","delivered",1499.99],
      [5,1,"2024-02-28","processing",599.99],[6,1,"2024-03-05","pending",384.98],
      [7,3,"2024-03-10","delivered",84.98],[8,4,"2024-03-15","shipped",1999.99],
      [9,1,"2024-03-20","pending",219.98],[10,3,"2024-03-25","processing",149.99],
      [11,4,"2024-04-01","delivered",349.99],[12,1,"2024-04-05","pending",1299.99],
    ];
    const insertOrder = db.prepare("INSERT INTO orders (customer_id, employee_id, order_date, status, total) VALUES (?, ?, ?, ?, ?)");
    for (const o of orders) insertOrder.run(...(o as Parameters<typeof insertOrder.run>));

    const items = [
      [1,1,1,1999.99],[1,5,1,99.99],[2,2,1,1749.99],[3,7,1,349.99],[3,6,1,119.99],
      [4,3,1,1499.99],[5,12,1,599.99],[6,7,1,349.99],[6,5,1,99.99],[7,8,1,59.99],
      [7,10,1,34.99],[8,1,1,1999.99],[9,10,2,34.99],[9,11,1,49.99],
      [10,9,1,149.99],[11,7,1,349.99],[12,4,1,1299.99],
    ];
    const insertItem = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)");
    for (const i of items) insertItem.run(...(i as Parameters<typeof insertItem.run>));
  });

  insertMany();
}
