const posService = require('../services/pos.service');
const { success, error } = require('../utils/responses');

class PosController {
    async createSale(req, res, next) {
        try {
            let { items, paymentMethod, amountReceived, transferRef, customerName, customerIdNumber, notes, orderType, tableId } = req.body;

            // Fix: For dine_in (pending orders), paymentMethod might be missing. Default to 'cash' temporarily.
            if (orderType === 'dine_in' && !paymentMethod) {
                paymentMethod = 'cash';
            }

            if (!items || !items.length) {
                return error(res, 'Debe incluir al menos un producto', 400);
            }

            if (!paymentMethod || !['cash', 'transfer'].includes(paymentMethod)) {
                return error(res, 'Método de pago inválido (cash o transfer)', 400);
            }

            // Validar items
            for (const item of items) {
                if (!item.productId || !item.productName || !item.quantity || !item.unitPrice) {
                    return error(res, 'Cada item debe tener productId, productName, quantity y unitPrice', 400);
                }
            }

            const result = await posService.createSale({
                userId: req.user.id,
                items,
                paymentMethod,
                amountReceived: parseFloat(amountReceived) || 0,
                transferRef,
                customerName,
                customerIdNumber,
                notes,
                orderType,
                tableId,
            });

            // Emitir evento Socket.IO para la cocina si está disponible
            if (req.app.get('io')) {
                req.app.get('io').to('kitchen').emit('new-kitchen-order', {
                    orderId: result.kitchenOrderId,
                    saleNumber: result.sale.sale_number,
                    items: result.items.map((i) => ({
                        name: i.productName,
                        quantity: i.quantity,
                        notes: i.notes || '',
                    })),
                    createdAt: result.sale.created_at,
                    orderType: orderType || 'dine_in',
                    tableName: result.tableName,
                });
            }

            return success(res, result, 'Venta registrada exitosamente', 201);
        } catch (err) {
            next(err);
        }
    }

    async getSales(req, res, next) {
        try {
            const { page, limit, startDate, endDate, status, paymentMethod } = req.query;

            const result = await posService.getSales({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                startDate,
                endDate,
                status,
                paymentMethod,
            });

            return success(res, result);
        } catch (err) {
            next(err);
        }
    }

    async getSaleById(req, res, next) {
        try {
            const sale = await posService.getSaleById(req.params.id);
            return success(res, sale);
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async cancelSale(req, res, next) {
        try {
            const sale = await posService.cancelSale(req.params.id);
            return success(res, sale, 'Venta cancelada');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    /**
     * Anula una venta completada (requiere clave admin)
     */
    async voidSale(req, res, next) {
        try {
            const { adminUsername, adminPassword, reason } = req.body;

            if (!adminUsername || !adminPassword) {
                return error(res, 'Se requiere usuario y contraseña de administrador', 400);
            }

            // Verificar credenciales de admin
            const admin = await posService.verifyAdminPassword(adminUsername, adminPassword);

            // Anular la venta
            const sale = await posService.voidSale(req.params.id, {
                adminUserId: admin.id,
                reason,
            });

            return success(res, sale, `Venta anulada por ${admin.fullName}`);
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    /**
     * Verifica credenciales de administrador
     */
    async verifyAdmin(req, res, next) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return error(res, 'Se requiere usuario y contraseña', 400);
            }
            const admin = await posService.verifyAdminPassword(username, password);
            return success(res, admin, 'Autenticación exitosa');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async getDailySummary(req, res, next) {
        try {
            const summary = await posService.getDailySummary(req.query.date);
            return success(res, summary);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Obtiene pedidos abiertos (dine-in pending)
     */
    async getOpenOrders(req, res, next) {
        try {
            const orders = await posService.getOpenOrders();
            return success(res, orders);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Agrega items a un pedido abierto
     */
    async addItemsToOrder(req, res, next) {
        try {
            const { items } = req.body;
            
            if (!items || !items.length) {
                return error(res, 'Debe incluir al menos un producto', 400);
            }

            const result = await posService.addItemsToOrder(req.params.id, items, req.user.id);

            // Emitir evento a cocina
            if (req.app.get('io')) {
                req.app.get('io').to('kitchen').emit('new-kitchen-order', {
                    orderId: result.kitchenOrderId,
                    saleNumber: result.sale_number,
                    items: items.map((i) => ({
                        name: i.productName,
                        quantity: i.quantity,
                        notes: i.notes || '',
                    })),
                    createdAt: new Date(),
                    orderType: result.order_type,
                    tableName: result.table_name,
                    isAdditional: true,
                });
            }

            return success(res, result, 'Items agregados al pedido');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    /**
     * Cierra un pedido abierto (cobrar la cuenta)
     */
    async closeOrder(req, res, next) {
        try {
            const { paymentMethod, amountReceived, transferRef, customerName, customerIdNumber } = req.body;

            if (!paymentMethod || !['cash', 'transfer'].includes(paymentMethod)) {
                return error(res, 'Método de pago inválido (cash o transfer)', 400);
            }

            const result = await posService.closeOrder(req.params.id, {
                paymentMethod,
                amountReceived: parseFloat(amountReceived) || 0,
                transferRef,
                customerName,
                customerIdNumber,
            });

            return success(res, result, 'Pedido cerrado exitosamente');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }
}

module.exports = new PosController();
