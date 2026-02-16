require('dotenv').config();

/** Configuración del SRI Ecuador */
const sriConfig = {
    environment: process.env.SRI_ENVIRONMENT || 'test',
    ruc: process.env.SRI_RUC || '',
    businessName: process.env.SRI_BUSINESS_NAME || '',
    commercialName: process.env.SRI_COMMERCIAL_NAME || '',
    address: process.env.SRI_ADDRESS || '',

    // Web Services del SRI
    endpoints: {
        test: {
            reception: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
            authorization: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
        },
        production: {
            reception: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
            authorization: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
        },
    },

    // Tipos de comprobante
    documentTypes: {
        FACTURA: '01',
        NOTA_VENTA: '02',
        NOTA_CREDITO: '04',
    },

    // Tarifas IVA válidas
    taxRates: {
        0: { code: '0', percentage: 0 },
        12: { code: '2', percentage: 12 },
        15: { code: '4', percentage: 15 },
    },
};

module.exports = sriConfig;
