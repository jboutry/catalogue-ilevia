require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    host:     process.env.PG_HOST,
    port:     process.env.PG_PORT,
    database: process.env.PG_DB,
    user:     process.env.PG_USER,
    password: process.env.PG_PASSWORD,
});

// Route : liste tous les datasets
app.get('/api/datasets', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nom_metier, domaine, description,
                    owner_metier, source_systeme, frequence_maj,
                    sensibilite, qualite_score, qualite_detail, tags
             FROM gouvernance.v_catalogue
             ORDER BY domaine, nom_metier`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route : detail d'un dataset avec lineage
app.get('/api/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const dataset = await pool.query(
            `SELECT * FROM gouvernance.v_catalogue WHERE id = $1`,
            [id]
        );

        if (!dataset.rows.length) {
            return res.status(404).json({ error: 'Dataset introuvable' });
        }

        const lineage = await pool.query(
            `SELECT etape, libelle, type_etape
             FROM gouvernance.lineage
             WHERE id_dataset = $1
             ORDER BY etape ASC`,
            [id]
        );

        res.json({
            ...dataset.rows[0],
            lineage: lineage.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route : retards temps reel
app.get('/api/retards', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                v.stop_name,
                COALESCE(sp.stop_lat, v.stop_lat) AS stop_lat,
                COALESCE(sp.stop_lon, v.stop_lon) AS stop_lon,
                json_agg(json_build_object(
                    'route_id', v.route_id,
                    'route_color', v.route_color,
                    'route_text_color', v.route_text_color,
                    'route_type', v.route_type,
                    'trip_headsign', v.trip_headsign,
                    'direction_id', v.direction_id,
                    'retard_minutes', ROUND(v.retard_minutes::numeric, 1)
                ) ORDER BY v.retard_minutes DESC) AS lignes
            FROM transport.v_retards v
            JOIN transport.stops s ON v.stop_id = s.stop_id
            LEFT JOIN transport.stops sp ON s.parent_station = sp.stop_id
            WHERE v.retard_minutes >= 2
            GROUP BY v.stop_name, COALESCE(sp.stop_lat, v.stop_lat), COALESCE(sp.stop_lon, v.stop_lon)
            ORDER BY MAX(v.retard_minutes) DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route : passages 
app.get('/api/passages', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                s.stop_name,
                COALESCE(sp.stop_lat, s.stop_lat) AS stop_lat,
                COALESCE(sp.stop_lon, s.stop_lon) AS stop_lon,
                json_agg(json_build_object(
                    'route_id', t.route_id,
                    'route_color', r.route_color,
                    'route_text_color', r.route_text_color,
                    'route_type', r.route_type,
                    'trip_headsign', t.trip_headsign,
                    'heure_theorique', (CURRENT_DATE + st.departure_time::interval)
                ) ORDER BY (CURRENT_DATE + st.departure_time::interval) ASC) AS lignes
            FROM transport.stop_times st
            JOIN transport.stops s ON st.stop_id = s.stop_id
            LEFT JOIN transport.stops sp ON s.parent_station = sp.stop_id
            JOIN transport.trips t ON st.trip_id = t.trip_id
            LEFT JOIN transport.routes r ON t.route_id = r.route_id
            JOIN transport.calendar_dates cd
                ON t.service_id = cd.service_id
                AND cd.date::date = CURRENT_DATE
                AND cd.exception_type = 1
            WHERE (s.location_type = 0 OR s.location_type IS NULL)
            GROUP BY s.stop_name, COALESCE(sp.stop_lat, s.stop_lat), COALESCE(sp.stop_lon, s.stop_lon)
            LIMIT 6000
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/qualite', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(DISTINCT d.id)                                        AS total,
                ROUND(AVG(q.score_global::numeric), 1)                     AS score_moyen,
                COUNT(*) FILTER (WHERE q.score_global::numeric >= 90)      AS bonne,
                COUNT(*) FILTER (WHERE q.score_global::numeric >= 75
                    AND q.score_global::numeric < 90)                      AS moyenne,
                COUNT(*) FILTER (WHERE q.score_global::numeric < 75)       AS faible
            FROM gouvernance.dataset d
            LEFT JOIN gouvernance.qualite_historique q ON q.id_dataset = d.id
            WHERE d.actif = true
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { qualite_score, qualite_detail, alerte, owner_metier, frequence_maj } = req.body;

        await pool.query(`
            UPDATE gouvernance.dataset
            SET owner_metier = $1,
                frequence_maj = $2,
                alerte = $3,
                mis_a_jour_le = now()
            WHERE id = $4
        `, [owner_metier, frequence_maj, alerte, id]);

        await pool.query(`
            UPDATE gouvernance.qualite_historique
            SET score_global = $1,
                detail = $2,
                calcule_le = now()
            WHERE id_dataset = $3
        `, [qualite_score, qualite_detail, id]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/lignes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                route_id,
                route_short_name,
                route_type,
                route_color,
                route_text_color
            FROM transport.routes
            ORDER BY route_type, route_short_name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/arrets', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT stop_id, stop_name, stop_lat, stop_lon
            FROM transport.stops
            WHERE stop_lat IS NOT NULL
            AND stop_lon IS NOT NULL
            AND location_type = 1
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Fichiers statiques — TOUJOURS après les routes API
app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});