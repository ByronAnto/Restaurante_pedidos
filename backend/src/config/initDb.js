/**
 * Script de inicialización de la base de datos
 * Crea todas las tablas y datos iniciales
 * Ejecutar: npm run db:init
 */
const { pool } = require('./database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const createTables = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ─── Tabla: users ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'kitchen', 'waiter')),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: categories ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(10) DEFAULT '🍽️',
        display_order INT DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: products ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost DECIMAL(10,2) DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 15.00,
        image_url VARCHAR(500),
        available BOOLEAN DEFAULT true,
        track_stock BOOLEAN DEFAULT false,
        stock_quantity INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: sales ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        sale_number VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,
        amount_received DECIMAL(12,2) DEFAULT 0,
        change_amount DECIMAL(12,2) DEFAULT 0,
        transfer_ref VARCHAR(100),
        customer_name VARCHAR(150),
        customer_id_number VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: sale_items ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        product_name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        tax_rate DECIMAL(5,2) DEFAULT 15.00,
        subtotal DECIMAL(12,2) NOT NULL
      );
    `);

        // ─── Tabla: invoices ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        sale_id INT REFERENCES sales(id),
        type VARCHAR(20) DEFAULT 'nota_venta' CHECK (type IN ('factura', 'nota_venta')),
        sri_status VARCHAR(20) DEFAULT 'offline' CHECK (sri_status IN ('pending', 'sent', 'authorized', 'rejected', 'offline')),
        access_key VARCHAR(49),
        xml_content TEXT,
        customer_id_number VARCHAR(20),
        customer_name VARCHAR(150),
        customer_email VARCHAR(100),
        customer_address TEXT,
        sent_at TIMESTAMP,
        authorized_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: investments ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS investments (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        description TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'supplies' CHECK (category IN ('supplies', 'equipment', 'maintenance', 'ingredients', 'other')),
        amount DECIMAL(12,2) NOT NULL,
        supplier VARCHAR(150),
        invoice_number VARCHAR(50),
        purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: employees ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        id_number VARCHAR(20) UNIQUE,
        role VARCHAR(50),
        base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
        hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
        phone VARCHAR(20),
        address TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: payroll_entries ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id SERIAL PRIMARY KEY,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        period VARCHAR(7) NOT NULL,
        base_salary DECIMAL(10,2) NOT NULL,
        bonuses DECIMAL(10,2) DEFAULT 0,
        deductions DECIMAL(10,2) DEFAULT 0,
        iess_contribution DECIMAL(10,2) DEFAULT 0,
        net_pay DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'paid')),
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, period)
      );
    `);

        // ─── Tabla: kitchen_orders ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS kitchen_orders (
        id SERIAL PRIMARY KEY,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        preparing_at TIMESTAMP,
        ready_at TIMESTAMP,
        delivered_at TIMESTAMP
      );
    `);

        // ─── Tabla: kitchen_order_items ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS kitchen_order_items (
        id SERIAL PRIMARY KEY,
        kitchen_order_id INT REFERENCES kitchen_orders(id) ON DELETE CASCADE,
        product_name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        notes TEXT
      );
    `);

        // ─── Tabla: zones (Zonas del plano) ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        zone_type VARCHAR(30) DEFAULT 'dining',
        icon VARCHAR(10) DEFAULT '🍽️',
        grid_col INT DEFAULT 0,
        grid_row INT DEFAULT 0,
        grid_w INT DEFAULT 2,
        grid_h INT DEFAULT 2,
        color VARCHAR(30) DEFAULT '#10b981',
        display_order INT DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: tables (Full Service Mode) ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        capacity INT DEFAULT 4,
        position_x INT DEFAULT 0,
        position_y INT DEFAULT 0,
        shape VARCHAR(20) DEFAULT 'square',
        zone VARCHAR(50) DEFAULT 'Salón',
        zone_id INT REFERENCES zones(id),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Tabla: config ───
        await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        config_group VARCHAR(50) DEFAULT 'general',
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // ─── Índices (básicos - antes de migraciones) ───
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kitchen_orders_status ON kitchen_orders(status);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(purchase_date);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_entries(period);`);

        // ─── Migraciones para Full Service Mode ───
        // Agregar columnas si no existen (soporta upgrade sin romper datos existentes)
        await client.query(`
            ALTER TABLE sales 
            ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
        `);
        await client.query(`
            ALTER TABLE sales 
            ADD COLUMN IF NOT EXISTS table_id INT REFERENCES tables(id);
        `);
        await client.query(`
            ALTER TABLE kitchen_orders 
            ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
        `);
        await client.query(`
            ALTER TABLE kitchen_orders 
            ADD COLUMN IF NOT EXISTS table_name VARCHAR(50);
        `);

        // ─── Migración: zone_id en tables ───
        await client.query(`
            ALTER TABLE tables 
            ADD COLUMN IF NOT EXISTS zone_id INT REFERENCES zones(id);
        `);

        // ─── Auto-migrar: crear zonas desde texto existente ───
        try {
            const zoneTxt = await client.query("SELECT DISTINCT zone FROM tables WHERE zone IS NOT NULL AND zone != ''");
            for (const row of zoneTxt.rows) {
                const exists = await client.query('SELECT id FROM zones WHERE name = $1', [row.zone]);
                if (exists.rows.length === 0) {
                    const lc = row.zone.toLowerCase();
                    let type = 'dining', icon = '🍽️', color = '#10b981';
                    if (lc.includes('cocina')) { type = 'kitchen'; icon = '👨‍🍳'; color = '#f97316'; }
                    else if (lc.includes('privad')) { type = 'private'; icon = '🔒'; color = '#8b5cf6'; }
                    else if (lc.includes('calle') || lc.includes('terraz') || lc.includes('exterior')) { type = 'outdoor'; icon = '☀️'; color = '#06b6d4'; }
                    else if (lc.includes('barra')) { type = 'bar'; icon = '🍺'; color = '#ec4899'; }
                    await client.query(
                        'INSERT INTO zones (name, zone_type, icon, color) VALUES ($1, $2, $3, $4)',
                        [row.zone, type, icon, color]
                    );
                }
            }
            await client.query("UPDATE tables SET zone_id = z.id FROM zones z WHERE tables.zone = z.name AND tables.zone_id IS NULL");
        } catch (migErr) {
            logger.warn('Zone migration (non-fatal):', migErr.message);
        }

        // ─── Índices para Full Service Mode (después de crear columnas) ───
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_table ON sales(table_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_order_type ON sales(order_type);`);

        await client.query('COMMIT');
        logger.success('Tablas creadas exitosamente');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const seedData = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verificar si ya hay datos
        const { rows } = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(rows[0].count) > 0) {
            logger.info('La base de datos ya tiene datos, saltando seed');
            await client.query('ROLLBACK');
            return;
        }

        // ─── Usuario admin ───
        const passwordHash = await bcrypt.hash('admin123', 10);
        await client.query(`
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES ('admin', 'admin@restaurante.local', $1, 'Administrador', 'admin')
    `, [passwordHash]);

        // ─── Usuario cajero ───
        const cashierHash = await bcrypt.hash('cajero123', 10);
        await client.query(`
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES ('cajero', 'cajero@restaurante.local', $1, 'Cajero Principal', 'cashier')
    `, [cashierHash]);

        // ─── Categorías ───
        await client.query(`
      INSERT INTO categories (name, description, icon, display_order) VALUES
      ('Entradas', 'Aperitivos y entradas', '🥗', 1),
      ('Platos Fuertes', 'Platos principales', '🍖', 2),
      ('Pizzas', 'Pizzas artesanales', '🍕', 3),
      ('Hamburguesas', 'Hamburguesas gourmet', '🍔', 4),
      ('Postres', 'Dulces y postres', '🍰', 5),
      ('Bebidas', 'Refrescos, jugos y más', '🥤', 6),
      ('Bebidas Alcohólicas', 'Cervezas, vinos y cócteles', '🍺', 7)
    `);

        // ─── Productos de ejemplo ───
        await client.query(`
      INSERT INTO products (category_id, name, description, price, cost, tax_rate) VALUES
      (1, 'Ceviche de Camarón', 'Ceviche fresco de camarón con limón', 8.50, 3.50, 15),
      (1, 'Empanadas de Verde', 'Empanadas de plátano verde rellenas de queso', 3.00, 1.20, 15),
      (1, 'Patacones con Queso', 'Patacones crujientes con queso derretido', 4.50, 1.80, 15),
      (2, 'Seco de Pollo', 'Arroz con seco de pollo y maduro', 6.50, 2.80, 15),
      (2, 'Encebollado', 'Sopa de albacora con yuca y cebolla', 5.50, 2.50, 15),
      (2, 'Arroz con Camarón', 'Arroz marinero con camarones', 9.00, 4.00, 15),
      (2, 'Churrasco', 'Churrasco con arroz, maduro y ensalada', 8.00, 3.50, 15),
      (3, 'Pizza Margherita', 'Pizza clásica con tomate y mozzarella', 10.00, 3.80, 15),
      (3, 'Pizza Hawaiana', 'Pizza con jamón y piña', 11.50, 4.20, 15),
      (4, 'Hamburguesa Clásica', 'Carne, lechuga, tomate y queso', 5.50, 2.20, 15),
      (4, 'Hamburguesa BBQ', 'Carne, tocino, cebolla caramelizada BBQ', 7.00, 3.00, 15),
      (5, 'Tres Leches', 'Pastel tres leches casero', 4.00, 1.50, 15),
      (5, 'Brownie con Helado', 'Brownie de chocolate con helado de vainilla', 5.00, 2.00, 15),
      (6, 'Coca-Cola', 'Coca-Cola 500ml', 1.50, 0.60, 15),
      (6, 'Jugo Natural', 'Jugo natural de fruta', 2.50, 0.80, 15),
      (6, 'Agua Mineral', 'Agua mineral 500ml', 1.00, 0.30, 0),
      (7, 'Cerveza Pilsener', 'Cerveza nacional 600ml', 2.50, 1.10, 15),
      (7, 'Copa de Vino', 'Copa de vino tinto o blanco', 5.00, 2.50, 15)
    `);

        // ─── Configuración inicial ───
        await client.query(`
      INSERT INTO config (key, value, config_group, description) VALUES
      ('restaurant_name', 'Mi Restaurante', 'general', 'Nombre del restaurante'),
      ('restaurant_ruc', '', 'general', 'RUC del negocio'),
      ('restaurant_address', '', 'general', 'Dirección del restaurante'),
      ('restaurant_phone', '', 'general', 'Teléfono del restaurante'),
      ('default_tax_rate', '15', 'general', 'Tasa de IVA por defecto (%)'),
      ('currency', 'USD', 'general', 'Moneda'),
      ('pos_mode', 'hybrid', 'pos', 'Modo POS: fast_food, full_service, hybrid'),
      ('print_enabled', 'false', 'printing', 'Impresión habilitada'),
      ('print_service_url', 'http://localhost:3001', 'printing', 'URL del servicio de impresión'),
      ('print_kitchen_ticket', 'true', 'printing', 'Imprimir ticket de cocina'),
      ('print_receipt', 'true', 'printing', 'Imprimir factura/recibo'),
      ('kitchen_display_enabled', 'true', 'kitchen', 'Comandera digital habilitada'),
      ('sri_mode', 'offline', 'sri', 'Modo SRI: online/offline'),
      ('sri_environment', 'test', 'sri', 'Ambiente SRI: test/production'),
      ('sri_ruc', '', 'sri', 'RUC para facturación electrónica'),
      ('sale_number_prefix', 'V', 'general', 'Prefijo para número de venta'),
      ('sale_number_counter', '0', 'general', 'Contador de número de venta')
    `);

        // ─── Zonas de ejemplo ───
        await client.query(`
      INSERT INTO zones (name, zone_type, icon, grid_col, grid_row, grid_w, grid_h, color) VALUES
      ('Calle', 'outdoor', '☀️', 0, 0, 12, 2, '#06b6d4'),
      ('Cocina', 'kitchen', '👨‍🍳', 0, 2, 3, 3, '#f97316'),
      ('Privado', 'private', '🔒', 0, 5, 3, 3, '#8b5cf6'),
      ('Salón 1', 'dining', '🍽️', 3, 2, 9, 6, '#10b981')
    `);

        // ─── Mesas de ejemplo (Full Service Mode) ───
        await client.query(`
      INSERT INTO tables (name, capacity, shape, zone, zone_id) VALUES
      ('Mesa 5', 4, 'square', 'Calle', (SELECT id FROM zones WHERE name='Calle')),
      ('Mesa 6', 4, 'square', 'Calle', (SELECT id FROM zones WHERE name='Calle')),
      ('Mesa 1', 6, 'round', 'Privado', (SELECT id FROM zones WHERE name='Privado')),
      ('Mesa 2', 4, 'square', 'Salón 1', (SELECT id FROM zones WHERE name='Salón 1')),
      ('Mesa 3', 4, 'square', 'Salón 1', (SELECT id FROM zones WHERE name='Salón 1')),
      ('Mesa 4', 4, 'square', 'Salón 1', (SELECT id FROM zones WHERE name='Salón 1'))
    `);

        await client.query('COMMIT');
        logger.success('Datos iniciales insertados exitosamente');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const initDatabase = async () => {
    try {
        logger.info('Iniciando creación de base de datos...');
        await createTables();
        await seedData();
        logger.success('✅ Base de datos inicializada correctamente');
        process.exit(0);
    } catch (err) {
        logger.error('Error inicializando la base de datos:', err);
        process.exit(1);
    }
};

initDatabase();
