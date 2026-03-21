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
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

