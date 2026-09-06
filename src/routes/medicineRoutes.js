'use strict';

const express = require('express');
const verifyToken = require('../middleware/authMiddleware');
const catalogue = require('../services/medicineIdentifier/catalogue');

const router = express.Router();
const medicineIdPattern = /^MED-[a-f0-9]{24}$/;
router.use(verifyToken);

function handle(error, res) {
    const status = error.status || 500;
    if (status >= 500) console.error('Medicine catalogue request failed:', error.message);
    res.status(status).json({ error: status >= 500 ? 'Medicine catalogue request failed.' : error.message });
}

router.get('/search', async (req, res) => {
    try { res.json(await catalogue.search(req.query)); } catch (error) { handle(error, res); }
});

router.get('/:medicineId/packages', async (req, res) => {
    try {
        if (!medicineIdPattern.test(req.params.medicineId)) return res.status(400).json({ error: 'Invalid medicine ID.' });
        const medicine = await catalogue.medicineById(req.params.medicineId);
        if (!medicine) return res.status(404).json({ error: 'Medicine not found.' });
        res.json({ medicine: medicine.detail, packages: await catalogue.packagesFor(req.params.medicineId), warnings: ['Dataset-derived estimated price', 'Current pharmacy price may differ'] });
    } catch (error) { handle(error, res); }
});

router.get('/:medicineId/alternatives', async (req, res) => {
    try {
        if (!medicineIdPattern.test(req.params.medicineId)) return res.status(400).json({ error: 'Invalid medicine ID.' });
        const quantity = req.query.quantity === undefined ? null : req.query.quantity;
        res.json(await catalogue.alternatives(req.params.medicineId, quantity));
    } catch (error) { handle(error, res); }
});

router.get('/:medicineId', async (req, res) => {
    try {
        if (!medicineIdPattern.test(req.params.medicineId)) return res.status(400).json({ error: 'Invalid medicine ID.' });
        const medicine = await catalogue.medicineById(req.params.medicineId);
        if (!medicine) return res.status(404).json({ error: 'Medicine not found.' });
        res.json({ ...medicine.detail, packages: await catalogue.packagesFor(req.params.medicineId), limitations: ['Dataset-derived catalogue; not regulator-verified or clinically verified.', 'Professional confirmation is required.'] });
    } catch (error) { handle(error, res); }
});

module.exports = router;
