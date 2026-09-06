const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const SSLCommerz = require('sslcommerz-lts');

const store_id = process.env.STORE_ID || 'testbox';
const store_passwd = process.env.STORE_PASS || 'qwerty';
const is_live = false; // true for live, false for sandbox

// ==========================================
// PUBLIC ROUTES (Payment Callbacks)
// ==========================================

// Payment Success Callback
router.post('/payment/success/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    try {
        await db.query(
            "UPDATE Ordered_item SET payment_status = 'PAID' WHERE id = ?",
            [orderId]
        );
        res.redirect('/shop.html?status=success&order_id=' + orderId);
    } catch (error) {
        console.error(error);
        res.redirect('/shop.html?status=error');
    }
});

// Payment Fail Callback
router.post('/payment/fail/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    try {
        await db.query(
            "UPDATE Ordered_item SET payment_status = 'FAILED' WHERE id = ?",
            [orderId]
        );
        res.redirect('/shop.html?status=fail&order_id=' + orderId);
    } catch (error) {
        console.error(error);
        res.redirect('/shop.html?status=error');
    }
});

// Payment Cancel Callback
router.post('/payment/cancel/:orderId', async (req, res) => {
    res.redirect('/shop.html?status=cancel');
});

// IPN Callback
router.post('/payment/ipn', async (req, res) => {
    console.log('IPN Received:', req.body);
    return res.status(200).send('IPN Received');
});


// ==========================================
// PUBLIC MARKET PRICES (No auth required)
// ==========================================

router.get('/market-prices', async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM market_prices';
        const params = [];

        if (category && category !== 'All') {
            query += ' WHERE category = ?';
            params.push(category);
        }

        query += ' ORDER BY category, item_name';
        const [prices] = await db.query(query, params);
        res.json(prices);
    } catch (error) {
        console.error('Error fetching market prices:', error);
        res.status(500).json({ error: 'Failed to fetch market prices' });
    }
});

