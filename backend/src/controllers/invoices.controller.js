const invoiceService = require('../services/invoice.service');
const { success, error } = require('../utils/responses');

class InvoicesController {
    async getInvoices(req, res, next) {
        try {
            const { page, limit, type, status } = req.query;
            const result = await invoiceService.getInvoices({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                type,
                status,
            });
            return success(res, result);
        } catch (err) {
            next(err);
        }
    }

    async getInvoiceById(req, res, next) {
        try {
            const invoice = await invoiceService.getInvoiceById(req.params.id);
            return success(res, invoice);
        } catch (err) {
            if (err.statusCode) return error(res, err.message, err.statusCode);
            next(err);
        }
    }

    async createNotaVenta(req, res, next) {
        try {
            const { saleId, customerIdNumber, customerName, customerEmail, customerAddress } = req.body;
            if (!saleId) return error(res, 'saleId es requerido', 400);

            const invoice = await invoiceService.createNotaVenta(saleId, {
                idNumber: customerIdNumber,
                name: customerName,
                email: customerEmail,
                address: customerAddress,
            });
            return success(res, invoice, 'Nota de venta generada', 201);
        } catch (err) {
            if (err.statusCode) return error(res, err.message, err.statusCode);
            next(err);
        }
    }
}

module.exports = new InvoicesController();
