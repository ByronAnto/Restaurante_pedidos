/**
 * ═══════════════════════════════════════════════════════
 *  RESTAURANTE - Backend API
 *  Sistema de Gestión para Restaurante
 *  Servidor Express con JWT + Socket.IO
 * ═══════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { pool } = require('./config/database');
const bcrypt = require('bcryptjs');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const posRoutes = require('./routes/pos.routes');
const productsRoutes = require('./routes/products.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const investmentsRoutes = require('./routes/investments.routes');
const payrollRoutes = require('./routes/payroll.routes');
const kitchenRoutes = require('./routes/kitchen.routes');
const configRoutes = require('./routes/config.routes');
const reportsRoutes = require('./routes/reports.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const recipesRoutes = require('./routes/recipes.routes');
const tablesRoutes = require('./routes/tables.routes');

// ─── Inicializar Express ───
const app = express();
const server = http.createServer(app);

// ─── Socket.IO para comandera digital ───
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

app.set('io', io);

// ─── Middleware globales ───
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// ─── Servir frontend estático ───
const frontendPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../frontend')
    : path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// ─── Rutas de la API ───
app.use('/api/auth', authRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/config', configRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/tables', tablesRoutes);

// ─── Health check ───
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'RestaurantePOS API activa',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// ─── Socket.IO eventos ───
io.on('connection', (socket) => {
    logger.info(`🔌 Cliente conectado: ${socket.id}`);

    socket.on('join-kitchen', () => {
        socket.join('kitchen');
        logger.info(`👨‍🍳 Cliente unido a la cocina: ${socket.id}`);
    });

    socket.on('disconnect', () => {
        logger.info(`🔌 Cliente desconectado: ${socket.id}`);
    });
});

// ─── Manejo de errores ───
app.use(notFound);
app.use(errorHandler);

// ─── Auto-bootstrap de la base de datos ───
const autoBootstrap = async () => {
    try {
        // Crear tablas
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE,
                password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','cashier','kitchen','waiter')),
                active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, icon VARCHAR(10) DEFAULT '🍽️',
                display_order INT DEFAULT 0, active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY, category_id INT REFERENCES categories(id) ON DELETE SET NULL,
                name VARCHAR(150) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL DEFAULT 0,
                cost DECIMAL(10,2) DEFAULT 0, tax_rate DECIMAL(5,2) DEFAULT 15.00, image_url VARCHAR(500),
                available BOOLEAN DEFAULT true, track_stock BOOLEAN DEFAULT false, stock_quantity INT DEFAULT 0,
                show_in_all_categories BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            // Migración: agregar columna si no existe
            await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_all_categories BOOLEAN DEFAULT false`);
            await client.query(`CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), sale_number VARCHAR(20) UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
                payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','transfer')),
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0, tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
                total DECIMAL(12,2) NOT NULL DEFAULT 0, amount_received DECIMAL(12,2) DEFAULT 0,
                change_amount DECIMAL(12,2) DEFAULT 0, transfer_ref VARCHAR(100),
                customer_name VARCHAR(150), customer_id_number VARCHAR(20), notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS sale_items (
                id SERIAL PRIMARY KEY, sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
                product_id INT REFERENCES products(id), product_name VARCHAR(150) NOT NULL,
                quantity INT NOT NULL DEFAULT 1, unit_price DECIMAL(10,2) NOT NULL,
                tax_rate DECIMAL(5,2) DEFAULT 15.00, subtotal DECIMAL(12,2) NOT NULL
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY, sale_id INT REFERENCES sales(id),
                type VARCHAR(20) DEFAULT 'nota_venta' CHECK (type IN ('factura','nota_venta')),
                sri_status VARCHAR(20) DEFAULT 'offline' CHECK (sri_status IN ('pending','sent','authorized','rejected','offline')),
                access_key VARCHAR(49), xml_content TEXT, customer_id_number VARCHAR(20),
                customer_name VARCHAR(150), customer_email VARCHAR(100), customer_address TEXT,
                sent_at TIMESTAMP, authorized_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS investments (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), description TEXT NOT NULL,
                category VARCHAR(50) DEFAULT 'supplies' CHECK (category IN ('supplies','equipment','maintenance','ingredients','other')),
                amount DECIMAL(12,2) NOT NULL, supplier VARCHAR(150), invoice_number VARCHAR(50),
                purchase_date DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, id_number VARCHAR(20) UNIQUE,
                role VARCHAR(50), base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
                hire_date DATE NOT NULL DEFAULT CURRENT_DATE, phone VARCHAR(20), address TEXT,
                active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS payroll_entries (
                id SERIAL PRIMARY KEY, employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
                period VARCHAR(7) NOT NULL, base_salary DECIMAL(10,2) NOT NULL, bonuses DECIMAL(10,2) DEFAULT 0,
                deductions DECIMAL(10,2) DEFAULT 0, iess_contribution DECIMAL(10,2) DEFAULT 0,
                net_pay DECIMAL(10,2) NOT NULL, status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','paid')),
                payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer')),
                payment_date DATE DEFAULT CURRENT_DATE,
                paid_at TIMESTAMP, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS kitchen_orders (
                id SERIAL PRIMARY KEY, sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered')),
                notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                preparing_at TIMESTAMP, ready_at TIMESTAMP, delivered_at TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS kitchen_order_items (
                id SERIAL PRIMARY KEY, kitchen_order_id INT REFERENCES kitchen_orders(id) ON DELETE CASCADE,
                product_name VARCHAR(150) NOT NULL, quantity INT NOT NULL DEFAULT 1, notes TEXT
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS config (
                id SERIAL PRIMARY KEY, key VARCHAR(100) UNIQUE NOT NULL, value TEXT,
                config_group VARCHAR(50) DEFAULT 'general', description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Nuevas tablas: Inventario y Recetas
            await client.query(`CREATE TABLE IF NOT EXISTS inventory_items (
                id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'kg',
                current_stock DECIMAL(12,3) DEFAULT 0, min_stock DECIMAL(12,3) DEFAULT 0,
                last_cost_per_unit DECIMAL(10,4) DEFAULT 0, category VARCHAR(50),
                active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS inventory_purchases (
                id SERIAL PRIMARY KEY, inventory_item_id INT REFERENCES inventory_items(id),
                quantity DECIMAL(12,3) NOT NULL, cost_per_unit DECIMAL(10,4) NOT NULL,
                total_cost DECIMAL(12,2) NOT NULL, supplier VARCHAR(150),
                purchase_date DATE DEFAULT CURRENT_DATE, notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS recipes (
                id SERIAL PRIMARY KEY, product_id INT REFERENCES products(id) ON DELETE CASCADE,
                inventory_item_id INT REFERENCES inventory_items(id),
                quantity_needed DECIMAL(10,4) NOT NULL,
                UNIQUE(product_id, inventory_item_id)
            )`);

            // Tabla de mesas del restaurante
            await client.query(`CREATE TABLE IF NOT EXISTS tables (
                id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL,
                capacity INT DEFAULT 4, position_x INT DEFAULT 0, position_y INT DEFAULT 0,
                shape VARCHAR(20) DEFAULT 'square', zone VARCHAR(50) DEFAULT 'Salón',
                active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Modificadores de productos (ej: Empanada → Verde, Queso, Carne, Pollo)
            await client.query(`CREATE TABLE IF NOT EXISTS modifier_groups (
                id SERIAL PRIMARY KEY, product_id INT REFERENCES products(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL, required BOOLEAN DEFAULT true,
                max_select INT DEFAULT 1, display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            await client.query(`CREATE TABLE IF NOT EXISTS modifier_options (
                id SERIAL PRIMARY KEY, modifier_group_id INT REFERENCES modifier_groups(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL, price_adjustment DECIMAL(10,2) DEFAULT 0,
                available BOOLEAN DEFAULT true, display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            // Guardar modificadores seleccionados en items de venta y cocina
            await client.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS modifiers TEXT DEFAULT ''`);
            await client.query(`ALTER TABLE kitchen_order_items ADD COLUMN IF NOT EXISTS modifiers TEXT DEFAULT ''`);

            await client.query(`CREATE INDEX IF NOT EXISTS idx_modifier_groups_product ON modifier_groups(product_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(modifier_group_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_kitchen_orders_status ON kitchen_orders(status)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(purchase_date)`);

            // Migraciones para tablas existentes
            await client.query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash'`);
            await client.query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE`);
            await client.query(`ALTER TABLE payroll_entries DROP CONSTRAINT IF EXISTS payroll_entries_employee_id_period_key`);

            // Migraciones Full Service
            await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in'`);
            await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_id INT`);
            await client.query(`ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in'`);
            await client.query(`ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS table_name VARCHAR(50)`);

            // Migraciones Anulación de pedidos
            await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`);
            await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_by INT`);
            await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS void_reason TEXT`);
            // Ampliar CHECK de status para incluir 'voided'
            await client.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check`);
            await client.query(`ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (status IN ('pending','completed','cancelled','voided'))`);


            // Seed si la DB está vacía
            const { rows } = await client.query('SELECT COUNT(*) FROM users');
            if (parseInt(rows[0].count) === 0) {
                const adminHash = await bcrypt.hash('admin123', 10);
                const cashierHash = await bcrypt.hash('cajero123', 10);
                await client.query(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES
                    ('admin','admin@restaurante.local',$1,'Administrador','admin'),
                    ('cajero','cajero@restaurante.local',$2,'Cajero Principal','cashier')
                `, [adminHash, cashierHash]);

                await client.query(`INSERT INTO categories (name, description, icon, display_order) VALUES
                    ('Entradas','Aperitivos y entradas','🥗',1),('Platos Fuertes','Platos principales','🍖',2),
                    ('Pizzas','Pizzas artesanales','🍕',3),('Hamburguesas','Hamburguesas gourmet','🍔',4),
                    ('Postres','Dulces y postres','🍰',5),('Bebidas','Refrescos, jugos y más','🥤',6),
                    ('Bebidas Alcohólicas','Cervezas, vinos y cócteles','🍺',7)
                `);

                await client.query(`INSERT INTO products (category_id, name, description, price, cost, tax_rate) VALUES
                    (1,'Ceviche de Camarón','Ceviche fresco de camarón con limón',8.50,3.50,15),
                    (1,'Empanadas de Verde','Empanadas de plátano verde rellenas',3.00,1.20,15),
                    (1,'Patacones con Queso','Patacones crujientes con queso',4.50,1.80,15),
                    (2,'Seco de Pollo','Arroz con seco de pollo y maduro',6.50,2.80,15),
                    (2,'Encebollado','Sopa de albacora con yuca y cebolla',5.50,2.50,15),
                    (2,'Arroz con Camarón','Arroz marinero con camarones',9.00,4.00,15),
                    (2,'Churrasco','Churrasco con arroz, maduro y ensalada',8.00,3.50,15),
                    (3,'Pizza Margherita','Pizza clásica con tomate y mozzarella',10.00,3.80,15),
                    (3,'Pizza Hawaiana','Pizza con jamón y piña',11.50,4.20,15),
                    (4,'Hamburguesa Clásica','Carne, lechuga, tomate y queso',5.50,2.20,15),
                    (4,'Hamburguesa BBQ','Carne, tocino, cebolla caramelizada',7.00,3.00,15),
                    (5,'Tres Leches','Pastel tres leches casero',4.00,1.50,15),
                    (5,'Brownie con Helado','Brownie de chocolate con helado',5.00,2.00,15),
                    (6,'Coca-Cola','Coca-Cola 500ml',1.50,0.60,15),
                    (6,'Jugo Natural','Jugo natural de fruta',2.50,0.80,15),
                    (6,'Agua Mineral','Agua mineral 500ml',1.00,0.30,0),
                    (7,'Cerveza Pilsener','Cerveza nacional 600ml',2.50,1.10,15),
                    (7,'Copa de Vino','Copa de vino tinto o blanco',5.00,2.50,15)
                `);

                await client.query(`INSERT INTO config (key, value, config_group, description) VALUES
                    ('restaurant_name','Mi Restaurante','general','Nombre del restaurante'),
                    ('restaurant_ruc','','general','RUC del negocio'),
                    ('restaurant_address','','general','Dirección del restaurante'),
                    ('restaurant_phone','','general','Teléfono del restaurante'),
                    ('default_tax_rate','15','general','Tasa de IVA por defecto (%)'),
                    ('currency','USD','general','Moneda'),
                    ('print_enabled','false','printing','Impresión habilitada'),
                    ('print_service_url','http://localhost:3001','printing','URL del servicio de impresión'),
                    ('print_kitchen_ticket','true','printing','Imprimir ticket de cocina'),
                    ('print_receipt','true','printing','Imprimir factura/recibo'),
                    ('kitchen_display_enabled','true','kitchen','Comandera digital habilitada'),
                    ('sri_mode','offline','sri','Modo SRI: online/offline'),
                    ('sri_environment','test','sri','Ambiente SRI: test/production'),
                    ('sri_ruc','','sri','RUC para facturación electrónica'),
                    ('sale_number_prefix','V','general','Prefijo para número de venta'),
                    ('sale_number_counter','0','general','Contador de número de venta'),
                    ('pos_mode','full_service','pos','Modo POS: fast_food, full_service, hybrid')
                `);

                logger.success('📦 Datos iniciales insertados (admin/admin123, cajero/cajero123)');
            }

            await client.query('COMMIT');
            logger.success('✅ Base de datos inicializada correctamente');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        logger.error('⚠️ Error inicializando DB (¿PostgreSQL está corriendo?):', err.message);
    }
};

// ─── Iniciar servidor ───
const PORT = process.env.PORT || 3000;

autoBootstrap().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        logger.success(`
  ═══════════════════════════════════════════════════════
   🍽️  RestaurantePOS API v1.0.0
   📡 Servidor:  http://localhost:${PORT}
   📡 Red local: http://0.0.0.0:${PORT}
   🔧 Ambiente:  ${process.env.NODE_ENV || 'development'}
   🔌 Socket.IO: Activo
  ═══════════════════════════════════════════════════════
  `);
    });
});

module.exports = { app, server, io };