router.get('/market-prices/categories', async (req, res) => {
    try {
        const [categories] = await db.query('SELECT DISTINCT category FROM market_prices ORDER BY category');
        res.json(categories.map(c => c.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ==========================================
// AUTHENTICATED ROUTES
// ==========================================

router.use(verifyToken);

// get user info
const getUserInfo = async (req, res, next) => {
    try {
        const [users] = await db.query('SELECT id, nid, name FROM reg_info WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        req.user.nid = users[0].nid;
        req.user.name = users[0].name;
        req.user.dbId = users[0].id;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
};

router.use(getUserInfo);

// ==========================================
// SHOP ITEMS (Public view)
// ==========================================

router.get('/items', async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM shop_items ORDER BY created_at DESC');
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ==========================================
// CART (the authoritative schema stores authenticated ownership by user NID)
// ==========================================

router.get('/cart', async (req, res) => {
    try {
        const [cartItems] = await db.query(`
            SELECT 
                c.id as cart_id,
                c.quantity,
                c.item_id AS product_id,
                i.name AS name,
                i.price,
                i.image_url
            FROM addto_cart c
            JOIN shop_items i ON c.item_id = i.id
            WHERE c.user_nid = ?
            ORDER BY c.created_at DESC
        `, [req.user.nid]);
        res.json(cartItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/cart', async (req, res) => {
    const { item_id, quantity } = req.body;
    const qty = quantity === undefined ? 1 : Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    console.log(`[DEBUG] Adding to cart. User ID: ${req.user.dbId}, Item: ${item_id}, Qty: ${qty}`);

    try {
        // Get item details
        const [items] = await db.query('SELECT id, name FROM shop_items WHERE id = ?', [item_id]);
        if (items.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // check if already in cart
        const [existing] = await db.query(
            'SELECT id, quantity FROM addto_cart WHERE user_nid = ? AND item_id = ?',
            [req.user.nid, item_id]
        );

        if (existing.length > 0) {
            await db.query(
                'UPDATE addto_cart SET quantity = quantity + ? WHERE id = ? AND user_nid = ?',
                [qty, existing[0].id, req.user.nid]
            );
            console.log('[DEBUG] Updated existing cart item');
        } else {
            await db.query(
                'INSERT INTO addto_cart (user_nid, item_id, quantity) VALUES (?, ?, ?)',
                [req.user.nid, item_id, qty]
            );
            console.log('[DEBUG] Inserted new cart item');
        }

        res.json({ success: true, message: 'Added to cart' });
    } catch (error) {
        console.error('[DEBUG] Error adding to cart:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    }
});

router.delete('/cart/:id', async (req, res) => {
    try {
        await db.query(
            'DELETE FROM addto_cart WHERE id = ? AND user_nid = ?',
            [req.params.id, req.user.nid]
        );
        res.json({ success: true, message: 'Removed from cart' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ==========================================
// ORDERS (using Ordered_item table)
// ==========================================

router.post('/order', async (req, res) => {
    const { payment_method, delivery_address, contact_number } = req.body;

    if (!payment_method || !delivery_address || !contact_number) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // get cart items with full details
        const [cartItems] = await db.query(`
            SELECT c.quantity, c.item_id AS product_id, i.name AS product_name, i.price
            FROM addto_cart c
            JOIN shop_items i ON c.item_id = i.id
            WHERE c.user_nid = ?
        `, [req.user.nid]);

        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Calculate total and prepare product details JSON
        let totalAmount = 0;
        const productDetails = cartItems.map(item => {
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;
            return {
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.price,
                subtotal: itemTotal
            };
        });

        // create Order with product_details JSON
        const [orderResult] = await db.query(`
            INSERT INTO Ordered_item (user_id, user_nid, total_amount, payment_method, payment_status, delivery_address, contact_number, product_details)
            VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
        `, [req.user.dbId, req.user.nid, totalAmount, payment_method, delivery_address, contact_number, JSON.stringify(productDetails)]);

        const orderId = orderResult.insertId;

        // Clear Cart
        await db.query('DELETE FROM addto_cart WHERE user_nid = ?', [req.user.nid]);

        if (payment_method === 'COD') {
            res.json({ success: true, message: 'Order placed successfully via Cash on Delivery!' });
        } else {
            // Online Payment (SSLCommerz SDK)
            const tran_id = `ORDER_${orderId}_${Date.now().toString(36)}`;

            const data = {
                total_amount: totalAmount,
                currency: 'BDT',
                tran_id: tran_id,
                success_url: `http://localhost:3000/api/shop/payment/success/${orderId}`,
                fail_url: `http://localhost:3000/api/shop/payment/fail/${orderId}`,
                cancel_url: `http://localhost:3000/api/shop/payment/cancel/${orderId}`,
                ipn_url: `http://localhost:3000/api/shop/payment/ipn`,
                shipping_method: 'Courier',
                product_name: 'GovShop Items',
                product_category: 'Ecommerce',
                product_profile: 'general',
                cus_name: req.user.name || 'Customer',
                cus_email: 'customer@example.com',
                cus_add1: delivery_address,
                cus_add2: delivery_address,
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: contact_number,
                cus_fax: contact_number,
                ship_name: req.user.name || 'Customer',
                ship_add1: delivery_address,
                ship_add2: delivery_address,
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: '1000',
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerz(store_id, store_passwd, is_live);
            sslcz.init(data).then(apiResponse => {
                let GatewayPageURL = apiResponse.GatewayPageURL;
                if (GatewayPageURL) {
                    res.json({
                        success: true,
                        message: 'Redirecting to payment gateway...',
                        payment_url: GatewayPageURL
                    });
                } else {
                    console.error('SSLCommerz Init Failed:', apiResponse);
                    res.status(400).json({ error: 'Payment session failed to initialize' });
                }
            });
        }

    } catch (error) {
        console.error('Order Error:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    }
});

// (Market prices routes moved to public section above verifyToken)

// ==========================================
// PRICE COMPLAINTS
// ==========================================

router.post('/complaints', async (req, res) => {
    const { shop_name, shop_phone, shop_location, item_name, official_price, charged_price, description } = req.body;

    if (!shop_name || !shop_location || !item_name || !charged_price) {
        return res.status(400).json({ error: 'Shop name, location, item name, and charged price are required' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO price_complaints (user_id, shop_name, shop_phone, shop_location, item_name, official_price, charged_price, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.dbId, shop_name, shop_phone || null, shop_location, item_name, official_price || null, charged_price, description || null]
        );

        res.json({ success: true, message: 'Complaint submitted successfully. We will investigate this matter.', id: result.insertId });
    } catch (error) {
        console.error('Error submitting complaint:', error);
        res.status(500).json({ error: 'Failed to submit complaint' });
    }
});

router.get('/complaints/my', async (req, res) => {
    try {
        const [complaints] = await db.query(
            'SELECT * FROM price_complaints WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.dbId]
        );
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

module.exports = router;
