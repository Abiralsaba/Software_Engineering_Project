'use strict';

const fs = require('fs/promises');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.DB_NAME !== 'central_govt_db_test') {
    throw new Error('Batch-one API tests refuse to run outside central_govt_db_test');
}

const projectRoot = path.resolve(__dirname, '../..');
const uploadsRoot = path.join(projectRoot, 'public/uploads');
const db = require('../../src/config/db');
const dashboardRoutes = require('../../src/routes/dashboardRoutes');
const communityRoutes = require('../../src/routes/communityRoutes');
const shopRoutes = require('../../src/routes/shopRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
let server;
let baseUrl;
let alice;
let bob;
let aliceToken;
let bobToken;
let shopItem;
const generatedUploads = new Set();

function tokenFor(user) {
    return jwt.sign({ id: user.id, username: user.name, nid: user.nid }, JWT_SECRET, { expiresIn: '1h' });
}

async function request(method, route, token, body) {
    const isForm = body instanceof FormData;
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
    }
    return { status: response.status, data };
}

function groupForm(name, description, fileName = null) {
    const form = new FormData();
    form.append('name', name);
    form.append('description', description);
    if (fileName) form.append('cover_image', new Blob(['synthetic image'], { type: 'image/png' }), fileName);
    return form;
}

function postForm(content, fileName = null) {
    const form = new FormData();
    form.append('content', content);
    if (fileName) form.append('post_image', new Blob(['synthetic image'], { type: 'image/png' }), fileName);
    return form;
}

function rememberUpload(value) {
    if (value) generatedUploads.add(value);
}

