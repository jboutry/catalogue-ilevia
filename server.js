// Chargement des dépendances
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');

// Initialisation
const app = express();
app.use(cors());
app.use(express.json());

// Connexion PostgreSQL
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
app.get('/api/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM gouvernance.v_catalogue WHERE id = $1`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Dataset introuvable' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Fichiers statiques
app.use(express.static('public'));

// Lancement du serveur
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

app.get('/api/retards', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                route_id,
                stop_name,
                stop_lat,
                stop_lon,
                ROUND(retard_minutes::numeric, 1) AS retard_minutes
            FROM transport.v_retards
            WHERE retard_minutes >= 2
            ORDER BY retard_minutes DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/passages', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (st.stop_id, t.route_id)
                t.route_id,
                s.stop_name,
                s.stop_lat,
                s.stop_lon,
                (CURRENT_DATE + st.departure_time::interval) AS heure_theorique
            FROM transport.stop_times st
            JOIN transport.stops s ON st.stop_id = s.stop_id
            JOIN transport.trips t ON st.trip_id = t.trip_id
            WHERE (CURRENT_DATE + st.departure_time::interval)
                BETWEEN now() AND now() + INTERVAL '1 hour'
            ORDER BY st.stop_id, t.route_id, heure_theorique ASC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
