

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const adminMiddleware = require('../middleware/adminMiddleware');

// admin-only routes
console.log('Reports Routes Loaded - Fixed Version');
router.use(adminMiddleware);

// GET citizen profile by userId
router.get('/citizen-profile/:userId', async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;

        const [profile] = await db.query(`
            SELECT * FROM v_citizen_profile WHERE user_id = ?
        `, [userId]);

        if (profile.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(profile[0]);
    } catch (error) {
        console.error('Error fetching citizen profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// in user profile
router.get('/my-profile', async (req, res) => {
    try {
        const [profile] = await db.query(`
            SELECT * FROM v_citizen_profile WHERE user_id = ?
        `, [req.user.id]);

        res.json(profile[0] || {});
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// GET land stats by location
router.get('/land-by-location', async (req, res) => {
    try {
        const divisionId = req.query.division_id;

        let query = `SELECT * FROM v_land_by_location`;
        let params = [];

        if (divisionId) {
            query += ` WHERE division_id = ?`;
            params.push(divisionId);
        }

        query += ` ORDER BY division, district, upazila`;

        const [data] = await db.query(query, params);
        res.json(data);
    } catch (error) {
        console.error('Error fetching land data:', error);
        res.status(500).json({ error: 'Failed to fetch land data' });
    }
});

/// Reports & Analytics Routes
// GET community analytics
router.get('/community-analytics', async (req, res) => {
    try {
        const [data] = await db.query(`
            SELECT * FROM v_community_analytics 
            WHERE group_status = 'approved'
            ORDER BY engagement_score DESC
            LIMIT 50
        `);
        res.json(data);
    } catch (error) {
        console.error('Error fetching community analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET service dashboard stats
router.get('/service-dashboard', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const [data] = await db.query(`
            SELECT * FROM v_service_dashboard 
            WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY request_date DESC, service_type
        `, [days]);

        // Also get summary stats
        const [summary] = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(pending_count) as total_pending,
                SUM(approved_count) as total_approved,
                SUM(rejected_count) as total_rejected,
                AVG(approval_rate) as avg_approval_rate
            FROM v_service_dashboard 
            WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [days]);

        res.json({
            data,
            summary: summary[0]
        });
    } catch (error) {
        console.error('Error fetching service dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// GET user activity rankings
router.get('/user-activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const tier = req.query.tier;

        let query = `SELECT * FROM v_user_activity`;
        let params = [];

        if (tier) {
            query += ` WHERE user_tier = ?`;
            params.push(tier);
        }

        query += ` ORDER BY activity_score DESC LIMIT ?`;
        params.push(limit);

        const [data] = await db.query(query, params);

        // Get tier distribution
        const [distribution] = await db.query(`
            SELECT user_tier, COUNT(*) as count 
            FROM v_user_activity 
            GROUP BY user_tier
        `);

        res.json({
            data,
            distribution
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity data' });
    }
});

// GET engagement scores (CTE + window funcs)
router.get('/user-engagement-scores', async (req, res) => {
    try {
        const [data] = await db.query(`
            WITH login_stats AS (
                SELECT user_id, COUNT(*) AS cnt FROM login_logs GROUP BY user_id
            ),
            post_stats AS (
                SELECT user_id, COUNT(*) AS cnt FROM community_posts WHERE status = 'approved' GROUP BY user_id
            ),
            comment_stats AS (
                SELECT user_id, COUNT(*) AS cnt FROM post_comments GROUP BY user_id
            ),
            like_stats AS (
                SELECT user_id, COUNT(*) AS cnt FROM post_likes GROUP BY user_id
            ),
            group_stats AS (
                SELECT user_id, COUNT(*) AS cnt FROM community_members GROUP BY user_id
            ),
            user_metrics AS (
                SELECT 
                    u.id AS user_id,
                    u.name,
                    u.email,
                    u.created_at AS join_date,
                    DATEDIFF(CURDATE(), u.created_at) AS days_since_join,
                    COALESCE(l.cnt, 0) AS login_count,
                    COALESCE(p.cnt, 0) AS post_count,
                    COALESCE(c.cnt, 0) AS comment_count,
                    COALESCE(lk.cnt, 0) AS like_count,
                    COALESCE(g.cnt, 0) AS group_count
                FROM reg_info u
                LEFT JOIN login_stats l ON u.id = l.user_id
                LEFT JOIN post_stats p ON u.id = p.user_id  
                LEFT JOIN comment_stats c ON u.id = c.user_id
                LEFT JOIN like_stats lk ON u.id = lk.user_id
                LEFT JOIN group_stats g ON u.id = g.user_id
            ),
            scored_users AS (
                SELECT 
                    *,
                (login_count * 1 + post_count * 10 + comment_count * 3 + 
                 like_count * 1 + group_count * 5) AS engagement_score
            FROM user_metrics
        )
        SELECT 
            user_id, name, email, join_date,
            login_count, post_count, comment_count, group_count,
            engagement_score,
            NTILE(4) OVER (ORDER BY engagement_score DESC) AS quartile,
            ROUND(PERCENT_RANK() OVER (ORDER BY engagement_score) * 100, 2) AS percentile,
            CASE 
                WHEN engagement_score >= 200 THEN 'Champion'
                WHEN engagement_score >= 100 THEN 'Power User'
                WHEN engagement_score >= 50 THEN 'Active'
                WHEN engagement_score >= 20 THEN 'Regular'
                WHEN engagement_score >= 5 THEN 'Beginner'
                ELSE 'Inactive'
            END AS user_tier,
            ROW_NUMBER() OVER (ORDER BY engagement_score DESC) AS rank_position
        FROM scored_users
        WHERE engagement_score > 0
        ORDER BY engagement_score DESC
        LIMIT 50
        `);

        res.json(data);
    } catch (error) {
        console.error('Error fetching engagement scores:', error);
        res.status(500).json({ error: 'Failed to fetch engagement data' });
    }
});

// GET land rollup report
router.get('/land-rollup', async (req, res) => {
    try {
        const [data] = await db.query(`
            SELECT 
                COALESCE(d.name, '=== GRAND TOTAL ===') AS division,
                COALESCE(dist.name, CONCAT('--- ', COALESCE(d.name, 'Total'), ' ---')) AS district,
                COUNT(DISTINCT m.id) AS total_mutations,
                SUM(CASE WHEN m.status = 'Approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN m.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN m.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected,
                COALESCE(SUM(m.land_price), 0) AS total_value,
                COALESCE(AVG(m.land_price), 0) AS avg_value
            FROM divisions d
            LEFT JOIN districts dist ON d.id = dist.division_id
            LEFT JOIN upazilas u ON dist.id = u.district_id
            LEFT JOIN land_mutations_v2 m ON u.id = m.upazila_id
            GROUP BY d.name, dist.name WITH ROLLUP
            HAVING total_mutations > 0
        `);

        res.json(data);
    } catch (error) {
        console.error('Error fetching land rollup:', error);
        res.status(500).json({ error: 'Failed to fetch land rollup data' });
    }
});

// GET user land details
router.get('/user-land-details', async (req, res) => {
    try {
        const [data] = await db.query(`
            SELECT * FROM v_user_land_details
            ORDER BY total_land_area DESC
        `);
        res.json(data);
    } catch (error) {
        console.error('Error fetching user land details:', error);
        res.status(500).json({ error: 'Failed to fetch user land data' });
    }
});

// GET monthly service pivot
router.get('/service-pivot', async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const [data] = await db.query(`
            SELECT 
                COALESCE(service_type, '=== TOTAL ===') AS service_type,
                SUM(CASE WHEN MONTH(created_at) = 1 THEN 1 ELSE 0 END) AS Jan,
                SUM(CASE WHEN MONTH(created_at) = 2 THEN 1 ELSE 0 END) AS Feb,
                SUM(CASE WHEN MONTH(created_at) = 3 THEN 1 ELSE 0 END) AS Mar,
                SUM(CASE WHEN MONTH(created_at) = 4 THEN 1 ELSE 0 END) AS Apr,
                SUM(CASE WHEN MONTH(created_at) = 5 THEN 1 ELSE 0 END) AS May,
                SUM(CASE WHEN MONTH(created_at) = 6 THEN 1 ELSE 0 END) AS Jun,
                SUM(CASE WHEN MONTH(created_at) = 7 THEN 1 ELSE 0 END) AS Jul,
                SUM(CASE WHEN MONTH(created_at) = 8 THEN 1 ELSE 0 END) AS Aug,
                SUM(CASE WHEN MONTH(created_at) = 9 THEN 1 ELSE 0 END) AS Sep,
                SUM(CASE WHEN MONTH(created_at) = 10 THEN 1 ELSE 0 END) AS Oct,
                SUM(CASE WHEN MONTH(created_at) = 11 THEN 1 ELSE 0 END) AS Nov,
                SUM(CASE WHEN MONTH(created_at) = 12 THEN 1 ELSE 0 END) AS \`Dec\`,
                COUNT(*) AS Total
            FROM service_requests
            WHERE YEAR(created_at) = ?
            GROUP BY service_type WITH ROLLUP
        `, [year]);

        res.json({ year, data });
    } catch (error) {
        console.error('Error fetching service pivot:', error);
        res.status(500).json({ error: 'Failed to fetch pivot data' });
    }
});

// GET running totals
router.get('/running-totals', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const [data] = await db.query(`
            WITH daily_stats AS (
                SELECT 
                    DATE(created_at) as request_date,
                    service_type,
                    COUNT(*) as daily_count
                FROM service_requests
                GROUP BY DATE(created_at), service_type
            ),
            running_stats AS (
                SELECT
                    request_date,
                    service_type,
                    daily_count,
                    SUM(daily_count) OVER (
                        PARTITION BY service_type 
                        ORDER BY request_date
                        ROWS UNBOUNDED PRECEDING
                    ) as running_total
                FROM daily_stats
            ),
            ranked_stats AS (
                SELECT 
                    *,
                    RANK() OVER (PARTITION BY request_date ORDER BY daily_count DESC) as daily_rank,
                    SUM(daily_count) OVER (PARTITION BY request_date) as days_total
                FROM running_stats
            )
            SELECT 
                request_date,
                service_type,
                daily_count,
                running_total,
                daily_rank,
                ROUND(daily_count * 100.0 / days_total, 2) as pct_of_daily
            FROM ranked_stats
            WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY request_date DESC, daily_rank
        `, [days]);

        res.json(data);
    } catch (error) {
        console.error('Error fetching running totals:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// GET division performance
router.get('/division-performance', async (req, res) => {
    try {
        const [data] = await db.query(`
            WITH division_metrics AS (
                SELECT 
                    d.id AS division_id,
                    d.name AS division_name,
                    (SELECT COUNT(*) FROM land_mutations_v2 WHERE division_id = d.id) AS total_mutations,
                    (SELECT SUM(land_price) FROM land_mutations_v2 WHERE division_id = d.id AND status = 'Approved') AS total_land_value,
                    (SELECT COUNT(*) FROM land_mutations_v2 WHERE division_id = d.id AND status = 'Pending') AS pending_mutations,
                    (SELECT COUNT(*) FROM districts WHERE division_id = d.id) AS district_count,
                    (SELECT COUNT(*) FROM upazilas u JOIN districts di ON u.district_id = di.id WHERE di.division_id = d.id) AS upazila_count
                FROM divisions d
            )
            SELECT 
                division_name,
                district_count,
                upazila_count,
                total_mutations,
                pending_mutations,
                COALESCE(total_land_value, 0) AS total_land_value,
                ROUND(COALESCE(total_land_value, 0) / GREATEST(total_mutations, 1), 2) AS avg_land_value,
                ROUND(total_mutations * 100.0 / NULLIF((SELECT SUM(total_mutations) FROM division_metrics), 0), 2) AS pct_of_total_mutations,
                RANK() OVER (ORDER BY COALESCE(total_land_value, 0) DESC) AS value_rank,
                RANK() OVER (ORDER BY total_mutations DESC) AS mutation_rank
            FROM division_metrics
            ORDER BY total_land_value DESC
        `);

        res.json(data);
    } catch (error) {
        console.error('Error fetching division performance:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// GET top 3 per community group
router.get('/top-group-performers', async (req, res) => {
    try {
        const [data] = await db.query(`
            SELECT 
                g.id AS group_id,
                g.name AS group_name,
                u.id AS user_id,
                u.name AS user_name,
                member_activity.post_count,
                member_activity.comment_count,
                member_activity.like_count,
                member_activity.total_activity,
                member_activity.rank_in_group
            FROM (
                SELECT 
                    m.group_id,
                    m.user_id,
                    COALESCE(post_cnt.cnt, 0) AS post_count,
                    COALESCE(comment_cnt.cnt, 0) AS comment_count,
                    COALESCE(like_cnt.cnt, 0) AS like_count,
                    COALESCE(post_cnt.cnt, 0) * 5 + 
                    COALESCE(comment_cnt.cnt, 0) * 2 + 
                    COALESCE(like_cnt.cnt, 0) AS total_activity,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.group_id 
                        ORDER BY (
                            COALESCE(post_cnt.cnt, 0) * 5 + 
                            COALESCE(comment_cnt.cnt, 0) * 2 + 
                            COALESCE(like_cnt.cnt, 0)
                        ) DESC
                    ) AS rank_in_group
                FROM community_members m
                LEFT JOIN (
                    SELECT user_id, group_id, COUNT(*) AS cnt 
                    FROM community_posts WHERE status = 'approved' 
                    GROUP BY user_id, group_id
                ) post_cnt ON m.user_id = post_cnt.user_id AND m.group_id = post_cnt.group_id
                LEFT JOIN (
                    SELECT pc.user_id, p.group_id, COUNT(*) AS cnt 
                    FROM post_comments pc
                    JOIN community_posts p ON pc.post_id = p.id
                    GROUP BY pc.user_id, p.group_id
                ) comment_cnt ON m.user_id = comment_cnt.user_id AND m.group_id = comment_cnt.group_id
                LEFT JOIN (
                    SELECT pl.user_id, p.group_id, COUNT(*) AS cnt 
                    FROM post_likes pl
                    JOIN community_posts p ON pl.post_id = p.id
                    GROUP BY pl.user_id, p.group_id
                ) like_cnt ON m.user_id = like_cnt.user_id AND m.group_id = like_cnt.group_id
                WHERE (
                    COALESCE(post_cnt.cnt, 0) * 5 + 
                    COALESCE(comment_cnt.cnt, 0) * 2 + 
                    COALESCE(like_cnt.cnt, 0)
                ) > 0
            ) member_activity
            JOIN community_groups g ON member_activity.group_id = g.id
            JOIN reg_info u ON member_activity.user_id = u.id
            WHERE member_activity.rank_in_group <= 3 AND g.status = 'approved'
            ORDER BY g.name, member_activity.rank_in_group
        `);

        res.json(data);
    } catch (error) {
        console.error('Error fetching top performers:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// GET audit log
router.get('/audit-log', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const tableName = req.query.table;

        let query = `
            SELECT 
                a.*,
                COALESCE(admin.name, u.name) AS user_name
            FROM audit_log a
            LEFT JOIN admins admin ON a.user_id = admin.id
            LEFT JOIN reg_info u ON a.user_id = u.id
        `;
        let params = [];

        if (tableName) {
            query += ` WHERE a.table_name = ?`;
            params.push(tableName);
        }

        query += ` ORDER BY a.action_timestamp DESC LIMIT ?`;
        params.push(limit);

        const [data] = await db.query(query, params);
        res.json(data);
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// GET system summary
router.get('/summary', async (req, res) => {
    try {
        const [users] = await db.query(`SELECT COUNT(*) as count FROM reg_info`);
        const [services] = await db.query(`SELECT COUNT(*) as count FROM service_requests`);
        const [mutations] = await db.query(`SELECT COUNT(*) as count FROM land_mutations_v2`);
        const [groups] = await db.query(`SELECT COUNT(*) as count FROM community_groups WHERE status = 'approved'`);
        const [posts] = await db.query(`SELECT COUNT(*) as count FROM community_posts WHERE status = 'approved'`);

        const [recentActivity] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM reg_info WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_7d,
                (SELECT COUNT(*) FROM service_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_requests_7d,
                (SELECT COUNT(*) FROM community_posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_posts_7d
        `);

        res.json({
            total_users: users[0].count,
            total_service_requests: services[0].count,
            total_land_mutations: mutations[0].count,
            total_community_groups: groups[0].count,
            total_posts: posts[0].count,
            recent_activity: recentActivity[0]
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

module.exports = router;
