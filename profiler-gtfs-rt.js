require('dotenv').config();
const { transit_realtime } = require('gtfs-realtime-bindings');

const GTFS_RT_URL = 'https://proxy.transport.data.gouv.fr/resource/ilevia-lille-gtfs-rt';

async function profiler() {
    console.log('Récupération du flux GTFS-RT...');

    const response = await fetch(GTFS_RT_URL);
    const buffer = await response.arrayBuffer();
    const feed = transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
    );

    console.log('\n=== EN-TÊTE DU FLUX ===');
    console.log('Version :', feed.header.gtfsRealtimeVersion);
    console.log('Timestamp :', new Date(feed.header.timestamp * 1000));
    console.log('Nombre d\'entités :', feed.entity.length);

    // Compteurs
    let nbTripUpdates = 0;
    let nbVehiclePositions = 0;
    let nbAlerts = 0;
    let nbStopUpdates = 0;

    // Champs manquants
    let sansVehicleId = 0;
    let sansDirectionId = 0;
    let sansRouteId = 0;
    let sansArrivalTime = 0;
    let sansDepartureTime = 0;
    let sansStopSequence = 0;

    // Valeurs distinctes
    const routes = new Set();
    const stops = new Set();
    const trips = new Set();

    // Exemple de première entité
    let premiereEntite = null;

    for (const entity of feed.entity) {

        if (entity.tripUpdate) {
            nbTripUpdates++;
            const trip = entity.tripUpdate.trip;

            if (!trip.routeId) sansRouteId++;
            if (!trip.directionId && trip.directionId !== 0) sansDirectionId++;
            if (!entity.tripUpdate.vehicle?.id) sansVehicleId++;

            if (trip.routeId) routes.add(trip.routeId);
            if (trip.tripId) trips.add(trip.tripId);

            for (const update of entity.tripUpdate.stopTimeUpdate) {
                nbStopUpdates++;
                if (update.stopId) stops.add(update.stopId);
                if (!update.arrival?.time) sansArrivalTime++;
                if (!update.departure?.time) sansDepartureTime++;
                if (!update.stopSequence) sansStopSequence++;
            }

            if (!premiereEntite) premiereEntite = entity;
        }

        if (entity.vehicle) nbVehiclePositions++;
        if (entity.alert) nbAlerts++;
    }

    console.log('\n=== TYPES D\'ENTITÉS ===');
    console.table({
        'Trip updates (prochains passages)': nbTripUpdates,
        'Vehicle positions (positions GPS)': nbVehiclePositions,
        'Alerts (perturbations)': nbAlerts,
    });

    console.log('\n=== VOLUME DE DONNÉES ===');
    console.table({
        'Trajets distincts': trips.size,
        'Lignes distinctes': routes.size,
        'Arrêts distincts': stops.size,
        'Total passages arrêts': nbStopUpdates,
    });

    console.log('\n=== QUALITÉ À LA SOURCE ===');
    const pct = (n) => `${Math.round((1 - n/nbStopUpdates) * 100)}%`;
    console.table({
        'trip_id renseigné':       `${Math.round((1 - 0/nbTripUpdates) * 100)}%`,
        'route_id renseigné':      `${Math.round((1 - sansRouteId/nbTripUpdates) * 100)}%`,
        'direction_id renseigné':  `${Math.round((1 - sansDirectionId/nbTripUpdates) * 100)}%`,
        'vehicle_id renseigné':    `${Math.round((1 - sansVehicleId/nbTripUpdates) * 100)}%`,
        'arrival_time renseigné':  pct(sansArrivalTime),
        'departure_time renseigné':pct(sansDepartureTime),
        'stop_sequence renseigné': pct(sansStopSequence),
    });

    console.log('\n=== LIGNES PRÉSENTES DANS LE FLUX ===');
    console.log([...routes].sort().join(', '));

    console.log('\n=== EXEMPLE — PREMIÈRE ENTITÉ DÉCODÉE ===');
    if (premiereEntite) {
        const trip = premiereEntite.tripUpdate.trip;
        const updates = premiereEntite.tripUpdate.stopTimeUpdate;
        console.log('Trip ID :', trip.tripId);
        console.log('Route ID :', trip.routeId);
        console.log('Direction :', trip.directionId);
        console.log('Nombre d\'arrêts dans ce trajet :', updates.length);
        console.log('Premier arrêt :');
        console.log('  stop_id :', updates[0].stopId);
        console.log('  stop_sequence :', updates[0].stopSequence);
        console.log('  arrival :', updates[0].arrival ? 
            new Date(updates[0].arrival.time * 1000) : 'null');
        console.log('  departure :', updates[0].departure ? 
            new Date(updates[0].departure.time * 1000) : 'null');
    }
}

profiler();