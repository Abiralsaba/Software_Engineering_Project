const db = require('../config/db');

// get Dashboard Summary (Stats & User Info)
exports.getSummary = async (req, res) => {
    const userId = req.user.id;
    try {
        const [user] = await db.query('SELECT id, name, nid, email, photo_url FROM reg_info WHERE id = ?', [userId]);

        // Real Stats
        // Real Stats - Single Source
        const [active] = await db.query('SELECT count(*) as count FROM service_requests WHERE user_id = ? AND status = "pending"', [userId]);
        const [completed] = await db.query('SELECT count(*) as count FROM service_requests WHERE user_id = ? AND status = "approved"', [userId]);
        const [notifs] = await db.query('SELECT count(*) as count FROM service_requests WHERE user_id = ? AND status IN ("approved", "rejected") AND notification_read = FALSE', [userId]);

        res.json({
            user: user[0],
            stats: {
                activeRequests: active[0].count,
                completedTasks: completed[0].count,
                notifications: notifs[0].count
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// ... (existing Kanban & Document methods keep as is) ...

// Services: Get Active Requests
exports.getActiveRequests = async (req, res) => {
    try {
        const [requests] = await db.query(
            'SELECT * FROM service_requests WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
            [req.user.id, 'pending']
        );
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active requests' });
    }
};

// Services: Update Request Status (Approve/Reject)
exports.updateRequestStatus = async (req, res) => {
    const { requestId, status, comments } = req.body; // requestId is service_requests.id

    if (!['approved', 'rejected'].includes(status.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        // 1. Get the request details to know the sub-table (service type)
        // FIX: Removed "AND user_id = ?" so Admin can find/approve ANY user's request
        const [reqData] = await db.query('SELECT * FROM service_requests WHERE id = ?', [requestId]);

        if (reqData.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = reqData[0];
        console.log(`[UpdateStatus] Admin (User ${req.user.id}) approving Request ${requestId} (Owner: ${request.user_id})`);
        console.log(`[UpdateStatus] Service: ${request.service_type}, Status: ${status}`);

        // 2. Update service_requests table (Restored)
        await db.query('UPDATE service_requests SET status = ? WHERE id = ?', [status, requestId]);

        const uniqueIdMatch = request.details.match(/ID: ([\w-]+) -/);
        const uniqueId = uniqueIdMatch ? uniqueIdMatch[1] : null;

        if (request.service_type === 'Land Mutation') {
            if (uniqueId) {
                // update mutation status in land_mutations_v2
                await db.query('UPDATE land_mutations_v2 SET status = ? WHERE tracking_number = ?', [status, uniqueId]);

                // If Approved, Remove from Seller's Record
                if (status === 'Approved' || status === 'approved') {
                    const [mutations] = await db.query('SELECT * FROM land_mutations_v2 WHERE tracking_number = ?', [uniqueId]);

                    let sellerId = request.user_id; // Default to request creator
                    let matKhatian = null;
                    let matDag = null;
                    let matAmount = 0;

                    if (mutations.length > 0) {
                        const mut = mutations[0];
                        sellerId = mut.user_id;
                        matKhatian = mut.khatian_no;
                        matDag = mut.dag_no;
                        matAmount = parseFloat(mut.land_amount);

                        // --- ROBUST TRANSFER LOGIC ---
                        // 1. Verify Buyer Exists in System
                        const [buyerUser] = await db.query('SELECT id FROM reg_info WHERE nid = ?', [mut.buyer_nid]);

                        if (buyerUser.length > 0) {
                            const buyerId = buyerUser[0].id;

                            // 2. Add to Buyer's Record (Idempotent check)
                            const [existing] = await db.query('SELECT id FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?', [buyerId, matKhatian, matDag]);

                            if (existing.length === 0) {
                                await db.query(`INSERT INTO my_land_record 
                                    (user_id, division_id, district_id, upazila_id, khatian_no, dag_no, mouza, land_size, deed_no, land_price, ownership_description, status) 
                                    VALUES (?, ?, ?, ?, ?, ?, 'Mutation Transfer', ?, ?, ?, ?, 'Approved')`,
                                    [buyerId, mut.division_id, mut.district_id, mut.upazila_id, matKhatian, matDag, matAmount, mut.deed_no || 'N/A', mut.land_price, `Purchased via Mutation (Tracking: ${uniqueId})`]
                                );
                                console.log(`[Transfer] Added Land Record for Buyer ${buyerId} (Size: ${matAmount})`);
                            } else {
                                console.warn(`[Transfer] Buyer ${buyerId} already has record for K:${matKhatian}/D:${matDag}. Skipping insert.`);
                            }

                            // 3. Remove/Reduce from Seller's Record
                            if (matKhatian && matDag) {
                                const [sellerRecords] = await db.query(
                                    'SELECT * FROM my_land_record WHERE user_id = ? AND khatian_no = ? AND dag_no = ?',
                                    [sellerId, matKhatian, matDag]
                                );

                                if (sellerRecords.length > 0) {
                                    const record = sellerRecords[0];
                                    const currentSize = parseFloat(record.land_size);

                                    if (matAmount > 0) {
                                        const epsilon = 0.0001;
                                        if (matAmount >= currentSize - epsilon) {
                                            // Full Transfer
                                            await db.query('DELETE FROM my_land_record WHERE id = ?', [record.id]);
                                            console.log(`[Transfer] Deleted Seller ${sellerId} Record ${record.id} (Full Transfer)`);
                                        } else {
                                            // Partial Transfer
                                            const newSize = currentSize - matAmount;
                                            await db.query('UPDATE my_land_record SET land_size = ? WHERE id = ?', [newSize, record.id]);
                                            console.log(`[Transfer] Updated Seller ${sellerId} Record ${record.id} -> New Size: ${newSize}`);
                                        }
                                    } else {
                                        console.error(`[Transfer] Invalid mutation amount (${matAmount}). Seller record NOT modified.`);
                                    }
                                } else {
                                    console.error(`[Transfer] Seller ${sellerId} record not found (K:${matKhatian}, D:${matDag}).`);
                                }
                            }

                        } else {
                            console.error(`[Transfer] Buyer NID ${mut.buyer_nid} not found in reg_info. Transfer aborted (Seller record preserved).`);
                            // Append error to admin comments so they know why it "failed" silently
                            await db.query('UPDATE service_requests SET admin_comment = CONCAT(IFNULL(admin_comment, ""), " [System Warning: Buyer NID not registered, ownership not transferred]") WHERE id = ?', [requestId]);
                        }

                    } else {
                        console.warn(`[Transfer] Mutation record missing for Tracking ${uniqueId}.`);
                    }
                }
            }
        } else {
            // Generic Logic for other services
            const tableName = `req_${request.service_type.replace(/ /g, '_')}`;
            // 3. Update specific table
            try {
                if (uniqueId) {
                    await db.query(`UPDATE ${tableName} SET status = ? WHERE unique_number = ? AND user_id = ?`,
                        [status, uniqueId, req.user.id]);
                }
            } catch (subTableError) {
                console.warn(`Could not update sub-table ${tableName}:`, subTableError.message);
            }
        }


        // 4. Insert into completed_tasks
        await db.query(
            'INSERT INTO completed_tasks (user_id, service_type, original_request_id, unique_number, status, admin_comment) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, request.service_type, requestId, request.details.split(' - ')[0].replace('ID: ', ''), status, comments]
        );

        // 5. Create Notification
        const message = `Your request for ${request.service_type} has been ${status}. ${comments ? 'Reason: ' + comments : ''}`;
        // FIX: Send notification to the REQUESTER (request.user_id), not the admin (req.user.id)
        await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [request.user_id, message]);

        res.json({ message: 'Request updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update request' });
    }
};

// Services: Get Completed Tasks (Approved Only, from Service Requests)
exports.getCompletedTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        // Single Source: Fetch from service_requests
        const [tasks] = await db.query(
            "SELECT * FROM service_requests WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC",
            [userId]
        );

        // Map to expected format
        const formattedTasks = tasks.map(t => {
            const uniqueIdMatch = t.details && t.details.match(/ID: (\w+) -/);
            const uniqueId = uniqueIdMatch ? uniqueIdMatch[1] : 'N/A';

            return {
                id: t.id,
                service_type: t.service_type,
                unique_number: uniqueId,
                status: 'Approved',
                completed_at: t.created_at
            };
        });

        res.json(formattedTasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch completed tasks' });
    }
};

// Services: Get Notifications (Approved/Rejected from Service Requests)
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        // Single Source: Fetch from service_requests where status is decided
        const [reqs] = await db.query(
            "SELECT * FROM service_requests WHERE user_id = ? AND status IN ('approved', 'rejected') ORDER BY created_at DESC",
            [userId]
        );

        const notifications = reqs.map(r => ({
            id: r.id,
            user_id: r.user_id,
            message: `Your request for ${r.service_type} has been ${r.status}.`,
            is_read: r.notification_read,
            created_at: r.created_at
        }));

        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

exports.markNotificationRead = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE service_requests SET notification_read = TRUE WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

// Kanban: Get Todos
exports.getTodos = async (req, res) => {
    try {
        const [todos] = await db.query('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(todos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
};

// Kanban: Create Todo
// Kanban: Create Todo
exports.createTodo = async (req, res) => {
    console.log('createTodo Body:', req.body);
    const { title, description, due_date } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO todos (user_id, title, description, due_date) VALUES (?, ?, ?, ?)',
            [req.user.id, title, description || null, due_date || null]
        );
        res.json({ id: result.insertId, title, description, due_date, status: 'todo' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

// Kanban: Update Status (Drag & Drop)
exports.updateTodoStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE todos SET status = ? WHERE id = ? AND user_id = ?', [status, id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task' });
    }
};

// Kanban: Delete Todo
exports.deleteTodo = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
};

// Services: Submit Request
// Services: Submit Request
exports.submitServiceRequest = async (req, res) => {
    const { subCategory, uniqueId, description, evidenceLink } = req.body;

    // Whitelist valid tables to prevent SQL injection
    const validTables = [
        'req_nid_correction', 'req_birth_cert_correction', 'req_death_cert_correction', 'req_character_certificate', 'req_income_certificate',
        'req_education_sss', 'req_education_hsc', 'req_education_jsc', 'req_education_university_verification', 'req_education_transcript',
        'req_transport_driving_lic_correction', 'req_transport_driving_lic_renew', 'req_transport_vehicle_reg_correction', 'req_transport_ownership_transfer',
        'req_immigration_visa', 'req_immigration_passport_correction', 'req_immigration_emigration_clearance',
        'req_business_trade_lic', 'req_business_tin_certificate', 'req_business_vat_reg', 'req_business_company_reg', 'req_business_import_export',
        'req_legal_gd', 'req_legal_case', 'req_legal_complain'
    ];

    if (!validTables.includes(subCategory)) {
        return res.status(400).json({ error: 'Invalid service type' });
    }

    try {
        await db.query(`INSERT INTO ${subCategory} (user_id, unique_number, description, evidence_link) VALUES (?, ?, ?, ?)`,
            [req.user.id, uniqueId, description, evidenceLink]);

        // Also log into general service_requests table for easy history tracking (optional but good practice to refer back)
        // Adjusting original service_requests table usage to keep track of ALL requests centrally if needed, 
        // OR just relying on the specific tables. 
        // using service_requests for History tab
        // without querying 25 tables.

        await db.query('INSERT INTO service_requests (user_id, service_type, details, evidence_link) VALUES (?, ?, ?, ?)',
            [req.user.id, subCategory.replace('req_', '').replace(/_/g, ' '), `ID: ${uniqueId} - ${description}`, evidenceLink]);

        res.json({ message: 'Request submitted successfully' });
    } catch (error) {
        console.error('Submit Service Request Error:', error);
        res.status(500).json({ error: error.message || 'Failed to submit request' });
    }
};

// Departments List (Static or DB)
exports.getDepartments = (req, res) => {
    // returning a rich list of departments for the frontend grid
    const departments = [
        { id: 'agri', name: 'Agriculture', icon: 'fa-seedling', desc: 'Subsidies, Crop Reports', link: 'agriculture.html' },
        { id: 'land', name: 'Land Ministry', icon: 'fa-landmark', desc: 'Mutations, Records', link: 'land.html' },
        { id: 'tax', name: 'NBR (Tax)', icon: 'fa-file-invoice-dollar', desc: 'Tax Returns, TIN', link: 'tax.html' },
        { id: 'passport', name: 'Passport', icon: 'fa-passport', desc: 'Applications, Renewal', link: 'passport.html' },
        { id: 'nid', name: 'NID Wing', icon: 'fa-id-card', desc: 'Corrections, Replacement', link: 'nid.html' },
        { id: 'health', name: 'Health', icon: 'fa-heartbeat', desc: 'Vaccination, Hospitals', link: 'health.html' },
        { id: 'water', name: 'Water Resources', icon: 'fa-water', desc: 'Supply, Management', link: 'water.html' },
        { id: 'edu', name: 'Education', icon: 'fa-graduation-cap', desc: 'Results, Admissions', link: 'education.html' }
    ];
    res.json(departments);
};

// Official Documents: Upload (to govt_user_documents)
exports.uploadOfficialDocument = async (req, res) => {
    try {
        console.log('[UploadOfficial] Body:', req.body);
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { docCategory, identityNumber } = req.body; // 'NID', 'Passport', 'Tax'
        const filePath = 'uploads/user_docs/' + req.file.filename;

        await db.query(
            'INSERT INTO govt_user_documents (user_id, doc_category, identity_number, file_path, status) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, docCategory, identityNumber, filePath, 'Pending']
        );

        res.json({ message: 'Document uploaded for verification', filePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

// Documents: Fetch all linked documents
exports.getDocuments = async (req, res) => {
    const userId = req.user.id;
    console.log(`[getDocuments] Fetching docs for User ID: ${userId}`);
    try {
        // 1. Get User Info from reg_info
        const [user] = await db.query('SELECT nid FROM reg_info WHERE id = ?', [userId]);

        const userNid = user.length > 0 ? user[0].nid : null;

        // 2. Fetch specific records
        let nidCard = null;
        if (userNid) {
            const [nids] = await db.query('SELECT * FROM nid_cards WHERE nid_number = ?', [userNid]);
            nidCard = nids[0] || null;
        }

        let passport = null;
        let tax = null;

        // 3. Fetch Pending/Verification Official Docs
        const [govtDocs] = await db.query('SELECT * FROM govt_user_documents WHERE user_id = ? ORDER BY created_at DESC', [userId]);

        // Helper to find latest doc by category (Pending, Approved, or Rejected)
        const findGovtDoc = (cat) => govtDocs.find(d => d.doc_category === cat && ['Pending', 'Approved', 'Rejected'].includes(d.status));

        const nidUpload = findGovtDoc('NID');
        const passportUpload = findGovtDoc('Passport');
        const taxUpload = findGovtDoc('Tax');

        // Always prioritize the uploaded/tracked document if it exists
        if (nidUpload) {
            nidCard = {
                nid_number: nidUpload.identity_number,
                status: nidUpload.status,
                file_path: nidUpload.file_path,
                expiry_date: nidUpload.status === 'Approved' ? 'Valid' : null,
                ...nidUpload
            };
        }

        if (passportUpload) {
            passport = {
                passport_number: passportUpload.identity_number,
                status: passportUpload.status,
                file_path: passportUpload.file_path,
                expiry_date: passportUpload.status === 'Approved' ? 'Valid' : null,
                ...passportUpload
            };
        }

        if (taxUpload) {
            tax = {
                tin_number: taxUpload.identity_number,
                status: taxUpload.status,
                file_path: taxUpload.file_path,
                ...taxUpload
            };
        }

        // Land (JOIN for display names)
        const [land] = await db.query(
            `SELECT lr.*, 
                d.name as division, dist.name as district, u.name as upazila,
                ri.name as owner_name
            FROM my_land_record lr
            LEFT JOIN divisions d ON lr.division_id = d.id
            LEFT JOIN districts dist ON lr.district_id = dist.id
            LEFT JOIN upazilas u ON lr.upazila_id = u.id
            LEFT JOIN reg_info ri ON lr.user_id = ri.id
            WHERE lr.user_id = ?`, [userId]);

        res.json({
            nid: nidCard,
            passport: passport,
            tax: tax,
            land: land || []
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

// User Documents: Upload
exports.uploadUserDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { docType, docName } = req.body;
        const filePath = 'uploads/user_docs/' + req.file.filename;

        await db.query(
            'INSERT INTO user_documents (user_id, doc_type, doc_name, file_path, status) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, docType, docName, filePath, 'Pending']
        );

        res.json({ message: 'Document uploaded successfully', filePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

// User Documents: Get List
exports.getUserDocuments = async (req, res) => {
    try {
        const [docs] = await db.query(
            'SELECT * FROM user_documents WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(docs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch user documents' });
    }
};

// User Documents: Update (Re-upload)
exports.updateUserDocument = async (req, res) => {
    try {
        const { id } = req.params;

        // check ownership
        const [doc] = await db.query('SELECT * FROM user_documents WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (doc.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        let updateQuery = 'UPDATE user_documents SET status = "Pending", updated_at = NOW()';
        const params = [];

        if (req.file) {
            const filePath = 'uploads/user_docs/' + req.file.filename;
            updateQuery += ', file_path = ?';
            params.push(filePath);
        }

        // Also allow updating name if provided
        if (req.body.docName) {
            updateQuery += ', doc_name = ?';
            params.push(req.body.docName);
        }

        updateQuery += ' WHERE id = ?';
        params.push(id);

        await db.query(updateQuery, params);
        res.json({ message: 'Document updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update document' });
    }
};

// History: Fetch Service Requests
exports.getHistory = async (req, res) => {
    try {
        const [requests] = await db.query('SELECT * FROM service_requests WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};
