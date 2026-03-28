require('dotenv').config();
const { Pool } = require('pg');
const { transit_realtime } = require('gtfs-realtime-bindings');

const pool = new Pool({
    host:     process.env.PG_HOST,
    port:     process.env.PG_PORT,
    database: process.env.PG_DB,
    user:     process.env.PG_USER,
    password: process.env.PG_PASSWORD,
});

const GTFS_RT_URL = 'https://proxy.transport.data.gouv.fr/resource/ilevia-lille-gtfs-rt';

// Correction décalage horaire ilévia
// Le flux publie en heure d'été (UTC+2) même en hiver (UTC+1)
// Bug connu côté producteur — à retirer quand ilévia corrigera
const CORRECTION_MS = 0;

async function collecterDonnees() {
    try {
        // Purge des données de plus d'1 heure
        const purge = await pool.query(`
            DELETE FROM transport.gtfs_rt
            WHERE collecte_le < now() - INTERVAL '1 hour'
        `);
        console.log(`Purge effectuée — ${purge.rowCount} lignes supprimées`);

        console.log('Collecte en cours...');

        const response = await fetch(GTFS_RT_URL);
        const buffer = await response.arrayBuffer();
        const feed = transit_realtime.FeedMessage.decode(
            new Uint8Array(buffer)
        );

        let nb = 0;

        for (const entity of feed.entity) {
            if (entity.tripUpdate) {
                const trip = entity.tripUpdate.trip;
                const updates = entity.tripUpdate.stopTimeUpdate;

                for (const update of updates) {
                    await pool.query(`
                        INSERT INTO transport.gtfs_rt
                            (trip_id, route_id, stop_id,
                             departure_time, stop_sequence,
                             direction_id, schedule_relationship,
                             status, collecte_le)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
                    `, [
                        trip.tripId,
                        trip.routeId,
                        update.stopId,
                        update.departure ?
                            new Date(update.departure.time * 1000 + CORRECTION_MS) : null,
                        update.stopSequence || null,
                        trip.directionId ?? null,
                        update.scheduleRelationship?.toString() || null,
                        'SCHEDULED'
                    ]);
                    nb++;
                }
            }
        }

        console.log(`${nb} enregistrements insérés`);

    } catch (err) {
        console.error('Erreur collecte :', err.message);
    }
}

collecterDonnees();
setInterval(collecterDonnees, 60000);
console.log('Collecteur GTFS-RT démarré — rafraîchissement toutes les 60s');