async function removeGeneratedUpload(relativePath) {
    const normalized = String(relativePath).replace(/^\//, '');
    const absolute = path.resolve(projectRoot, 'public', normalized);
    if (!absolute.startsWith(`${uploadsRoot}${path.sep}`)) {
        throw new Error(`Refusing to remove path outside uploads: ${absolute}`);
    }
    await fs.unlink(absolute).catch(error => {
        if (error.code !== 'ENOENT') throw error;
    });
}

async function cleanBatchWrites() {
    const [groups] = await db.query("SELECT id, cover_image FROM community_groups WHERE name LIKE 'TST React Batch One%'");
    if (groups.length) {
        const ids = groups.map(row => row.id);
        const [posts] = await db.query('SELECT image_url FROM community_posts WHERE group_id IN (?)', [ids]);
        groups.forEach(row => rememberUpload(row.cover_image));
        posts.forEach(row => rememberUpload(row.image_url));
        await db.query('DELETE FROM community_groups WHERE id IN (?)', [ids]);
    }
    if (alice && bob) {
        await db.query('DELETE FROM todos WHERE user_id IN (?, ?) AND title LIKE ?', [alice.id, bob.id, 'TST React Batch One%']);
        await db.query('DELETE FROM addto_cart WHERE user_nid IN (?, ?)', [alice.nid, bob.nid]);
        await db.query("DELETE FROM Ordered_item WHERE user_id IN (?, ?) AND delivery_address = 'DEMO DATA — Batch One Address'", [alice.id, bob.id]);
    }
    for (const upload of generatedUploads) await removeGeneratedUpload(upload);
    generatedUploads.clear();
}

test('React Batch 1 API regression', async t => {
    [[alice]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email = 'alice.demo@nationx.test'");
    [[bob]] = await db.query("SELECT id, name, nid FROM reg_info WHERE email = 'bob.demo@nationx.test'");
    [[shopItem]] = await db.query('SELECT id, name, price FROM shop_items ORDER BY id LIMIT 1');
    assert.ok(alice && bob && shopItem, 'synthetic citizen and shop fixtures must exist');
    aliceToken = tokenFor(alice);
    bobToken = tokenFor(bob);
    await cleanBatchWrites();

    const app = express();
    app.use(express.json());
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/community', communityRoutes);
    app.use('/api/shop', shopRoutes);
    app.use((err, req, res, next) => {
        if (err) return res.status(400).json({ error: err.message || String(err) });
        next();
    });
    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    try {
        await t.test('todo, community and shop endpoints require citizen authentication', async () => {
            for (const route of ['/api/dashboard/todos', '/api/community/groups', '/api/shop/items', '/api/shop/cart']) {
                const result = await request('GET', route);
                assert.equal([401, 403].includes(result.status), true, `${route}: ${JSON.stringify(result.data)}`);
            }
        });

        await t.test('todo move and delete operations remain owner-scoped', async () => {
            const created = await request('POST', '/api/dashboard/todos', aliceToken, {
                title: 'TST React Batch One Todo',
                description: '<img src=x onerror=alert(1)>',
                due_date: '2026-12-15 10:30:00'
            });
            assert.equal(created.status, 200);

            const bobMove = await request('PUT', `/api/dashboard/todos/${created.data.id}/move`, bobToken, { status: 'done' });
            const bobDelete = await request('DELETE', `/api/dashboard/todos/${created.data.id}`, bobToken);
            assert.equal(bobMove.status, 200);
            assert.equal(bobDelete.status, 200);
            const [[row]] = await db.query('SELECT status, description FROM todos WHERE id = ?', [created.data.id]);
            assert.equal(row.status, 'todo');
            assert.equal(row.description, '<img src=x onerror=alert(1)>');

            const aliceMove = await request('PUT', `/api/dashboard/todos/${created.data.id}/move`, aliceToken, { status: 'progress' });
            assert.equal(aliceMove.status, 200);
            const [[moved]] = await db.query('SELECT status FROM todos WHERE id = ?', [created.data.id]);
            assert.equal(moved.status, 'progress');
        });

        await t.test('community multipart uploads work and author/admin ownership is enforced', async () => {
            const created = await request('POST', '/api/community/groups', aliceToken, groupForm(
                'TST React Batch One Community',
                '<script>window.__xss = 1</script>',
                'batch-one-cover.png'
            ));
            assert.equal(created.status, 200, JSON.stringify(created.data));
            const groupId = created.data.groupId;
            const [[createdGroup]] = await db.query('SELECT * FROM community_groups WHERE id = ?', [groupId]);
            rememberUpload(createdGroup.cover_image);
            assert.match(createdGroup.cover_image, new RegExp(`^/uploads/community-${alice.id}-`));
            assert.equal(createdGroup.description, '<script>window.__xss = 1</script>');
            await fs.access(path.join(projectRoot, 'public', createdGroup.cover_image.replace(/^\//, '')));
            await db.query("UPDATE community_groups SET status = 'approved' WHERE id = ?", [groupId]);

            const joined = await request('POST', `/api/community/groups/${groupId}/join`, bobToken);
            const duplicateJoin = await request('POST', `/api/community/groups/${groupId}/join`, bobToken);
            assert.equal(joined.status, 200);
            assert.equal(duplicateJoin.status, 400);

            const bobEditGroup = await request('PUT', `/api/community/groups/${groupId}`, bobToken, groupForm('TST React Batch One Hijack', 'not allowed'));
            assert.equal(bobEditGroup.status, 403);
            const [[unchangedGroup]] = await db.query('SELECT name FROM community_groups WHERE id = ?', [groupId]);
            assert.equal(unchangedGroup.name, 'TST React Batch One Community');

            const post = await request('POST', `/api/community/groups/${groupId}/posts`, aliceToken, postForm(
                '<img src=x onerror=window.__xss=2>',
                'batch-one-post.png'
            ));
            assert.equal(post.status, 200, JSON.stringify(post.data));
            const postId = post.data.postId;
            const [[createdPost]] = await db.query('SELECT * FROM community_posts WHERE id = ?', [postId]);
            rememberUpload(createdPost.image_url);
            assert.match(createdPost.image_url, new RegExp(`^/uploads/post-${alice.id}-`));
            await fs.access(path.join(projectRoot, 'public', createdPost.image_url.replace(/^\//, '')));
            await db.query("UPDATE community_posts SET status = 'approved' WHERE id = ?", [postId]);

            const bobEditPost = await request('PUT', `/api/community/posts/${postId}`, bobToken, postForm('attempted edit'));
            assert.equal(bobEditPost.status, 403);
            const comment = await request('POST', `/api/community/posts/${postId}/comments`, bobToken, { content: '<script>comment()</script>' });
            assert.equal(comment.status, 200);
            let [[counterRow]] = await db.query('SELECT comment_count FROM community_posts WHERE id = ?', [postId]);
            assert.equal(counterRow.comment_count, 1, 'installed trigger is the single comment counter authority');
            const aliceEditComment = await request('PUT', `/api/community/comments/${comment.data.comment.id}`, aliceToken, { content: 'not mine' });
            const aliceDeleteComment = await request('DELETE', `/api/community/comments/${comment.data.comment.id}`, aliceToken);
            assert.equal(aliceEditComment.status, 403);
            assert.equal(aliceDeleteComment.status, 403);
            const [[unchangedComment]] = await db.query('SELECT content FROM post_comments WHERE id = ?', [comment.data.comment.id]);
            assert.equal(unchangedComment.content, '<script>comment()</script>');

            const liked = await request('POST', `/api/community/posts/${postId}/like`, aliceToken);
            assert.equal(liked.status, 200);
            [[counterRow]] = await db.query('SELECT like_count FROM community_posts WHERE id = ?', [postId]);
            assert.equal(counterRow.like_count, 1, 'installed trigger is the single like counter authority');
            assert.equal((await request('GET', '/api/community/admin/groups', aliceToken)).status, 403);

            const invalidUpload = new FormData();
            invalidUpload.append('name', 'TST React Batch One Invalid Upload');
            invalidUpload.append('description', 'DEMO DATA');
            invalidUpload.append('cover_image', new Blob(['not an image'], { type: 'text/plain' }), 'not-image.txt');
            const rejected = await request('POST', '/api/community/groups', aliceToken, invalidUpload);
            assert.equal(rejected.status, 400);
        });

        await t.test('cart is isolated, de-duplicated by item and server-calculated for COD', async () => {
            const first = await request('POST', '/api/shop/cart', aliceToken, { item_id: shopItem.id, quantity: 2 });
            const second = await request('POST', '/api/shop/cart', aliceToken, { item_id: shopItem.id, quantity: 1 });
            assert.equal(first.status, 200);
            assert.equal(second.status, 200);
            const aliceCart = await request('GET', '/api/shop/cart', aliceToken);
            const bobCart = await request('GET', '/api/shop/cart', bobToken);
            assert.equal(aliceCart.data.length, 1);
            assert.equal(Number(aliceCart.data[0].quantity), 3);
            assert.equal(bobCart.data.length, 0);

            const crossDelete = await request('DELETE', `/api/shop/cart/${aliceCart.data[0].cart_id}`, bobToken);
            assert.equal(crossDelete.status, 200);
            const stillOwned = await request('GET', '/api/shop/cart', aliceToken);
            assert.equal(stillOwned.data.length, 1);

            const ordered = await request('POST', '/api/shop/order', aliceToken, {
                contact_number: '01990000001',
                delivery_address: 'DEMO DATA — Batch One Address',
                payment_method: 'COD'
            });
            assert.equal(ordered.status, 200, JSON.stringify(ordered.data));
            const duplicate = await request('POST', '/api/shop/order', aliceToken, {
                contact_number: '01990000001',
                delivery_address: 'DEMO DATA — Batch One Address',
                payment_method: 'COD'
            });
            assert.equal(duplicate.status, 400);

            const [orders] = await db.query(
                "SELECT total_amount, product_details FROM Ordered_item WHERE user_id = ? AND delivery_address = 'DEMO DATA — Batch One Address'",
                [alice.id]
            );
            assert.equal(orders.length, 1);
            assert.equal(Number(orders[0].total_amount), Number(shopItem.price) * 3);
            const details = typeof orders[0].product_details === 'string' ? JSON.parse(orders[0].product_details) : orders[0].product_details;
            assert.equal(details[0].quantity, 3);
            assert.equal(Number(details[0].subtotal), Number(shopItem.price) * 3);
        });
    } finally {
        await cleanBatchWrites();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await db.end();
    }
});
