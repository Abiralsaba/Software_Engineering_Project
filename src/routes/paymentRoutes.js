const express = require('express');
const SSLCommerz = require('sslcommerz-lts');
const pool = require('../config/db');
const router = express.Router();

// Configuration
const store_id = process.env.STORE_ID || 'testbox';
const store_passwd = process.env.STORE_PASS || 'qwerty';
const is_live = false; // true for live, false for sandbox

// INIT Payment
router.post('/land/tax/init', async (req, res) => {
    const {
        nid, mobile,
        division_id, district_id, upazila_id,
        khatian_no, dag_no,
        land_type, land_size, tax_amount
    } = req.body;

    const transaction_id = 'LTAX_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    try {
        // 1. Get user_id and name from NID
        const [userRows] = await pool.query('SELECT id, name FROM reg_info WHERE nid = ?', [nid]);
        if (userRows.length === 0) {
            return res.status(400).json({ error: 'A registered citizen NID is required for land tax payment.' });
        }
        const userId = userRows[0].id;
        const applicantName = userRows[0].name;

        // 2. Save to DB (3NF — no name/geo text cols)
        await pool.query(
            `INSERT INTO landtax 
            (transaction_id, user_id, applicant_name, nid, mobile,
            division_id, district_id, upazila_id,
            khatian_no, dag_no, land_type, land_size, 
            tax_amount, payment_status, payment_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [transaction_id, userId, applicantName, nid, mobile,
                division_id || null, district_id || null, upazila_id || null,
                khatian_no, dag_no, land_type, land_size, tax_amount]
        );

        // 3. Init SSLCommerz
        const data = {
            total_amount: tax_amount,
            currency: 'BDT',
            tran_id: transaction_id,
            success_url: `http://localhost:3000/api/payment/land/tax/success/${transaction_id}`,
            fail_url: `http://localhost:3000/api/payment/land/tax/fail/${transaction_id}`,
            cancel_url: `http://localhost:3000/api/payment/land/tax/cancel/${transaction_id}`,
            ipn_url: `http://localhost:3000/api/payment/land/tax/ipn`,
            shipping_method: 'Courier',
            product_name: 'Land Development Tax',
            product_category: 'Government Service',
            product_profile: 'general',
            cus_name: applicantName,
            cus_email: 'customer@example.com',
            cus_add1: 'Dhaka',
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: mobile,
            cus_fax: mobile,
            ship_name: applicantName,
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: '1000',
            ship_country: 'Bangladesh',
        };

        const sslcz = new SSLCommerz(store_id, store_passwd, is_live);
        sslcz.init(data).then(apiResponse => {
            // Redirect the user to payment gateway
            let GatewayPageURL = apiResponse.GatewayPageURL;
            if (GatewayPageURL) {
                res.json({ url: GatewayPageURL });
            } else {
                res.status(400).json({ error: 'Session was not successful' });
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// SUCCESS Handler
router.post('/land/tax/success/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await pool.query(
            "UPDATE landtax SET payment_status = 'Success' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/land.html?status=success&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/land.html?status=error');
    }
});

// FAIL Handler
router.post('/land/tax/fail/:tran_id', async (req, res) => {
    const tran_id = req.params.tran_id;
    try {
        await pool.query(
            "UPDATE landtax SET payment_status = 'Failed' WHERE transaction_id = ?",
            [tran_id]
        );
        res.redirect('/land.html?status=fail&tid=' + tran_id);
    } catch (error) {
        console.error(error);
        res.redirect('/land.html?status=error');
    }
});

module.exports = router;
